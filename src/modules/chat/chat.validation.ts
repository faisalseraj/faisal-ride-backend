import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const createRoomBody: Record<string, any> = {
  name: Joi.string().optional().allow('').trim().max(100),
  type: Joi.string().valid('direct', 'group', 'tow-request').required(),
  participants: Joi.array().items(Joi.string().custom(objectId).required()).min(1).required(),
  towRequestId: Joi.string().when('type', {
    is: 'tow-request',
    then: Joi.string().custom(objectId).required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  metadata: Joi.object().optional().allow(null).keys({
    description: Joi.string().optional().allow('').max(500),
    avatar: Joi.string().optional().allow('').uri(),
  }),
};

export const createRoom = {
  body: Joi.object().keys(createRoomBody),
};

const sendMessageBody: Record<string, any> = {
  roomId: Joi.string().custom(objectId).required(),
  content: Joi.string().required().min(1).max(2000),
  messageType: Joi.string().valid('text', 'image', 'file', 'system').optional().default('text'),
  replyTo: Joi.string().custom(objectId).optional().allow(''),
  metadata: Joi.object().optional().allow(null).keys({
    fileName: Joi.string().optional().allow(''),
    fileSize: Joi.number().optional().positive().allow(null),
    fileType: Joi.string().optional().allow(''),
    imageUrl: Joi.string().optional().allow('').uri(),
  }),
};

export const sendMessage = {
  body: Joi.object().keys(sendMessageBody),
};

export const getMessages = {
  query: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
    page: Joi.number().optional().min(1).default(1).allow(null),
    limit: Joi.number().optional().min(1).max(100).default(50).allow(null),
  }),
};

export const getRoomById = {
  params: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
  }),
};

export const addParticipant = {
  body: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
    participantId: Joi.string().custom(objectId).required(),
  }),
};

export const removeParticipant = {
  body: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
    participantId: Joi.string().custom(objectId).required(),
  }),
};

export const markRoomAsRead = {
  body: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
  }),
};

export const editMessage = {
  body: Joi.object().keys({
    messageId: Joi.string().custom(objectId).required(),
    content: Joi.string().required().min(1).max(2000).allow(''),
  }),
};

export const deleteMessage = {
  params: Joi.object().keys({
    messageId: Joi.string().custom(objectId).required(),
  }),
};

export const createTowRequestChat = {
  params: Joi.object().keys({
    towRequestId: Joi.string().custom(objectId).required(),
  }),
};

export const getUnreadCount = {
  query: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
  }),
};