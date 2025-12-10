import { ImageBuffer, LicensePlateResult, LicensePlateResultWithBuffer } from '../chatGPT/chatGPT.interfaces';

import { GPTDetails } from '../logs/log.interfaces';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/config';
import { promptForAIReasoning } from '../license/license.util';

export const scanOCR = async (buffers: ImageBuffer[]): Promise<GPTDetails> => {
  // Renamed GPTDetails to GeminiDetails
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  // Using gemini-1.5-pro for robust vision capabilities as it's the most suitable for OCR from images.
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    // Prepare contents for Gemini API
    // Each image becomes a part, followed by the instruction part.
    const parts: any[] = [];

    buffers.forEach((image: any) => {
      parts.push({ text: `Image ID: ${image.id}` }); // Text part to associate ID
      parts.push({
        inlineData: {
          mimeType: image.mimetype, // Assuming JPEG, adjust if you have other types
          data: Buffer.from(image.buffer).toString('base64'),
        },
      });
    });

    // Add the final instruction part
    parts.push({
      text: `You are an OCR system. Analyze all the previous images. Respond ONLY in valid JSON format.

Return a JSON array, where each object is:

{
  "image_id": "ID_FROM_IMAGE",
  "license_plate": "PLATE_NUMBER_OR_NULL"
}

If no license plate is found, set "license_plate" to null.

DO NOT include markdown, code blocks, explanations, or any text before or after the JSON. Respond with ONLY a JSON array.`,
    });

    // Send request to Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: {
        responseMimeType: 'application/json', // Request JSON output directly
        temperature: 0.1, // Lower temperature makes the output more deterministic for OCR
      },
    });

    const response = result.response;
    const rawOutput = response.text(); // Get the raw text output from the response

    // Attempt to parse raw output
    let geminiResults: LicensePlateResult[] = [];

    try {
      // The model is instructed to respond with ONLY JSON, so direct parsing should work.
      // However, add a trim just in case there are leading/trailing whitespaces.
      geminiResults = JSON.parse(rawOutput.trim());
    } catch (parseError) {
      console.warn('Failed to parse Gemini response JSON. Falling back to empty array.', parseError);
      console.warn('Raw output:', rawOutput);
      geminiResults = buffers.map(({ id }) => ({ image_id: id, license_plate: null }));
    }

    // Merge buffer with result
    const responseWithBuffer: LicensePlateResultWithBuffer[] = geminiResults.map((result) => {
      const match = buffers.find((b) => b.id === result.image_id);
      return {
        ...result,
        buffer: match || '', // preserve original buffer
      };
    });

    const usageMetadata: any = response.usageMetadata || {};

    return {
      buffers,
      response: responseWithBuffer,
      charactersLength: String(rawOutput.length),
      model: model.model || 'unknown',
      tokensUsage: String(usageMetadata?.['totalTokenCount'] || 0), // Use totalTokenCount if available
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    };
  } catch (error: any) {
    console.error('Error querying Gemini:', error.response?.data || error.message);

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

export const afterScanProcessWithGemini = async (
  imageData: { buffer: { id: string }; text: string; ocrText?: string; ocr2Text?: string }[],
  licensesData: { licensesPool: any[]; apartmentLicenses: any[] },
  isOcrAi: boolean
): Promise<GPTDetails> => {
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  try {
    // Simplify input for Gemini
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

    const parts: any[] = [];

    // Image Texts
    parts.push({
      text: `Image OCR Text Results of 2 OCR scans:\n${JSON.stringify(simplifiedImageData, null, 2)}`,
    });

    // License Dataset
    parts.push({
      text: `License Plate Dataset:\n${JSON.stringify(simplifiedDataset, null, 2)}`,
    });
    // Instructions
    parts.push({
      text: promptForAIReasoning(isOcrAi),
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const response = result.response;
    const rawOutput = response.text();
    const cleaned = rawOutput.replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let geminiResults: any[] = [];

    try {
      geminiResults = JSON.parse(cleaned.trim());
      geminiResults = geminiResults.map((result) => {
        const image = imageData.find((image) => image.buffer.id === result.imageId);
        return {
          ...result,
          buffer: image?.buffer,
          ocrText: image?.ocrText,
          ocr2Text: image?.ocr2Text,
        };
      });
      if (!Array.isArray(geminiResults)) {
        throw new Error('Gemini returned a non-array result.');
      }
    } catch (error) {
      console.warn('❌ Failed to parse Gemini response:', rawOutput);
      console.warn('❌ Parse error:', error);

      geminiResults = imageData.map(({ buffer, ocrText, ocr2Text }) => ({
        imageId: buffer.id,
        text: '',
        scoring: 0,
        case: 'negative',
        plateNumber: null,
        existsIn: null,
        ocrText,
        ocr2Text,
      }));
    }

    const usageMetadata: any = response.usageMetadata || {};

    return {
      response: geminiResults,
      charactersLength: String(rawOutput.length),
      model: model.model || 'unknown',
      tokensUsage: String(usageMetadata?.['totalTokenCount'] || 0),
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
      steps: 1,
    };
  } catch (error: any) {
    console.error('❌ Gemini scoring error:', error.message || error);

    const fallbackResponse: any[] = imageData.map(({ buffer }) => ({
      imageId: buffer.id,
      text: '',
      scoring: 0,
      case: 'negative',
      plateNumber: null,
      existsIn: null,
      buffer,
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
