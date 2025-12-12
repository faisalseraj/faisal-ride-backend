import Joi from 'joi';

const createNotification = {
  body: Joi.object().keys({
    userId: Joi.string().required(),
    type: Joi.string().valid(
      'tow_request_created',
      'tow_request_assigned',
      'tow_request_accepted',
      'tow_request_rejected',
      'tow_request_completed',
      'tow_request_cancelled',
      'tow_request_updated',
      'tow_request_location_updated',
      'chat_message_received',
      'chat_room_joined',
      'chat_room_left',
      'user_typing',
      'system_alert',
      'parking_booking_created',
      'parking_booking_completed',
      'parking_booking_cancelled',
      'license_plate_updated',
      'apartment_assigned',
      'apartment_removed',
      'role_changed',
      'account_suspended',
      'account_reactivated',
      'general'
    ).required(),
    category: Joi.string().valid(
      'tow_request',
      'chat',
      'parking',
      'apartment',
      'user_management',
      'system',
      'security',
      'general'
    ).required(),
    title: Joi.string().max(200).required(),
    message: Joi.string().max(1000).required(),
    data: Joi.object(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    source: Joi.string().valid('socket_event', 'system_generated', 'user_action', 'admin_action', 'api_call'),
    sourceId: Joi.string(),
    metadata: Joi.object(),
    expiresAt: Joi.date(),
  }),
};

const updateNotification = {
  params: Joi.object().keys({
    notificationId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    isRead: Joi.boolean(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    data: Joi.object(),
    metadata: Joi.object(),
  }).min(1),
};

const getNotifications = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    category: Joi.string().valid(
      'tow_request',
      'chat',
      'parking',
      'apartment',
      'user_management',
      'system',
      'security',
      'general'
    ),
    type: Joi.string().valid(
      'tow_request_created',
      'tow_request_assigned',
      'tow_request_accepted',
      'tow_request_rejected',
      'tow_request_completed',
      'tow_request_cancelled',
      'tow_request_updated',
      'tow_request_location_updated',
      'chat_message_received',
      'chat_room_joined',
      'chat_room_left',
      'user_typing',
      'system_alert',
      'parking_booking_created',
      'parking_booking_completed',
      'parking_booking_cancelled',
      'license_plate_updated',
      'apartment_assigned',
      'apartment_removed',
      'role_changed',
      'account_suspended',
      'account_reactivated',
      'general'
    ),
    isRead: Joi.boolean(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  }),
};

const getNotificationById = {
  params: Joi.object().keys({
    notificationId: Joi.string().required(),
  }),
};

const markAsRead = {
  params: Joi.object().keys({
    notificationId: Joi.string().required(),
  }),
};

const deleteNotification = {
  params: Joi.object().keys({
    notificationId: Joi.string().required(),
  }),
};

export {
  createNotification,
  updateNotification,
  getNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
};
