import { Request, Response } from 'express';

import { ALL_EVENTS } from '../utils/events';
import { ApiError } from '../errors';
import { IoSocket } from '../../app';
import { Message } from '../utils/errorMessage';
import { User } from '../user';
import { catchAsync } from '../utils';
import { delayFunction } from '../utils/delayFunction';
import { emailService } from '.';
import { emailTemplate } from './Template/email-template';
import httpStatus from 'http-status';
import { isValidObjectId } from 'mongoose';
import { logService } from '../logs';
import { unsubService } from '../unsubscribe';

export const sendContactSupportEmail = catchAsync(async (req: Request, res: Response) => {
  const admins = await User.find({ $or: [{ userType: 'admin' }, { userType: 'superadmin' }] });
  const preferredLanguage = req.body['preferredLanguage'] || 'english';
  Promise.allSettled(
    admins.map(
      async (admin) =>
        await emailService.sendContactSupportEmail({ ...req.body, to: admin?.email, toName: admin.fullName, user: admin })
    )
  );

  res.send({ message: Message.business.emailSent[preferredLanguage], code: 200 });
});

export const sendContactSupportEmailForHuntItServices = catchAsync(async (req: Request, res: Response) => {
  const preferredLanguage = req.body['preferredLanguage'] || 'english';
  await emailService.sendContactSupportEmailForHuntItServices({
    ...req.body,
    // to: 'faisalseraj47@gmail.com',

    to: 'contact@huntitservices.com',
    toName: 'Paul',
  });

  res.send({ message: Message.business.emailSent[preferredLanguage], code: 200 });
});

export const sendTemplatedEmail = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const direction = (req.body['language'] ?? 'en') === 'ar' || (req.body['language'] ?? 'en') === 'he' ? 'rtl' : 'ltr';
  const response = await emailService.sendTemplateEmail({ ...req.body, direction });
  if (response.success) {
    await logService.createCommunicationLog({
      user: req.user!,

      event: ALL_EVENTS.userCommunication.EmailSent,
      eventEnum: 'ComE',
      receiverDetails: {
        content: response.email,
        sentTo: email,
        type: 'email',
        name: req.user.fullName!,
      },
    });
    res.send({ message: 'Email sent', code: 200 });
  } else {
    await logService.createCommunicationLog({
      user: req.user!,

      event: ALL_EVENTS.userCommunication.EmailSendingFailed,
      eventEnum: 'ComE',
      receiverDetails: {
        content: response.email,
        sentTo: email,
        isFailed: true,
        type: 'email',
        name: req.user.fullName!,
      },
    });
    res.send({ message: 'Something went wrong while sending email', code: 400 });
  }
});

export const sendAnonymousTemplatedEmail = catchAsync(async (req: Request, res: Response) => {
  const preferredLanguage = req.body.language;
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  const direction = (req.body['language'] ?? 'en') === 'ar' || (req.body['language'] ?? 'en') === 'he' ? 'rtl' : 'ltr';

  const response = await emailService.sendTemplateEmail({ ...req.body, direction });
  const { email, receiverName = 'API Recepient' } = req.body;
  const apiKey = req.headers['x-api-key'] as string; // Assuming the API key is sent in the 'Authorization' header.
  if (response.success) {
    await logService.createAnonymousEmailLog({
      apiKey,
      event: ALL_EVENTS.userCommunication.EmailSentViaKey,
      name: receiverName,
      receiverDetails: {
        content: response.email,
        sentTo: email,
        type: 'email',
        name: receiverName,
      },
    });

    res.send({ message: Message.business.emailSent[language], code: 200 });
  } else {
    await logService.createAnonymousEmailLog({
      apiKey,
      event: ALL_EVENTS.userCommunication.EmailSentViaKey,
      name: receiverName,
      receiverDetails: {
        content: response.email,
        sentTo: email,
        isFailed: true,
        type: 'email',
        name: receiverName,
      },
    });
    res.send({ message: 'Something went wrong while sending email', code: 400 });
  }
});

