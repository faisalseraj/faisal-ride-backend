import {
  ImageBuffer,
  LicensePlateResult,
  LicensePlateResultAfterScan,
  LicensePlateResultWithBuffer,
  OpenAIChatModel,
} from './chatGPT.interfaces';
import { instructionGuides, instructionGuidesKeys } from './util';

import ApiError from '../errors/ApiError';
import { GPTDetails } from '../logs/log.interfaces';
import { ObjectId } from 'mongoose';
import OpenAI from 'openai';
import config from '../../config/config';
import httpStatus from 'http-status';
import { promptForAIReasoning } from '../license/license.util';

export const queryChatGPT = async (
  userId: ObjectId,
  prompt: string,
  model: string,
  maxCharacters: number,
  type: instructionGuidesKeys | 'other',
  language: string,
  base64Image: string
): Promise<GPTDetails> => {
  instructionGuides;
  userId;
  model;
  OpenAIChatModel;
  maxCharacters;
  try {
    const openai = new OpenAI({
      apiKey: config.openAIApiKeyV4,
    });

    const approach1Data = await openai.chat.completions
      .create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the license plate number from this image.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      })
      .asResponse();
    const approach1Res:any = await approach1Data.json();
    const approach1 = approach1Res?.choices?.[0]?.message?.content;
    const tokenUsage = approach1Res?.usage;

    const inputTokens = tokenUsage?.prompt_tokens || 0;
    const outputTokens = tokenUsage?.completion_tokens || 0;
    const totalTokens = tokenUsage?.total_tokens || 0;
    console.log(approach1Res, 'approach1Res');
    // Update chat history with the response

    return {
      prompt,
      response: approach1,
      charactersLength: String(approach1?.length || 0),
      model: approach1Res?.model,
      tokensUsage: String(approach1Res?.usage?.completion_tokens || 0),
      type,
      language,
      inputTokens,
      outputTokens,
      totalTokens,
    } as any;
  } catch (error: any) {
    console.error('Error querying ChatGPT:', error.response ? error.response.data : error.message);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error in ChatGPT ' + (error.response ? error.response.data : error.message)
    );
  }
};

