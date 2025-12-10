import { CreateSocketNotificationData, INotificationDoc, NotificationCategory, NotificationPriority, NotificationType } from './notification.inteface';

import ApiError from '../errors/ApiError';
import Notification from './notification.model';
import { QueryResult } from '../paginate/paginate';
import httpStatus from 'http-status';

/**
 * Create a notification
 */
export const createNotification = async (notificationData: {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: any;
  priority?: NotificationPriority;
  source?: 'socket_event' | 'system_generated' | 'user_action' | 'admin_action' | 'api_call';
  sourceId?: string;
  metadata?: any;
  expiresAt?: Date;
}): Promise<INotificationDoc> => {
  const notification = new Notification(notificationData);
  return notification.save();
};

/**
 * Create a socket event notification
 */
export const createSocketNotification = async (data: CreateSocketNotificationData): Promise<INotificationDoc> => {
  return Notification['createSocketNotification'](data);
};

/**
 * Get notifications for a user
 */
export const getNotificationsForUser = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    category?: NotificationCategory;
    type?: NotificationType;
    isRead?: boolean;
    priority?: NotificationPriority;
  } = {}
): Promise<QueryResult> => {
  return Notification['getNotificationsForUser'](userId, options);
};

/**
 * Get unread notification count for a user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  return Notification['getUnreadCount'](userId);
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId: string, userId: string): Promise<INotificationDoc | null> => {
  return Notification['markAsRead'](notificationId, userId);
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId: string): Promise<number> => {
  return Notification['markAllAsRead'](userId);
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string, userId: string): Promise<INotificationDoc | null> => {
  const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  return notification as unknown as INotificationDoc;
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (notificationId: string, userId: string): Promise<INotificationDoc | null> => {
  return Notification.findOne({ _id: notificationId, userId });
};

/**
 * Update notification
 */
export const updateNotification = async (
  notificationId: string,
  userId: string,
  updateData: Partial<INotificationDoc>
): Promise<INotificationDoc | null> => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    updateData,
    { new: true }
  );
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  return notification;
};

/**
 * Get notification statistics for a user
 */
export const getNotificationStats = async (userId: string): Promise<{
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  recentCount: number;
}> => {
  const [total, unread, byCategory, byPriority, recentCount] = await Promise.all([
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, isRead: false }),
    Notification.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
    ]),
    Notification.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $project: { priority: '$_id', count: 1, _id: 0 } },
    ]),
    Notification.countDocuments({
      userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    }),
  ]);

  const categoryStats: Record<NotificationCategory, number> = {
    tow_request: 0,
    chat: 0,
    parking: 0,
    apartment: 0,
    user_management: 0,
    system: 0,
    security: 0,
    general: 0,
  };

  const priorityStats: Record<NotificationPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  byCategory.forEach((item: any) => {
    if (item.category in categoryStats) {
      categoryStats[item.category as NotificationCategory] = item.count;
    }
  });

  byPriority.forEach((item: any) => {
    if (item.priority in priorityStats) {
      priorityStats[item.priority as NotificationPriority] = item.count;
    }
  });

  return {
    total,
    unread,
    byCategory: categoryStats,
    byPriority: priorityStats,
    recentCount,
  };
};

/**
 * Clean up expired notifications
 */
export const cleanupExpiredNotifications = async (): Promise<number> => {
  const result = await Notification.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

/**
 * Bulk create notifications for multiple users
 */
export const bulkCreateNotifications = async (
  userIds: string[],
  notificationData: Omit<CreateSocketNotificationData, 'userId'>
): Promise<INotificationDoc[]> => {
  const notifications = userIds.map(userId => ({
    ...notificationData,
    userId,
  }));

  return Notification.insertMany(notifications) as unknown as INotificationDoc[];
};

/**
 * Get notification preferences for a user (placeholder for future implementation)
 */
export const getNotificationPreferences = async (_userId: string): Promise<{
  categories: Record<NotificationCategory, boolean>;
  types: Record<NotificationType, boolean>;
  emailEnabled: boolean;
  pushEnabled: boolean;
}> => {
  // This would typically come from a user preferences model
  // For now, return default preferences
  return {
    categories: {
      tow_request: true,
      chat: true,
      parking: true,
      apartment: true,
      user_management: true,
      system: true,
      security: true,
      general: true,
    },
    types: {
      tow_request_created: true,
      tow_request_assigned: true,
      tow_request_accepted: true,
      tow_request_rejected: true,
      tow_request_completed: true,
      tow_request_cancelled: true,
      tow_request_updated: true,
      tow_request_location_updated: true,
      chat_message_received: true,
      chat_room_joined: true,
      chat_room_left: true,
      user_typing: false,
      system_alert: true,
      parking_booking_created: true,
      parking_booking_completed: true,
      parking_booking_cancelled: true,
      license_plate_updated: true,
      apartment_assigned: true,
      apartment_removed: true,
      role_changed: true,
      account_suspended: true,
      account_reactivated: true,
      general: true,
    },
    emailEnabled: true,
    pushEnabled: true,
  };
};
