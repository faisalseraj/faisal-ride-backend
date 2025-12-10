// Shared utility for license scanning
import { Request, Response } from 'express';
import { customOCR, scanningBlobWithAzure } from './license.util';
import { getFileFromS3, uploadBase64ToS3 } from '../S3Bucket';

import { ApiError } from '../errors';
// import { ILicenseProcessing } from '../license-processing/licenseProcessing.interfaces';
import { apartmentComplexService } from '../apartmentComplex';
import catchAsync from '../utils/catchAsync';
import { chatGPTService } from '../chatGPT';
import { extractLicensePlateTextWithGoogleVision } from './license.service';
import { geminiService } from '../gemini';
import httpStatus from 'http-status';
// import { licenseProcessingService } from '../license-processing';
import mongoose from 'mongoose';
import { systemSettingsService } from '../system-settings';
import { v4 as uuidv4 } from 'uuid';
import { xAIService } from '../xAI';

const runLicenseScan = async (
  req: Request,
  res: Response,
  primaryOCR: 'azure' | 'google',
  reasoningTool: 'gemini' | 'chatgpt' | 'xai',
  secondaryOCR?: 'gemini' | 'chatgpt' | 'xai'
) => {
  try {
    const loggedInUser = req.user;
    let apartmentComplexId = req.query['apartmentComplexId'] as string | undefined;
    // let secondaryOCRRecord: any = undefined;
    let negativeItems: any = [];
    negativeItems;
    secondaryOCR;
    let rounds = 0;

    if (loggedInUser?.userType !== 'apartment-complex-employee' && loggedInUser?.userType !== 'apartment-complex-manager') {
      if (!apartmentComplexId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'apartmentComplexId is required');
      }
    } else {
      apartmentComplexId = loggedInUser.apartmentComplex;
    }

    if (!apartmentComplexId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Please select an apartment');
    }

    const licenses = await apartmentComplexService.getAllLicensesByAPartmentComplexId(
      new mongoose.Types.ObjectId(apartmentComplexId!)
    );

    // === Call FastAPI and get cropped base64s
    const images = (await customOCR(req)) as any;

    // === Flatten all cropped plates

    const ocrInputBuffers = images.flatMap((img: any) =>
      img.ocr_results
        .filter((ocr: any) => !!ocr.cropped_plate_base64)
        .map((ocr: any) => ({
          buffer: Buffer.from(ocr.original_image_base64, 'base64'),
          id: ocr.id,
          filename: ocr.filename,
          originalPlateText: ocr.plate_text,
          croppedImage: ocr.cropped_plate_base64,
        }))
    );

    const invalidOCRsFiltered = images.flatMap((img: any) =>
      img.ocr_results.filter((ocr: any) => !!ocr.cropped_plate_base64)
    );
    // const justBuffers = ocrInputBuffers.map((b: any) => b.buffer);
    // console.log(justBuffers, 'justBuffers');
    let ocrResults =
      primaryOCR === 'azure'
        ? await scanningBlobWithAzure(ocrInputBuffers)
        : await extractLicensePlateTextWithGoogleVision(ocrInputBuffers);

    const secondaryOcr = primaryOCR === 'azure' ? 'google' : 'azure';
    const secondaryOcrResults =
      secondaryOcr === 'azure'
        ? await scanningBlobWithAzure(ocrInputBuffers)
        : await extractLicensePlateTextWithGoogleVision(ocrInputBuffers);

    // === Combine Primary + Secondary OCR results
    const ocrResultsWithSecondaryOcr = ocrResults.map((ocrResult, index) => {
      const input = ocrInputBuffers[index];
      const secondaryOcrResult = secondaryOcrResults[index];
      // const thisOCRCustomResult = validOCRSFromCustomOCr.find((ocr: any) =>ocr.id === ocr)
      const ocrText = ` ${ocrResult?.buffer?.originalPlateText ? `OCR 1: ${ocrResult?.buffer?.originalPlateText} &` : ''}, ${
        ocrResult.text ? `${primaryOCR.toUpperCase()} OCR Result: ${ocrResult.text}` : ''
      } & ${secondaryOcrResult?.text ? `${secondaryOcr.toUpperCase()} OCR Result: ${secondaryOcrResult.text}` : ''}`;

      return {
        ...ocrResult,
        ocrText,

        text: ocrText,
        buffer: input, // keep original ID, etc.
      };
    });

    const invalidOcrResults = ocrResultsWithSecondaryOcr.filter((data: any) => !data?.text);
    const validOCRResults = ocrResultsWithSecondaryOcr.filter((data: any) => data?.text);

    // === First Pass Reasoning
    let aiResponse: any = {
      additionalInfo: {},
      response: [],
    };

    try {
      if (validOCRResults?.length > 0) {
        switch (reasoningTool) {
          case 'gemini':
            aiResponse = await geminiService.afterScanProcessWithGemini(validOCRResults, licenses, false);
            break;
          case 'chatgpt':
            aiResponse = await chatGPTService.afterScanProcessWithChatGPT(validOCRResults, licenses, false);
            break;
          case 'xai':
            aiResponse = await xAIService.afterScanProcessWithxAI(validOCRResults, licenses, false);
            break;
          default:
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid reasoning tool: ${reasoningTool}`);
        }

        aiResponse.response = aiResponse.response.map((response: any) => ({
          ...response,
          additionalInfo: {
            reasoningTool,
            ocr: secondaryOcr,
          },
        }));
      }

      rounds += 1;

      // === Round 2 for negatives
      const invalid = aiResponse.response?.filter((item: any) => item.case === 'negative') || [];
      negativeItems = [...invalid, ...invalidOcrResults, ...invalidOCRsFiltered];

      // if (negativeItems.length > 0) {
      //   let round2OCR: any;
      //   switch (secondaryOCR) {
      //     case 'gemini':
      //       round2OCR = await geminiService.scanOCR(negativeItems.map((item: any) => item.buffer));
      //       break;
      //     case 'chatgpt':
      //       round2OCR = await chatGPTService.scanOCR(negativeItems.map((item: any) => item.buffer));
      //       break;
      //     case 'xai':
      //       round2OCR = await xAIService.scanOCR(negativeItems.map((item: any) => item.buffer));
      //       break;
      //     default:
      //       throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid secondary OCR: ${secondaryOCR}`);
      //   }

      //   const round2WithText = round2OCR?.response?.map((item: any) => ({
      //     ...item,
      //     ocr2Text: item.license_plate,
      //     text: item.license_plate,
      //   }));

      //   let secondPassResponse: any;
      //   switch (reasoningTool) {
      //     case 'gemini':
      //       secondPassResponse = await geminiService.afterScanProcessWithGemini(round2WithText, licenses, false);
      //       break;
      //     case 'chatgpt':
      //       secondPassResponse = await chatGPTService.afterScanProcessWithChatGPT(round2WithText, licenses, false);
      //       break;
      //     case 'xai':
      //       secondPassResponse = await xAIService.afterScanProcessWithxAI(round2WithText, licenses, false);
      //       break;
      //     default:
      //       throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid reasoning tool: ${reasoningTool}`);
      //   }

      //   // Merge round 1 + round 2
      //   aiResponse.response = aiResponse.response.map((item: any) => {
      //     let improved = secondPassResponse.response?.find((second: any) => second?.buffer?.id === item.buffer.id);
      //     return improved
      //       ? {
      //           ...improved,
      //           additionalInfo: {
      //             reasoningTool,
      //             ocr: secondaryOCR,
      //           },
      //         }
      //       : item;
      //   });

      //   invalidOcrResults.forEach((invalidOCRAIResponse) => {
      //     let improved = secondPassResponse.response?.find(
      //       (second: any) => second.buffer.id === invalidOCRAIResponse.buffer.id
      //     );
      //     if (improved) {
      //       aiResponse.response.push({
      //         ...improved,
      //         additionalInfo: {
      //           reasoningTool,
      //           ocr: secondaryOCR,
      //         },
      //       });
      //     }
      //   });

      //   aiResponse = {
      //     ...aiResponse,
      //     inputTokens: aiResponse.inputTokens + (secondPassResponse?.inputTokens || 0),
      //     outputTokens: aiResponse.outputTokens + (secondPassResponse?.outputTokens || 0),
      //     totalTokens: aiResponse.totalTokens + (secondPassResponse?.totalTokens || 0),
      //   };

      //   secondaryOCRRecord = {
      //     totalImagesProcessed: negativeItems?.length,
      //     aiOCRTokensConsumed: round2OCR.totalTokens,
      //     secondaryOCR,
      //   };

      //   rounds += 1;
      // }
    } catch (error) {
      console.error(error, 'Error in runLicenseScan');
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error in runLicenseScan');
    }

    // const licenseProcessingRecord: ILicenseProcessing = {
    //   mainOcr: primaryOCR,
    //   secondaryOcr: secondaryOcr,
    //   mainOpenAIOcr: secondaryOCR!,
    //   secondaryOCRRecord,
    //   numberOfLicensesProcessed: licenses.apartmentLicenses?.length + licenses?.licensesPool?.length,
    //   numberOfPics: ocrInputBuffers?.length,
    //   reasoningTokens: aiResponse.totalTokens,
    //   reasongTool: reasoningTool,
    //   rounds,
    //   user: req.user?.id,
    //   positiveCases: aiResponse?.response?.filter((resp: any) => resp?.case === 'positive')?.length || 0,
    //   negativeCases: aiResponse?.response?.filter((resp: any) => resp?.case === 'negative')?.length || 0,
    // };

    // licenseProcessingService.createLicenseProcessing(licenseProcessingRecord);

    return res.send({ ...aiResponse, rounds });
  } catch (e) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

export const runLicenseScanWithCustomOCR = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user;
    // const xApiKey = req.headers['x-api-key'];

    let apartmentComplexId = req.query['apartmentComplexId'] as string | undefined;
    if (loggedInUser?.userType !== 'apartment-complex-employee' && loggedInUser?.userType !== 'apartment-complex-manager') {
      if (!apartmentComplexId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'apartmentComplexId is required');
      }
    } else {
      apartmentComplexId = loggedInUser.apartmentComplex;
    }

    if (!apartmentComplexId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Please select an apartment');
    }

    const images = await customOCR(req);
    res.send(images);
  } catch (e) {
    console.log(e, 'Error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
});
export const scanLicenseWithGoogleVision = catchAsync(async (req: Request, res: Response) => {
  const settings = await systemSettingsService.getFirstSystemSettings();
  return runLicenseScan(
    req,
    res,
    settings?.mainOCRTool!,
    settings?.reasoningTool as 'gemini' | 'chatgpt' | 'xai',
    settings?.secondaryOCRTool as 'gemini' | 'chatgpt' | 'xai'
  );
});