export const scanOCR = async (buffers: ImageBuffer[]): Promise<GPTDetails> => {
  const openai = new OpenAI({ apiKey: config.openAIApiKeyV4 });

  try {
    // Prepare messages
    const messages = buffers.map((image) => ({
      role: 'user',
      content: [
        { type: 'text', text: `Image ID: ${image.id}` },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${Buffer.from(image.buffer).toString('base64')}`,
          },
        },
      ],
    }));

    // Add final instruction
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are an OCR system. Analyze all the previous images. Respond ONLY in valid JSON format.

Return a JSON array, where each object is:

{
  "image_id": "ID_FROM_IMAGE",
  "license_plate": "PLATE_NUMBER_OR_NULL"
}

If no license plate is found, set "license_plate" to null.

DO NOT include markdown, code blocks, explanations, or any text before or after the JSON. Respond with ONLY a JSON array.`,
        },
      ],
    });

    // Send request to GPT-4o
    const response = await openai.chat.completions
      .create({
        model: 'gpt-4o',
        messages: messages as any,
      })
      .asResponse();

    const data:any = await response.json();
    const rawOutput = data?.choices?.[0]?.message?.content || '';

    // Attempt to parse raw output
    let gptResults: LicensePlateResult[] = [];

    try {
      const cleaned = rawOutput.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      gptResults = JSON.parse(cleaned);
    } catch (parseError) {
      console.warn('Failed to parse GPT response. Falling back to empty array.');
      gptResults = buffers.map(({ id }) => ({ image_id: id, license_plate: null }));
    }

    // Merge buffer with result
    const responseWithBuffer: LicensePlateResultWithBuffer[] = gptResults.map((result) => {
      const match = buffers.find((b) => b.id === result.image_id);
      return {
        ...result,
        buffer: match, // preserve original buffer
      };
    });

    const tokenUsage:any = data?.usage || {};

    return {
      buffers,
      response: responseWithBuffer,
      charactersLength: String(rawOutput.length),
      model: data?.model || 'unknown',
      tokensUsage: String(tokenUsage.completion_tokens || 0),
      inputTokens: tokenUsage.prompt_tokens || 0,
      outputTokens: tokenUsage.completion_tokens || 0,
      totalTokens: tokenUsage.total_tokens || 0,
    };
  } catch (error: any) {
    console.error('Error querying ChatGPT:', error.response?.data || error.message);

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

export const afterScanProcessWithChatGPT = async (
  imageData: { buffer: { id: string }; text: string; ocrText?: string; ocr2Text?: string }[],
  licensesData: { licensesPool: any[]; apartmentLicenses: any[] },
  isOcrAi: boolean
): Promise<GPTDetails> => {
  const openai = new OpenAI({ apiKey: config.openAIApiKeyV4 });

  try {
    // Trim input data to avoid long token prompts
    const trimmedImageData = imageData;
    const trimmedLicensesData = {
      licensesPool: licensesData.licensesPool,
      apartmentLicenses: licensesData.apartmentLicenses,
    };

    const messages: any[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `Image OCR Text Results:\n` +
              trimmedImageData.map(({ buffer, text }) => `- ID: ${buffer.id}, Text: ${text}`).join('\n'),

            // text: `Image Data:\n${JSON.stringify(trimmedImageData, null, 2)}`,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `Dataset:\nLicenses Pool:\n` +
              trimmedLicensesData.licensesPool.map((l) => `${l.plate}-${l.stateShort}`).join(', ') +
              `\nApartment Licenses:\n` +
              trimmedLicensesData.apartmentLicenses.map((l) => `${l.plate}-${l.stateShort}`).join(', '),
            // text: `Dataset:\n${JSON.stringify(trimmedLicensesData, null, 2)}`,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptForAIReasoning(isOcrAi),
          },
        ],
      },
    ];

    // // Apply timeout to detect long processing
    // const timeoutPromise = new Promise((_, reject) =>
    //   setTimeout(() => reject(new Error('OpenAI request timed out after 60s')), 60000)
    // );

    const chatResponse = await openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages,
    });
    // timeoutPromise,

    const rawOutput = (chatResponse as any)?.choices?.[0]?.message?.content || '';
    const tokenUsage = (chatResponse as any)?.usage || {};

    let gptResults: LicensePlateResultAfterScan[] = [];

    try {
      const cleaned = rawOutput.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      gptResults = JSON.parse(cleaned);
    } catch (error) {
      console.warn('⚠️ Failed to parse GPT response:', error);
      gptResults = imageData.map(({ buffer }) => ({
        imageId: buffer.id,
        text: '',
        scoring: 0,
        case: 'negative',
        plateNumber: null,
        existsIn: null,
      }));
    }

    const responseWithBuffer: any[] = gptResults.map((result) => {
      const match = imageData.find((img) => img.buffer.id === result.imageId);
      return {
        ...result,
        buffer: match?.buffer || {},
        ocrText: match?.ocrText,
        ocr2Text: match?.ocr2Text,
      };
    });

    return {
      buffers: imageData.map((img) => img.buffer),
      response: responseWithBuffer,
      charactersLength: String(rawOutput.length),
      model: (chatResponse as any)?.model || 'unknown',
      tokensUsage: String(tokenUsage.completion_tokens || 0),
      inputTokens: tokenUsage.prompt_tokens || 0,
      outputTokens: tokenUsage.completion_tokens || 0,
      totalTokens: tokenUsage.total_tokens || 0,
    };
  } catch (error: any) {
    console.error('❌ GPT Error:', error.message);

    const fallbackResponse: any[] = imageData.map(({ buffer, ocr2Text, ocrText }) => ({
      imageId: buffer.id,
      text: '',
      ocr2Text,
      ocrText,
      scoring: 0,
      case: 'negative',
      plateNumber: null,
      existsIn: null,
      buffer,
    }));

    return {
      buffers: imageData.map((img) => img.buffer),
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

export const testGPT = async (): Promise<GPTDetails> => {
  const openai = new OpenAI({ apiKey: config.openAIApiKeyV4 });

  try {
    // Trim input data to avoid long token prompts

    console.log('🔄 Sending OpenAI request...');

    // // Apply timeout to detect long processing
    // const timeoutPromise = new Promise((_, reject) =>
    //   setTimeout(() => reject(new Error('OpenAI request timed out after 60s')), 60000)
    // );

    const chatResponse = await openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages: [
        {
          role: 'user',
          content: 'This is just testing the GPT model',
        },
      ],
    });
    // timeoutPromise,
    return chatResponse;
  } catch (error: any) {
    console.error('❌ GPT Error:', error.message);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
  }
};
