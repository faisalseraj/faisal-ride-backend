import { ApiError } from '../errors';
import { apiKeysService } from '.';
import { catchAsync } from '../utils';
import httpStatus from 'http-status';

const authenticateApiKey = catchAsync(async (req: any, _: any, next: any) => {
  const apiKey = req.headers['x-api-key']; // Assuming the API key is sent in the 'Authorization' header.

  if (!apiKey) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'APIKey is required');
  }

  await apiKeysService.validateAPIKey(apiKey);

  next();
});

export default authenticateApiKey;
