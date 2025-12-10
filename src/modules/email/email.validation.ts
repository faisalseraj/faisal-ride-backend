import {
  SendContactSupportEmail,
  SendTemplatedEmail,
  SendTemplatedEmailV2,
  SendTemplatedEmailWithAttachment,
  SendTemplatedEmailWithAttachmentV2,
} from './email.interfaces';

import Joi from 'joi';
import { objectId } from '../validate';

export const contactSupportEmailBody: Record<keyof SendContactSupportEmail, any> = {
  email: Joi.string().email(),
  phoneNumber: Joi.string(),
  name: Joi.string().required(),
  subject: Joi.string().required(),
  description: Joi.string().required(),
  preferredLanguage: Joi.string(),
};

export const contactSupportEmailBodyForHuntItservices = {
  email: Joi.string().email(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  company: Joi.string().required(),
};

export const sendTemplatedEmail: Record<keyof SendTemplatedEmail, any> = {
  email: Joi.string().email(),
  subject: Joi.string().required(),
  content: Joi.string().required(),
  receiverName: Joi.string(),
  link: Joi.string(),
  linkTitle: Joi.string(),
  language: Joi.string(),
};

export const smsCampaign = {
  message: Joi.string(),
  channelId: Joi.string(),
  userIds: Joi.array().items(Joi.string().custom(objectId)),
};

export const sendTemplatedEmailV2: Record<keyof SendTemplatedEmailV2, any> = {
  email: Joi.string().email(),
  subject: Joi.string().required(),
  content: Joi.string().required(),
  receiverName: Joi.string(),
  link1: Joi.string(),
  linkTitle1: Joi.string(),
  link1Color: Joi.string(),
  link2: Joi.string(),
  linkTitle2: Joi.string(),
  link2Color: Joi.string(),
  language: Joi.string(),
};

export const sendTemplatedEmailWithAttachment: Record<keyof SendTemplatedEmailWithAttachment, any> = {
  email: Joi.string().email(),
  subject: Joi.string().required(),
  content: Joi.string().required(),
  receiverName: Joi.string(),
  link: Joi.string(),
  language: Joi.string(),
  linkTitle: Joi.string(),
  direction: Joi.string(),
  file: Joi.string().required(),
  fileName: Joi.string().required(),
  attachment: Joi.object().keys({
    filename: Joi.string().required(),
    content: Joi.string().base64().required(),
    type: Joi.string().required(),
  }),
};

export const sendTemplatedEmailWithAttachmentInternal = {
  userIds: Joi.array(),
  subject: Joi.string().required(),
  content: Joi.string().required(),
  file: Joi.string(),
  // attachment: Joi.object().keys({
  //   filename: Joi.string().required(),
  //   content: Joi.string().base64().required(),
  //   type: Joi.string().required(),
  // }),
};

export const emailCampaignUsingEmails = {
  emails: Joi.array(),
  subject: Joi.string().required(),
  content: Joi.string().required(),
  file: Joi.string(),
  channelId: Joi.string(),
  // attachment: Joi.object().keys({
  //   filename: Joi.string().required(),
  //   content: Joi.string().base64().required(),
  //   type: Joi.string().required(),
  // }),
};

export const sendTemplatedEmailWithAttachmentV2: Record<keyof SendTemplatedEmailWithAttachmentV2, any> = {
  email: Joi.string().email(),
  language: Joi.string(),
  subject: Joi.string().required(),
  content: Joi.string().required(),
  receiverName: Joi.string(),
  link1: Joi.string(),
  linkTitle1: Joi.string(),
  link1Color: Joi.string(),
  link2: Joi.string(),
  linkTitle2: Joi.string(),
  link2Color: Joi.string(),
  file: Joi.string().required(),
  fileName: Joi.string().required(),
  attachment: Joi.object().keys({
    filename: Joi.string().required(),
    content: Joi.string().base64().required(),
    type: Joi.string().required(),
  }),
};
