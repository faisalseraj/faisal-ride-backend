import * as xAIService from './xAI.service';

import { Request, Response } from 'express';

import { ApiError } from '../errors';
// import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import { imagesBlobsToBuffer } from '../license/license.util';

export const ocrScanningForLicensePlate = catchAsync(async (req: Request, res: Response) => {
  try {
    const buffers = await imagesBlobsToBuffer(req);
    // const tobase64 = buffers?.buffers?.map((it) => it.buffer?.toString('base64'));

    const result = await xAIService.scanOCR(buffers?.buffers as any);

    // await createGPTLog({
    //   user,
    //   event: ALL_EVENTS.AI.GPTQuery(result),
    //   eventEnum: 'GPTE',
    //   GPTDetails: result,
    //   ipAddress: userIP,
    //   userType: user.userType,
    // });

    res.send(result);
  } catch (error) {
    console.log(error, 'error is here');
    throw new ApiError(500, JSON.stringify(error) + 'Error');
  }
});
