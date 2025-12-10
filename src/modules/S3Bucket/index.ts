import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { ApiError } from '../errors';
import config from '../../config/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import httpStatus from 'http-status';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});
// 📤 Upload API
export async function uploadFileToS3(file: Express.Multer.File): Promise<{ key: string }> {
  const key = `tow-request-${Date.now()}-${file.originalname}`;

  const command = new PutObjectCommand({
    Bucket: config.aws.s3BucketTowRequests,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return { key };
}

// 📥 Get file (Presigned URL for display)
export async function getFileFromS3(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.aws.s3BucketTowRequests,
    Key: key,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 * 24 * 7 }); // 1 hour expiry
  return url;
}

export async function uploadBase64ToS3(base64Str: string, key: string): Promise<{ key: string }> {
  if (!base64Str) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Empty base64 string');
  }

  let base64Data: any = base64Str;

  // Case 1: Already a full data URI (camera/gallery)
  if (base64Str.startsWith('data:image')) {
    base64Data = base64Str.split(',')[1]; // split off the prefix
  }

  // Case 2: Sometimes Android camera gives you "file://" or "content://"
  if (base64Str.startsWith('file://') || base64Str.startsWith('content://')) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Got file path instead of base64, need to read file & encode');
  }

  // Now decode
  let buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid base64 string');
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3BucketTowRequests,
      Key: key,
      Body: buffer,
      ContentType: 'image/png', // adjust if JPEG
    });

    await s3.send(command);

    return { key };
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload to S3');
  }
}