export const cropLicensePlate = catchAsync(async (req: Request, res: Response) => {
  let croppedImageResponse: any;
  try {
    // === Call FastAPI and get cropped base64s
    croppedImageResponse = await customOCR(req);

    const plateText = croppedImageResponse?.[0]?.ocr_results?.[0]?.plate_text;

    if (croppedImageResponse?.[0]?.ocr_results?.[0]?.plate_text) {
      const image1 = croppedImageResponse?.[0]?.ocr_results?.[0]?.cropped_plate_base64;
      const image2: string = croppedImageResponse?.[0]?.ocr_results?.[0]?.original_image_base64;
      const { key: croppedImage } = await uploadBase64ToS3(image1, `tow-request-${plateText}-${uuidv4()}.png`);
      const { key: completeImage } = await uploadBase64ToS3(image2, `tow-request-${plateText}-${uuidv4()}.png`);
      const signedCompleteImage = await getFileFromS3(completeImage);
      const signedCroppedImage = await getFileFromS3(croppedImage);
      return res.send({ plateText, croppedImage, completeImage, signedUrls: { signedCompleteImage, signedCroppedImage } });
    }
    return res.send({ plateText: '', croppedImage: '', completeImage: '' });
  } catch (error) {
    console.error(error, 'Error in cropLicensePlate');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
  }
});

export const cropVinNumber = catchAsync(async (req: Request, res: Response) => {
  let croppedImageResponse: any;
  try {
    // === Call FastAPI and get cropped base64s
    croppedImageResponse = await customOCR(req, 'vin');
    // const vin = croppedImageResponse?.[0]?.ocr_results?.[0]?.vin_text;
    // if (vin) {
    //   const decodedVin = await systemSettingsService.decodeVin(vin);
    //   croppedImageResponse[0].decodedVin = decodedVin;
    // }
  } catch (error) {
    console.error(error, 'Error in cropLicensePlate');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error in cropLicensePlate');
  }

  return res.send({ croppedImageResponse });
});

export const decodeVin = catchAsync(async (req: Request, res: Response) => {
  try {
    const vin = req.query['vin'] as string;
    if (!vin) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'VIN is required');
    }

    // Call FastAPI with 5s timeout
    const decodedVin = await withTimeout(systemSettingsService.decodeVin(vin), 5000);

    return res.status(httpStatus.OK).send(decodedVin);
  } catch (error) {
    console.error(error, 'Error in decodeVin');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error decoding VIN');
  }
});

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('VIN decode request timed out')), ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};
