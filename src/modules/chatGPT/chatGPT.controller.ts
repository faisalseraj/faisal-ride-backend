import * as chatGPTService from './chatGPT.service';

import { Request, Response } from 'express';

import { ALL_EVENTS } from '../utils/events';
import { ApiError } from '../errors';
// import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import { createGPTLog } from '../logs/log.service';
import { getIpFromHeader } from '../auth/auth.helper';
import { imagesBlobsToBuffer } from '../license/license.util';
import { instructionGuidesKeys } from './util';
import pick from 'lodash/pick';

export const queryChatGPT = catchAsync(async (req: Request, res: Response) => {
  const userIP = getIpFromHeader(req);
  const user = req.user;

  const options = pick(req.query, [
    'prompt',
    'model',
    'maxCharacters',
    'type',
    'language',
    'businessName',
    'itemName',
    'serviceName',
    'chatId',
    'additionalData',
  ]);

  const result = await chatGPTService.queryChatGPT(
    user.id,
    options['prompt'] as string,
    options['model'] as string,
    options['maxCharacters'] as unknown as number,
    options['type'] as unknown as instructionGuidesKeys,
    options['language'] as string,
    ''
  );

  await createGPTLog({
    user,
    event: ALL_EVENTS.AI.GPTQuery(result),
    eventEnum: 'GPTE',
    GPTDetails: result,
    ipAddress: userIP,
    userType: user.userType,
  });

  res.send(result);
});

export const ocrScanningForLicensePlate = catchAsync(async (req: Request, res: Response) => {
  try {
    const buffers = await imagesBlobsToBuffer(req);
    // const tobase64 = buffers?.buffers?.map((it) => it.buffer?.toString('base64'));

    const result = await chatGPTService.scanOCR(buffers?.buffers as any);

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

export const testGPT = catchAsync(async (_: Request, res: Response) => {
  try {
    const result = await chatGPTService.testGPT();

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