export const sendAnonymousTemplatedEmailWithAttachment = catchAsync(async (req: Request, res: Response) => {
  const direction = (req.body['language'] ?? 'en') === 'ar' || (req.body['language'] ?? 'en') === 'he' ? 'rtl' : 'ltr';

  ['email', 'subject', 'content', 'receiverName', 'fileName'].map((item: string) => {
    if (!req.body[item]) throw new ApiError(httpStatus.FORBIDDEN, `${item} is required`);
  });

  try {
    const { originalname, buffer, mimetype } = req?.file ?? ({} as any);
    if (!originalname || !buffer || !mimetype) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Attachment is required');
    }
    const apiKey = req.headers['x-api-key'] as string;
    const bufferToString = Buffer.from(buffer);
    const base64String = bufferToString.toString('base64');

    let attachment: any = {};
    if (req?.file) {
      attachment = {
        filename: req.body.fileName,
        content: base64String,
        type: mimetype,
      };
    }

    const emailData = {
      ...req.body,
      receiverName: req?.body?.receiverName ?? 'API Recepient',
      direction,
      attachment, // Add the attachment to the email data
    };

    try {
      await emailService.sendTemplatedEmailWithAttachment(emailData);
      const { email, subject, content, receiverName = 'API Recepient' } = req.body;

      // Email sent successfully; now delete the uploaded file
      await logService.createAnonymousEmailLog({
        apiKey,
        event: ALL_EVENTS.userCommunication.EmailSentViaKey,
        name: receiverName,
        receiverDetails: {
          content: `Subject: ${subject} <br/> Body: ${content}`,
          sentTo: email,
          type: 'email',
          name: receiverName,
        },
      });
      res.send({ message: 'Email sent', code: 200 });
    } catch (error) {
      console.log(error, 'error');
      // Handle any errors that occur during email sending
      res.status(500).send({ message: 'Email sending failed', code: 500 });
    }
  } catch (e) {
    console.log(e, 'error is hereeeeee :::::: ');
    throw new ApiError(500, JSON.stringify(e) + 'Error');
  }
});

