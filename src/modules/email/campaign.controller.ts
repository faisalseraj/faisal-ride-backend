import { Request, Response } from 'express';

// import { ALL_EVENTS } from '../utils/events';
import { ApiError } from '../errors';
import { IoSocket } from '../../app';
import { User } from '../user';
import { catchAsync } from '../utils';
import { delayFunction } from '../utils/delayFunction';
import httpStatus from 'http-status';
import { isValidObjectId } from 'mongoose';
// import { logService } from '../logs';
import { otpService } from '../otp';

export const sendCampaignSMS = catchAsync(async (req: Request, res: Response) => {
  const userIds = req.body['userIds'];
  const channelId = req.body['channelId'];
  userIds.forEach((id: string) => {
    if (!isValidObjectId(id)) {
      throw new ApiError(httpStatus.FORBIDDEN, `${id} is not a valid mongo object id`);
    }
  });

  try {
    const failed: any = [];
    const unknownIds: any = [];
    const sent: any = [];

    try {
      const users = await User.find({ _id: { $in: userIds } });
      let successfullCount = 0;
      let failedCount = 0;
      let sentCount = 0;
      let unknownCount = 0;

      for (let index = 0; index < userIds.length; index++) {
        const userId = userIds[index];
        const user = users.find(({ id }) => id === userId);

        if (!user?.phoneNumber) {
          unknownCount += 1;
          unknownIds.push(userId);
        } else {
          try {
            await delayFunction(2000);
            const isSent = await otpService.sendMessage(user.phoneNumber, req.body['message']);
            sentCount += 1;
            if (isSent) {
              sent.push({
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                id: user?._id ?? user?.id,
              });
              successfullCount += 1;
            } else {
              failed.push({
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                id: user?._id ?? user?.id,
              });
              failedCount += 1;
            }
            if (channelId) {
              IoSocket.emit(channelId, {
                successfullCount,
                failedCount,
                sentCount,
                unknownCount,
                currentEmailSendingIndex: index,
                total: userIds?.length,
                progress: Math.floor(((index + 1) / userIds?.length) * 100),
              });
            }
          } catch (e) {
            failed.push({
              email: user.email,
              fullName: user.fullName,
              phoneNumber: user.phoneNumber,
              id: user?._id ?? user?.id,
            });
            failedCount += 1;

            if (channelId) {
              IoSocket.emit(channelId, {
                successfullCount,
                failedCount,
                sentCount,
                unknownCount,
                currentEmailSendingIndex: index,
                total: userIds?.length,
                progress: Math.floor(((index + 1) / userIds?.length) * 100),
              });
            }
          }
        }
      }

      if (sent?.length > 0) {
        const receivers = sent.map((details: any) => String(details.phoneNumber)).join(',');
        receivers;
        // await logService.createCommunicationLog({
        //   user: req.user!,
        //   event: ALL_EVENTS.userCommunication.smsCampaign(sent, failed, userIds?.length, unknownIds),
        //   eventEnum: 'ComE',
        //   pribibitPhoneChange: true,
        //   country: 'Global',
        //   receiverDetails: {
        //     content: req.body['message'],
        //     sentTo: receivers,
        //     isFailed: false,
        //     type: 'phoneNumber',
        //     name: req.user.fullName!,
        //   },
        // });
      }

      if (failed?.length > 0) {
        const failedReceivers = failed.map((details: any) => String(details.phoneNumber)).join(',');
        failedReceivers;
        // await logService.createCommunicationLog({
        //   user: req.user!,
        //   event: ALL_EVENTS.userCommunication.smsCampaign(sent, failed, userIds?.length, unknownIds),
        //   eventEnum: 'ComE',
        //   pribibitPhoneChange: true,
        //   country: 'Global',
        //   receiverDetails: {
        //     content: req.body['message'],
        //     sentTo: failedReceivers,
        //     isFailed: true,
        //     type: 'phoneNumber',
        //     name: req.user.fullName!,
        //   },
        // });
      }

      res.send({ message: 'SMS sent', failed, sent, unknownIds, code: 200 });
    } catch (error) {
      console.log(error, 'error');
      res.status(500).send({ message: 'SMS sending failed', code: 500 });
    }
  } catch (e) {
    console.log(e, 'error is hereeeeee :::::: ');
    throw new ApiError(500, JSON.stringify(e) + 'Error');
  }
});
