import { ApiError } from '../errors';
import config from '../../config/config';
import httpStatus from 'http-status';
import vision from '@google-cloud/vision';

export const licenseCreate = async () => {
  return 'success';
};

const credentials = JSON.parse(Buffer.from(config.googleVisionOcrKey, 'base64').toString('utf8'));
// Creates a client

// Function to extract text from multiple images
export async function extractLicensePlateTextWithGoogleVision(buffers: any[]) {
  try {
    const client = new vision.ImageAnnotatorClient({
      credentials,
    });


    const results = await Promise.all(
      buffers.map(async (buffer) => ({
        text: await client.textDetection(buffer?.buffer),
        buffer,
      }))
    );
    const plateTexts = results.map((results) => {
      const [result] = results.text;
      const detections = result.textAnnotations;
      if (!detections || detections.length === 0)
        return {
          text: null,
          buffer: results.buffer,
        };
      const plateText = detections?.[0]?.description?.trim()?.replace(/\s/g, '');
      return {
        buffer: results.buffer,
        text: plateText,
      };
    });
    return plateTexts.filter((text) => text.text !== null);
  } catch (e) {
    console.log(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, ' ' + e);
  }
}

export async function extractLicensePlateTextWithGoogleVisionSingle(buffer: string) {
  const client = new vision.ImageAnnotatorClient({
    credentials,
  });

  const [result] = await client.textDetection(buffer);
  const detections = result.textAnnotations;

  if (detections === null || detections === undefined || detections?.length === 0) return null;

  // The first element usually contains full detected string
  const plateText = detections?.[0]?.description?.trim()?.replace(/\s/g, '');
  return plateText;
}
