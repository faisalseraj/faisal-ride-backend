import { IAPIKey, IAPIKeyDoc } from './apiKeys.interfaces';

import APIKey from './apiKeys.model';
import { ApiError } from '../errors';
// import { formatByHours } from './clicks.util';
import crypto from 'crypto';
import httpStatus from 'http-status';

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}
/**
 * Create a Clicks
 * @param {IapiKeyDoc} apiKey
 * @returns {Promise<IAPIKeyDoc>}
 */
export const createAPIKey = async (): Promise<IAPIKeyDoc> => {
  let clicksBody: IAPIKey = {
    allowedUsage: 1000000 * 100,
    currentUsage: 0,
    apiKey: generateApiKey(),
  };

  return APIKey.create(clicksBody);
};

/**
 * Create a Clicks
 * @param {IapiKeyDoc} apiKey
 * @returns {Promise<boolean>}
 */
export const validateAPIKey = async (apiKey: string): Promise<boolean> => {
  const isKeyValid = await APIKey.findOne({ apiKey });

  if (isKeyValid?.id) {
    if (isKeyValid.allowedUsage < isKeyValid.currentUsage) {
      throw new ApiError(httpStatus.UNAVAILABLE_FOR_LEGAL_REASONS, 'APIKey Limit Reached');
    }
    isKeyValid.currentUsage = isKeyValid.currentUsage + 1;
    await isKeyValid.save();
    return true;
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid APIKey');
  }
};
