import {
  CreatePasskeyData,
  IPasskeyDoc,
  ValidatePasskeyData,
} from './passkey.interfaces';

import { ApiError } from '../errors';
import { Passkey } from './passkey.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Create a new passkey for a PSP-TowCompany pair
 */
export const createPasskey = async (data: CreatePasskeyData): Promise<IPasskeyDoc> => {
  const { pspId, towCompanyId, passkey } = data;

  // Validate passkey format
  if (!/^\d{4}$/.test(passkey)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Passkey must be exactly 4 digits');
  }

  // Check if passkey already exists for this PSP-TowCompany pair
  const existingPasskey = await Passkey.findOne({
    pspId: new mongoose.Types.ObjectId(pspId),
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
  });

  if (existingPasskey) {
    // Update existing passkey
    existingPasskey.passkey = passkey;
    existingPasskey.updatedAt = new Date();
    return await existingPasskey.save();
  }

  // Create new passkey
  const newPasskey = new Passkey({
    pspId: new mongoose.Types.ObjectId(pspId),
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
    passkey,
  });

  return await newPasskey.save();
};

/**
 * Validate a passkey for a PSP-TowCompany pair
 */
export const validatePasskey = async (data: ValidatePasskeyData): Promise<boolean> => {
  const { pspId, towCompanyId, passkey } = data;

  const passkeyRecord = await Passkey.findOne({
    pspId: new mongoose.Types.ObjectId(pspId),
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
  });

  if (!passkeyRecord) {
    return false; // No passkey set for this PSP
  }

  return passkeyRecord.passkey === passkey;
};

/**
 * Check if a PSP requires a passkey for a specific tow company
 */
export const checkPasskeyRequirement = async (pspId: string, towCompanyId: string): Promise<boolean> => {
  const passkeyRecord = await Passkey.findOne({
    pspId: new mongoose.Types.ObjectId(pspId),
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
  });

  return !!passkeyRecord;
};

/**
 * Get passkey for a PSP-TowCompany pair (for admin purposes)
 */
export const getPasskey = async (pspId: string, towCompanyId: string): Promise<IPasskeyDoc | null> => {
  return await Passkey.findOne({
    pspId: new mongoose.Types.ObjectId(pspId),
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
  });
};

/**
 * Delete passkey for a PSP-TowCompany pair
 */
export const deletePasskey = async (pspId: string, towCompanyId: string): Promise<boolean> => {
  const result = await Passkey.deleteOne({
    pspId: new mongoose.Types.ObjectId(pspId),
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
  });

  return result.deletedCount > 0;
};

/**
 * Get all passkeys for a specific PSP
 */
export const getPasskeysForPSP = async (pspId: string): Promise<IPasskeyDoc[]> => {
  return await Passkey.find({
    pspId: new mongoose.Types.ObjectId(pspId),
  }).populate('towCompanyId', 'companyName email');
};

/**
 * Get all passkeys for a specific tow company
 */
export const getPasskeysForTowCompany = async (towCompanyId: string): Promise<IPasskeyDoc[]> => {
  return await Passkey.find({
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
  }).populate('pspId', 'companyName email');
};