export const sendTemplatedEmailWithAttachment = catchAsync(async (req: Request, res: Response) => {
  // Ensure required fields are present in the request body
  ['userIds', 'subject', 'content'].forEach((item: string) => {
    if (!req.body[item]) throw new ApiError(httpStatus.FORBIDDEN, `${item} is required`);
  });

  const channelId = req.body['channelId'];
  const language = req.body['language'] ?? 'en';
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const userIds = req.body['userIds'].split(',');

  let successfullCount = 0;
  let failedCount = 0;
  let invalidCount = 0;
  let unsubscribedCount = 0;

  // Validate each userId
  userIds.forEach((id: string) => {
    if (!isValidObjectId(id)) {
      throw new ApiError(httpStatus.FORBIDDEN, `${id} is not a valid mongo object id`);
    }
  });

  try {
    let attachment: any = {};
    if (req?.file) {
      const { originalname, buffer, mimetype } = req?.file ?? ({} as any);
      if (!originalname || !buffer || !mimetype) {
        throw new ApiError(httpStatus.FORBIDDEN, 'File cannot be empty is required');
      }
      const bufferToString = Buffer.from(buffer as any);
      const base64String = bufferToString.toString('base64');

      attachment = {
        filename: originalname,
        content: base64String,
        type: mimetype,
      };
    }

    const failed: any = [];
    const unknownIds: any = [];
    const sent: any = [];
    let templatedContent: any = '';
    const unsubscribedEmails: any = [];

    try {
      const users = await User.find({ _id: { $in: userIds } });
      const unsubs = await unsubService.getUnsubsEmails();

      // Send emails sequentially
      for (let index = 0; index < userIds.length; index++) {
        const userId = userIds[index];
        const user = users.find(({ id }) => id === userId);

        if (!user?.email) {
          unknownIds.push(userId);
        } else {
          if (unsubs.includes(user?.email)) {
            unsubscribedEmails.push({
              fullName: 'User -- email campaign',
              email: user?.email,
              id: user?.email,
            });
            unsubscribedCount++;
            if (channelId) {
              IoSocket.emit(channelId, {
                successfullCount,
                failedCount,
                sentCount: successfullCount + failedCount,
                invalidCount,
                unsubscribedCount,
                currentEmailSendingIndex: index,
                total: userIds?.length,
                progress: Math.floor(((index + 1) / userIds?.length) * 100),
              });
            }
          } else {
            try {
              const emailData = {
                ...req.body,
                email: user.email,
                receiverName: user.fullName,
                direction,
                attachment: req?.file ? attachment : undefined, // Add the attachment to the email data
              };

              await delayFunction(1000);

              templatedContent = await emailService.sendTemplatedEmailWithAttachment(emailData);

              sent.push({
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                id: user?._id ?? user?.id,
              });
              successfullCount++;

              if (channelId) {
                IoSocket.emit(channelId, {
                  successfullCount,
                  failedCount,
                  sentCount: successfullCount + failedCount,
                  invalidCount,
                  unsubscribedCount,
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
              failedCount++;
              if (channelId) {
                IoSocket.emit(channelId, {
                  successfullCount,
                  failedCount,
                  sentCount: successfullCount + failedCount,
                  invalidCount,
                  unsubscribedCount,
                  currentEmailSendingIndex: index,
                  total: userIds?.length,
                  progress: Math.floor(((index + 1) / userIds?.length) * 100),
                });
              }
            }
          }
        }
      }

      // Create the email template content
      templatedContent = await emailTemplate({ title: req.body.subject, content: req.body.content, direction });
      templatedContent;
      // const receivers = sent.map((details: any) => details.email).join(', ');
      // const failedReceivers = failed.map((details: any) => details.email).join(', ');
      // Log successful emails
      // if (sent.length > 0) {
      //   await logService.createCommunicationLog({
      //     user: req.user!,
      //     event: ALL_EVENTS.userCommunication.emailCampaign(sent, failed, userIds.length, unknownIds),
      //     eventEnum: 'ComE',
      //     receiverDetails: {
      //       content: `Subject: ${req.body.subject} <br/> Body: ${templatedContent}`,
      //       sentTo: receivers,
      //       isFailed: false,
      //       type: 'email',
      //       name: req.user.fullName!,
      //     },
      //   });
      // }

      // // Log failed emails
      // if (failed.length > 0) {
      //   await logService.createCommunicationLog({
      //     user: req.user!,
      //     event: ALL_EVENTS.userCommunication.emailCampaign(sent, failed, userIds.length, unknownIds),
      //     eventEnum: 'ComE',
      //     receiverDetails: {
      //       content: `Subject: ${req.body.subject} <br/> Body: ${templatedContent}`,
      //       sentTo: failedReceivers,
      //       isFailed: true,
      //       type: 'email',
      //       name: req.user.fullName!,
      //     },
      //   });
      // }

      res.send({ message: 'Email sent', failed, sent, unknownIds, unsubscribedEmails, code: 200 });
    } catch (error) {
      console.log(error, 'error');
      // Handle any errors that occur during email sending
      res.status(500).send({ message: 'Email sending failed', code: 500 });
    }
  } catch (e) {
    console.log(e, 'error is hereeeeee :::::: ');
    throw new ApiError(500, JSON.stringify(e) + 'Error');
  }
});

const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailCampaignUsingEmails = catchAsync(async (req: Request, res: Response) => {
  // Ensure required fields are present in the request body
  ['emails', 'subject', 'content'].forEach((item: string) => {
    if (!req.body[item]) throw new ApiError(httpStatus.FORBIDDEN, `${item} is required`);
  });
  const channelId = req.body['channelId'];
  const language = req.body['language'] ?? 'en';
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const unsubs = await unsubService.getUnsubsEmails();
  let emails = req.body['emails'].split(',');
  // const emailsToLog = req.body['emails'];
  const invalidEmails: any = [];
  const unsubscribedEmails: any = [];
  let successfullCount = 0;
  let failedCount = 0;
  let invalidCount = 0;
  let unsubscribedCount = 0;

  // Filter invalid and unsubscribed emails
  emails = emails
    .map((email: string, index: number) => {
      if (!regex.test(`${email}`)) {
        invalidEmails.push({
          fullName: 'User -- email campaign',
          email: email,
          id: email,
        });
        invalidCount++;
        return null;
      }
      if (unsubs.includes(email)) {
        unsubscribedEmails.push({
          fullName: 'User -- email campaign',
          email: email,
          id: email,
        });
        unsubscribedCount++;
        if (channelId) {
          IoSocket.emit(channelId, {
            successfullCount,
            failedCount,
            sentCount: successfullCount + failedCount,
            invalidCount,
            unsubscribedCount,
            currentEmailSendingIndex: index,
            total: emails?.length,
            progress: Math.floor(((index + 1) / emails?.length) * 100),
          });
        }
        return null;
      }
      return email;
    })
    .filter((email: string) => email);

  try {
    // Process file attachment if present
    let attachment: any = {};
    if (req?.file) {
      const { originalname, buffer, mimetype } = req?.file ?? ({} as any);
      if (!originalname || !buffer || !mimetype) {
        throw new ApiError(httpStatus.FORBIDDEN, 'File cannot be empty is required');
      }
      const bufferToString = Buffer.from(buffer as any);
      const base64String = bufferToString.toString('base64');

      attachment = {
        filename: originalname,
        content: base64String,
        type: mimetype,
      };
    }

    const failed: any = [];
    const sent: any = [];

    let templatedContent: any = '';
    templatedContent;
    // Send emails sequentially
    for (let index = 0; index < emails?.length; index++) {
      const email = emails[index];
      try {
        const emailData = {
          ...req.body,
          email: email,
          receiverName: 'Multi User -- email campaign',
          direction,
          attachment: req?.file ? attachment : undefined, // Add the attachment to the email data
        };
        await delayFunction(2000);
        templatedContent = await emailService.sendTemplatedEmailWithAttachmentV3(emailData);
        sent.push({
          fullName: 'User -- email campaign',
          email: email,
          id: email,
        });

        successfullCount++;
        if (channelId) {
          IoSocket.emit(channelId, {
            successfullCount,
            failedCount,
            sentCount: successfullCount + failedCount,
            invalidCount,
            unsubscribedCount,
            currentEmailSendingIndex: index,
            total: emails?.length,
            progress: Math.floor(((index + 1) / emails?.length) * 100),
          });
        }
      } catch (e) {
        failed.push({
          fullName: 'User -- email campaign',
          email: email,
          id: email,
        });

        failedCount++;
        if (channelId) {
          IoSocket.emit(channelId, {
            successfullCount,
            failedCount,
            sentCount: successfullCount + failedCount,
            invalidCount,
            unsubscribedCount,
            currentEmailSendingIndex: index,
            total: emails?.length,
            progress: Math.floor(((index + 1) / emails?.length) * 100),
          });
        }
      }
    }

    // Create communication log
    // await logService.createCommunicationLog({
    //   user: req.user!,
    //   event: ALL_EVENTS.userCommunication.emailCampaignCSV(
    //     sent,
    //     failed,
    //     emailsToLog?.split(',')?.length,
    //     [],
    //     invalidEmails,
    //     unsubscribedEmails
    //   ),
    //   eventEnum: 'ComE',
    //   receiverDetails: {
    //     content: `Subject: ${req.body.subject} <br/> Body: ${templatedContent}`,
    //     sentTo: emailsToLog,
    //     isFailed: false,
    //     type: 'email',
    //     name: req.user.fullName!,
    //   },
    // });

    res.send({ message: 'Email sent', failed, sent, code: 200, invalidEmails, unsubscribedEmails });
  } catch (error) {
    console.log(error, 'error');
    res.status(500).send({ message: 'Email sending failed', code: 500 });
  }
});
