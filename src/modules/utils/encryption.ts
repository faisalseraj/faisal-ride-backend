import { ApiError } from '../errors';
import CryptoJS from 'crypto-js';
import config from '../../config/config';
import httpStatus from 'http-status';

// Function to encrypt email
const secretKey = config.jwt.secret;
export function encryptEmail(email: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(email, secretKey).toString();
    return encrypted;
  } catch (e) {
    console.log(e);
    return '';
  }
}

// Function to decrypt email
export function decryptEmail(encryptedEmail: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedEmail, secretKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Could not decode token' + e?.message);
  }
}
