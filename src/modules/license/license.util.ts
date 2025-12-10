import { NextFunction, Request } from 'express';

import { ApiError } from '../errors';
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js';
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import FormData from 'form-data';
import { Readable } from 'stream';
import config from '../../config/config';
import fetch from 'node-fetch';
// Using built-in fetch (Node.js 18+)
import formidable from 'formidable';
import fs from 'fs/promises';
import httpStatus from 'http-status';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

export async function convertFilesToBuffers(files: any) {
  const buffers = await Promise.all(
    files.map(async (file: any) => {
      const buffer = await fs.readFile(file.filepath);
      return {
        // id: uuidv4(),
        id: file.id,

        originalFilename: file.originalFilename,
        mimetype: file.mimetype,
        size: file.size,
        buffer,
      };
    })
  );

  return buffers;
}

export const configiguration = {
  api: {
    bodyParser: false, // Required for formidable to work
  },
};

// Helper to convert buffer to stream
export function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// Read from Buffer and call Azure with error handling
async function extractPlateTextFromBlob(buffer: Buffer) {
  try {
    const computerVisionKey = config.computerVisionKey;
    const computerVisionEndPoint = config.computerVisionEndPoint;

    const credentials = new CognitiveServicesCredentials(computerVisionKey);
    const client = new ComputerVisionClient(credentials, computerVisionEndPoint);
    const readResult = await client.readInStream(buffer as any, {
      contentType: 'application/octet-stream', // or 'image/png'
    });

    const operationLocation = readResult.operationLocation!;
    const operationId = operationLocation.split('/').pop()!;

    let result;
    while (true) {
      result = await client.getReadResult(operationId);
      if (result.status === 'succeeded' || result.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const textResults = result.analyzeResult?.readResults
      ?.map((page: any) => page.lines?.map((line: any) => line.text).join('\n'))
      .join('\n');

    return textResults;
  } catch (error) {
    console.error('Error extracting plate text from blob:', error);
    throw new Error('Failed to extract plate text');
  }
}

export const scanningBlobWithAzure = async (buffers: any) => {
  try {
    const results = await Promise.all(
      buffers.map(async (buffer: any) => ({
        text: await extractPlateTextFromBlob(buffer?.buffer),
        buffer,
      }))
    );
    const plateTexts = results.map((result) => {
      // const result = results.text;
      // const detections = result.textAnnotations;
      // console.log('result', result, detections);

      // if (!result.text)
      //   return {
      //     text: null,
      //     buffer: result.buffer,
      //   };
      return {
        buffer: result.buffer,
        text: result.text,
      };
    });

    return plateTexts;
    // const extractedPlates = await processEachTextForPlate(texts as string[]);
    // const unique = getUniquePlates(extractedPlates);
    // return { message: 'success', texts, plates: unique, status: 200 };
  } catch (error) {
    console.error('Azure Vision Error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, ' ' + error);
  }
};

// export const scanningBlobWithGoogleVision = async (buffers: any) => {
//   try {
//     console.log('buffers', buffers);
//     const texts = await Promise.all(buffers.map((buffer: any) => extractPlateTextFromBlob(buffer)));
//     const extractedPlates = await processEachTextForPlate(texts as string[]);
//     const unique = getUniquePlates(extractedPlates);
//     return { message: 'success', texts, plates: unique, status: 200 };
//   } catch (error) {
//     console.error('Google Vision Error:', error);
//     return { message: 'success', error: 'Failed to describe image', details: error, status: 500 };
//   }
// };

// type PlateEntry = {
//   original: string;
//   plate: string | null;
// };

// function getUniquePlates(data: PlateEntry[]): PlateEntry[] {
//   const seen = new Set<string>();
//   const unique: PlateEntry[] = [];

//   for (const entry of data) {
//     // Skip if plate is null
//     if (!entry.plate) continue;

//     // Normalize plate value (e.g., trim and uppercase if needed)
//     const normalizedPlate = entry.plate.trim().toUpperCase();

//     if (!seen.has(normalizedPlate)) {
//       seen.add(normalizedPlate);
//       unique.push(entry);
//     }
//   }

//   return unique;
// }

export function processEachTextForPlate(textArray: string[]): { original: string; plate: string | null }[] {
  const platePatterns = [
    // /^[A-HJ-NPR-Z]{3}-?[0-9]{4}$/, // General-Issue,3 letters hyphen 4 digits (The Texas Classic)
    // /^[0-9][A-HJ-NPR-Z]{3}[0-9]{3}$/, // General-Issue,1 digit 3 letters 3 digits (The Texas Classic)
    // /^[A-HJ-NPR-Z]{3}-?[0-9]{4}$/, // Specialty,3 letters hyphen 4 digits (Generic Specialty)
    // /^[0-9][A-HJ-NPR-Z]{3}[0-9]{3}$/, // Specialty,1 digit 3 letters 3 digits (Generic Specialty)
    // /^DV-?[0-9]{4}$/, // Specialty,Disabled Veteran prefix hyphen 4 digits

    /[A-Z]{3}[-\s]?[0-9]{4}/, // GMN-8491
    /[0-9]{2}[-\s]?[A-Z]{2}[0-9]{3}/, // 96-DV105
  ];
  return textArray.map((raw) => {
    const cleaned = raw
      .toUpperCase()
      .replace(/\n/g, ' ')
      .replace(/\+/g, '-') // Replace OCR '+' with hyphen
      .replace(/[^\w\s-]/g, '') // Remove unwanted characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    let matchedPlate: string | null = null;

    for (const pattern of platePatterns) {
      const match = cleaned.match(pattern);
      console.log(pattern, 'pattern', match, 'match', cleaned, 'cleaned');
      if (match) {
        matchedPlate = match[0].replace(/\s/, '-'); // normalize spacing to hyphen
        break;
      }
    }
    return {
      original: raw,
      plate: matchedPlate,
    };
  });
}

export const imagesBlobsToBuffer = async (files: any): Promise<{ message: string; status: number; buffers: any[] }> => {
  // const form = formidable({ multiples: true });
  // return new Promise((resolve, reject) => {
  //   form.parse(req, async (err, _, files) => {
  //     if (err) {
  //       console.error(err, 'formidable error');
  //       return reject({ message: 'Form parsing error', status: 500 });
  //     }

  //     let fileArray = files['files'];
  //     if (!fileArray) {
  //       return reject({ message: 'Files are required', status: 500 });
  //     }
  //     fileArray = fileArray.map((file) => ({
  //       ...file,
  //       id: uuidv4(),
  //     }));

  //     try {
  //       resolve({ message: 'Parsing successful', status: 200, buffers });
  //     } catch (conversionError) {
  //       console.error(conversionError, 'conversion error');
  //       reject({ message: 'Buffer conversion error', status: 500 });
  //     }
  //   });
  // });

  const buffers: any = await convertFilesToBuffers(files);
  return { message: 'Parsing successful', status: 200, buffers };
};

export const imagesToFormData = (req: any): Promise<FormData> => {
  const form = formidable({ multiples: true });
  const formData = new FormData();
  return new Promise((resolve, reject) => {
    form.parse(req, async (err, _, files) => {
      if (err) {
        console.error(err, 'formidable error');
        return reject({ message: 'Form parsing error', status: 500 });
      }

      const fileArray = files['files'] ?? [];
      fileArray.forEach((file: any) => formData.append('files', file));
      if (!fileArray) {
        return reject({ message: 'Files are required', status: 500 });
      }

      try {
        resolve(formData);
      } catch (conversionError) {
        console.error(conversionError, 'conversion error');
        reject({ message: 'Buffer conversion error', status: 500 });
      }
    });
  });
};

export const promptForAIReasoning = (isOCRAI?: boolean, additionalData?: any) => {
  const prompt = `You are a license plate comparison system.

You will be given a list of OCR-extracted image texts (each with an imageId and a text field ${
    isOCRAI ? '' : `that contains result of the 3 OCR tools`
  }), and you must compare these texts against a dataset of known license plates.
${
  isOCRAI
    ? ''
    : 'The OCR texts are from 3 different OCR tools. The purpose of using 3 OCR tools is to eradicate the possibility of false positives or false negatives.'
}

The dataset consists of two groups:

apartmentLicenses – each item has:

plate: string

stateShort: string (e.g., "TX")

licensesPool – each item has:

plate: string

stateShort: string

Your task is to analyze each OCR text given in the field "text", compare it against the dataset, and return a structured JSON response containing a score and match result.

Matching & Scoring Logic:
For each OCR text, search for the best-matching plate and state combination using the following rules:

Score 10: Exact match of plate and state

Score 9.5 – 7: Fuzzy matches (e.g., partial match, OCR distortion, missing state)

Ignore case differences

Normalize known terms like "TEXAS" ≈ "TX"

Match only if a plate-like format exists in the OCR text

${additionalData ? additionalData : ''}
Use the highest scoring match only per image

Output Format:
Return a JSON array where each item corresponds to one image and follows this format:

{
  "imageId": "ID from OCR data",
  "text": "original OCR text",
  "scoring": number from 1 to 10,
  "case": "positive" | "negative",
  "matchedContent": "Part of the OCR text that matched the dataset (plate only, without state), or null if no match",
  "plateNumber": "matched plate from dataset or null, (plate only, without state)",
  "existsIn": "Apartment" | "LicensePool" | null
}
Rules:
The response should be generated only for the OCR data, not for the dataset. that means the length of the response should be equal to the length of the OCR data.

If scoring > 8.5, then "case" = "positive", else "negative"

If no valid plate match is found, set:

"scoring" = 0

"plateNumber" = null

"existsIn" = null

Always return only a valid JSON array.

Do not include any explanations, markdown, or extra text — only raw JSON.

Begin analysis now.You are a license plate comparison system.

You will be given a list of OCR-extracted image texts (each with an imageId and a text field), and you must compare these texts against a dataset of known license plates.

The dataset consists of two groups:

apartmentLicenses – each item has:

plate: string

stateShort: string (e.g., "TX")

licensesPool – each item has:

plate: string

stateShort: string

Your task is to analyze each OCR text given in the field "text", compare it against the dataset, and return a structured JSON response containing a score and match result.
Use the following scoring rules to evaluate how closely an OCR-extracted license plate and state match an entry from the dataset.

Matching & Scoring Rules:
Score 10

The OCR license plate and state exactly match the dataset entry.

Score 9.5

The license plate and state match except for special characters like -, +, *, ., or spaces.

Example: DV-105 vs DV105

Score 9.0

Same as above, but with one additional alphanumeric character mismatch (e.g., one extra, missing, or incorrect character).

Example: DV-106 vs DV105

Score 8.5

Same as above, but with two alphanumeric character mismatches in addition to special characters.

Example: D-V1069 vs DV105

Score 5

The OCR text appears to be a valid license plate format, but no matching entry is found in the dataset.

Score 0

The OCR text is not a valid license plate, and there is also no match found in the dataset.

Ignore case differences

Normalize known terms like "TEXAS" ≈ "TX"

Match only if a plate-like format exists in the OCR text

Use the highest scoring match only per image

Output Format:
Return a JSON array where each item corresponds to one image and follows this format:

{
  "imageId": "ID from OCR data",
  "text": "original OCR text",
  "scoring": number from 1 to 10,
  "case": "positive" | "negative",
  "plateNumber": "matched plate from dataset or null",
  "existsIn": "Apartment" | "LicensePool" | null
}
Rules:
If scoring > 8.5, then "case" = "positive", else "negative"

If no valid plate match is found, set:

"scoring" = 0

"plateNumber" = null

"existsIn" = null

Always return only a valid JSON array.

Do not include any explanations, markdown, or extra text — only raw JSON.

Begin analysis now.`;

  return prompt;
};

export const uploadMiddleware = multer({ storage: multer.memoryStorage() }) ; // keep in memory for forwarding
export interface FileWithUUID extends Express.Multer.File {
  uuid: string;
}
export const addUUIDToFiles = async (req: Request, res: Response, next: NextFunction) =>{
  if (!req.files) return next();
res
  const files = req.files as Express.Multer.File[];

  files.forEach((file: any) => {
    const uuid = uuidv4();
    file.id = uuid; // ✅ Add the UUID
    file.originalname = `${uuid}_${file.originalname}`; // Optional renaming
  });

  next();
};

export const customOCR = async (req: Request, api:string = 'alpr') => {
  const { hasCroppedImages = 'true', hasHighlightedImages = 'false' } = req.query;

  const form = new FormData();

  // Append files from req.files
  (req.files as Express.Multer.File[]).forEach((file) => {
    form.append('files', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
  });

  try {
    const res = await fetch(
      `${config.customOCRURL}/${api}?hasCroppedImages=${hasCroppedImages}&hasHighlightedImages=${hasHighlightedImages}`,
      {
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          Authorization: req.headers['authorization'] as string,
          xApiKey: req.headers['x-api-key'] as string,
          serverType: config.serverType,
        },
        body: form,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(text, 'response body error');
      throw new Error('Server Error');
    }

    return await res.json();
  } catch (err) {
    console.error(err, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'OCR Server is down at the moment, please try again later');
  }
};
