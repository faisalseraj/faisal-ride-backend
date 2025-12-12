import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';

export interface INotification {
  id: string;
  userId: IUserDoc['_id'];
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  source: NotificationSource;
  sourceId?: string;
  metadata?: {
    socketEvent?: string;
    roomId?: string;
    towRequestId?: string;
    chatRoomId?: string;
    [key: string]: any;
  };
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType = 
  | 'tow_request_created'
  | 'tow_request_assigned'
  | 'tow_request_accepted'
  | 'tow_request_rejected'
  | 'tow_request_completed'
  | 'tow_request_cancelled'
  | 'tow_request_updated'
  | 'tow_request_location_updated'
  | 'chat_message_received'
  | 'chat_room_joined'
  | 'chat_room_left'
  | 'user_typing'
  | 'system_alert'
  | 'parking_booking_created'
  | 'parking_booking_completed'
  | 'parking_booking_cancelled'
  | 'license_plate_updated'
  | 'apartment_assigned'
  | 'apartment_removed'
  | 'role_changed'
  | 'account_suspended'
  | 'account_reactivated'
  | 'general';

export type NotificationCategory = 
  | 'tow_request'
  | 'chat'
  | 'parking'
  | 'apartment'
  | 'user_management'
  | 'system'
  | 'security'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationSource = 
  | 'socket_event'
  | 'system_generated'
  | 'user_action'
  | 'admin_action'
  | 'api_call';

export interface INotificationDoc extends Omit<INotification, 'id'>, Document {}

export interface INotificationModel extends Model<INotificationDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<any>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<INotificationDoc | null>;
  markAllAsRead(userId: string): Promise<number>;
  getNotificationsForUser(userId: string, options?: any): Promise<any>;
  createSocketNotification(data: CreateSocketNotificationData): Promise<INotificationDoc>;
}

export interface CreateSocketNotificationData {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: any;
  priority?: NotificationPriority;
  sourceId?: string;
  metadata?: any;
  expiresAt?: Date;
}
