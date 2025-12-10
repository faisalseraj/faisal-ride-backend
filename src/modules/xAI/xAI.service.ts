import { CoreUserMessage, generateText } from 'ai';
import { ImageBuffer, LicensePlateResult, LicensePlateResultWithBuffer } from './xAI.interfaces';

import { GPTDetails } from '../logs/log.interfaces';
import config from '../../config/config';
import { createXai } from '@ai-sdk/xai';
import { promptForAIReasoning } from '../license/license.util';

export const scanOCR = async (
  buffers: ImageBuffer[]
): Promise<{
  buffers: ImageBuffer[];
  response: LicensePlateResultWithBuffer[];
  charactersLength: string;
  model: string;
  tokensUsage: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}> => {
  const xai = createXai({
    apiKey: config.xAiApiKeyV4,
  });

  try {
    const messages: CoreUserMessage[] = [
      ...buffers.map((image) => {
        // return [
        return {
          role: 'user' as any,
          content: [
            {
              image: `data:image/jpeg;base64,${Buffer.from(image.buffer).toString('base64')}`,
              type: 'image',
            },
          ] as any,
        };
        // {
        //   role: 'user' as any,
        //   content: [{ type: 'text', text: `image_id: ${image.id}` }] as any,
        // },
        // ];
      }),
      // .flat(),
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an OCR system. Analyze all the images . Respond ONLY in valid JSON format.
The image IDs are given here ${buffers
              .map((image) => image.id)
              ?.join(
                ', '
              )}. This respectiely, means 1 image belongs to the 1st image_id, 2 image belongs to the 2nd image_id and so on.
Return a JSON array, where each object is:

{
  "image_id": "ID_OF_THE_ASSOCIATED_IMAGE",
  "license_plate": "PLATE_NUMBER_OR_NULL"
}

If no license plate is found, set "license_plate" to null.

DO NOT include markdown, code blocks, explanations, or any text before or after the JSON. Respond with ONLY a JSON array.`,
          },
        ],
      },
    ];

    // Send request to Grok
    const { text, usage } = await generateText({
      model: xai('grok-2-vision-latest'),
      messages: messages,
    });

    // Attempt to parse JSON output
    let gptResults: LicensePlateResult[] = [];
    try {
      const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      gptResults = JSON.parse(cleaned);
    } catch (parseError) {
      console.warn('Failed to parse Grok response. Falling back to empty array.');
      gptResults = buffers.map(({ id }) => ({ image_id: id, license_plate: null }));
    }
    // Merge buffer with result
    const responseWithBuffer: any[] = gptResults.map((result) => {
      const match = buffers.find((b) => b.id === result.image_id);
      return {
        ...result,
        buffer: match || {},
      };
    });

    return {
      buffers,
      response: responseWithBuffer,
      charactersLength: String(text.length),
      model: 'grok-3-beta',
      tokensUsage: String(usage?.completionTokens || 0),
      inputTokens: usage?.promptTokens || 0,
      outputTokens: usage?.completionTokens || 0,
      totalTokens: usage?.totalTokens || 0,
    };
  } catch (error: any) {
    console.error('Error querying xAI Grok:', error.response?.data || error.message);

    // Fallback: include buffer even in case of failure
    const fallbackResponse: LicensePlateResultWithBuffer[] = buffers.map(({ id, buffer }) => ({
      image_id: id,
      license_plate: null,
      buffer,
    }));

    return {
      buffers,
      response: fallbackResponse,
      charactersLength: '0',
      model: 'fallback',
      tokensUsage: '0',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }
};

export const afterScanProcessWithxAI = async (
  imageData: { buffer: { id: string }; text: string; ocrText?: string; ocr2Text?: string }[],
  licensesData: { licensesPool: any[]; apartmentLicenses: any[] },
  isOcrAi: boolean
): Promise<GPTDetails> => {
  const xai = createXai({
    apiKey: config.xAiApiKeyV4,
  });

  try {
    const simplifiedImageData = imageData.map(({ buffer, text }) => ({
      imageId: buffer.id,
      text,
    }));

    const simplifiedDataset = {
      licensesPool: licensesData.licensesPool.map(({ plate, stateShort }) => ({
        plate,
        stateShort,
      })),
      apartmentLicenses: licensesData.apartmentLicenses.map(({ plate, stateShort }) => ({
        plate,
        stateShort,
      })),
    };

    const prompt = promptForAIReasoning(
      isOcrAi,
      `
Here is the OCR data:

Image OCR Text Results:
              ${simplifiedImageData.map(({ imageId, text }) => `- ID: ${imageId}, Text: ${text}`).join('\n')}

And here is the dataset:
Dataset:\nLicenses Pool:\n +
${simplifiedDataset.licensesPool.map((l) => `${l.plate}-${l.stateShort}`).join(', ')}
\nApartment Licenses:\n +
${simplifiedDataset.apartmentLicenses.map((l) => `${l.plate}-${l.stateShort}`).join(', ')}
`
    );

    const messages: CoreUserMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ];

    const { text: rawOutput, usage } = await generateText({
      model: xai('grok-2-vision-latest'),
      messages,
    });

    const cleaned = rawOutput.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    let results: any[] = [];

    try {
      results = JSON.parse(cleaned.trim());
      results = results.map((result) => ({
        ...result,
        buffer: imageData.find((image) => image.buffer.id === result.imageId),
      }));

      if (!Array.isArray(results)) {
        throw new Error('xAI returned a non-array result.');
      }
    } catch (error) {
      console.warn('❌ Failed to parse xAI response:', rawOutput);
      console.warn('❌ Parse error:', error);

      results = imageData.map(({ buffer }) => ({
        imageId: buffer.id,
        id: buffer.id,
        text: '',
        scoring: 0,
        case: 'negative',
        plateNumber: null,
        existsIn: null,
        buffer,
      }));
    }

    const responseWithBuffer: any[] = results.map((result) => {
      const match = imageData.find((img) => img.buffer.id === result.imageId);
      return {
        ...result,
        buffer: match?.buffer || {},
        ocrText: match?.ocrText,
        ocr2Text: match?.ocr2Text,
      };
    });

    return {
      response: responseWithBuffer,
      charactersLength: String(rawOutput.length),
      model: 'grok-2-vision-latest',
      tokensUsage: String(usage?.completionTokens || 0),
      inputTokens: usage?.promptTokens || 0,
      outputTokens: usage?.completionTokens || 0,
      totalTokens: usage?.totalTokens || 0,
      steps: 1,
    };
  } catch (error: any) {
    console.error('❌ xAI scoring error:', error.message || error);

    const fallbackResponse: any[] = imageData.map(({ buffer, ocr2Text, ocrText }) => ({
      imageId: buffer.id,
      text: '',
      scoring: 0,
      case: 'negative',
      plateNumber: null,
      existsIn: null,
      buffer,
      ocr2Text,
      ocrText,
    }));

    return {
      response: fallbackResponse,
      charactersLength: '0',
      model: 'fallback',
      tokensUsage: '0',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      steps: 1,
    };
  }
};
