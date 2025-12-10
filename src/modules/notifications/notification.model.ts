import { INotificationDoc, INotificationModel } from './notification.inteface';

import { CreateSocketNotificationData } from './notification.inteface';
import { Schema } from 'mongoose';
import mongoose from 'mongoose';
import { paginate } from '../paginate';
import { toJSON } from '../toJSON';

const notificationSchema = new Schema<INotificationDoc, INotificationModel>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
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
        'general',
      ],
    },
    category: {
      type: String,
      required: true,
      enum: ['tow_request', 'chat', 'parking', 'apartment', 'user_management', 'system', 'security', 'general'],
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    source: {
      type: String,
      enum: ['socket_event', 'system_generated', 'user_action', 'admin_action', 'api_call'],
      default: 'system_generated',
    },
    sourceId: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1, isRead: 1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ source: 1, createdAt: -1 });

// Static methods
notificationSchema.statics['getUnreadCount'] = async function (userId: string): Promise<number> {
  return this.countDocuments({ userId, isRead: false });
};

notificationSchema.statics['markAsRead'] = async function (notificationId: string, userId: string): Promise<INotificationDoc | null> {
  return this.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

notificationSchema.statics['markAllAsRead'] = async function (userId: string): Promise<number> {
  const result = await this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return result.modifiedCount;
};

notificationSchema.statics['getNotificationsForUser'] = async function (userId: string, options: any = {}) {
  const { page = 1, limit = 20, category, type, isRead, priority } = options;
  const filter: any = { userId };
  
  if (category) filter.category = category;
  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead;
  if (priority) filter.priority = priority;

  // Use direct query instead of paginate due to filter issues
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { createdAt: -1 };
  
  const [totalResults, results] = await Promise.all([
    this.countDocuments(filter),
    this.find(filter)
      .sort(sort as any)
      .skip(skip)
      .limit(parseInt(limit))
      .exec()
  ]);
  
  const totalPages = Math.ceil(totalResults / parseInt(limit));
  
  return {
    results,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages,
    totalResults,
  };
};

notificationSchema.statics['createSocketNotification'] = async function (data: CreateSocketNotificationData): Promise<INotificationDoc> {
  const notification = new this({
    ...data,
    source: 'socket_event',
    priority: data.priority || 'medium',
  });
  return notification.save();
};

// Add plugins
notificationSchema.plugin(toJSON);
notificationSchema.plugin(paginate);

const Notification = mongoose.model<INotificationDoc, INotificationModel>('Notification', notificationSchema);

export default Notification;
