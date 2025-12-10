import { CreateSocketNotificationData, NotificationCategory, NotificationType } from './notification.inteface';

import { IUserDoc } from '../user/user.interfaces';
import mongoose from 'mongoose';
import { notificationService } from '.';
import { userService } from '../user';

export interface SocketEventData {
  eventType: string;
  userId: IUserDoc['_id'];
  roomId?: string;
  towRequestId?: string;
  chatRoomId?: string;
  payload?: any;
  metadata?: any;
}

export interface NotificationMessage {
  title: string;
  message: string;
  category: NotificationCategory;
  type: NotificationType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Get notification message based on socket event type
 */
const getNotificationMessage = (eventType: string, data: SocketEventData): NotificationMessage => {
  const messages: Record<string, NotificationMessage> = {
    // Tow Request Events
    'towRequestCreated': {
      title: 'New Tow Request',
      message: `A new tow request has been created${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_created',
      priority: 'high',
    },
    'towRequestAssigned': {
      title: 'Tow Request Assigned',
      message: `A tow request has been assigned to you${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_assigned',
      priority: 'high',
    },
    'towRequestAccepted': {
      title: 'Tow Request Accepted',
      message: `A tow request has been accepted${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_accepted',
      priority: 'medium',
    },
    'towRequestRejected': {
      title: 'Tow Request Rejected',
      message: `A tow request has been rejected${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_rejected',
      priority: 'medium',
    },
    'towRequestCompleted': {
      title: 'Tow Request Completed',
      message: `A tow request has been completed${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_completed',
      priority: 'medium',
    },
    'towRequestCancelled': {
      title: 'Tow Request Cancelled',
      message: `A tow request has been cancelled${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_cancelled',
      priority: 'medium',
    },
    'towRequestUpdated': {
      title: 'Tow Request Updated',
      message: `A tow request has been updated${data.towRequestId ? ` (ID: ${data.towRequestId})` : ''}`,
      category: 'tow_request',
      type: 'tow_request_updated',
      priority: 'low',
    },
    'operatorLocationUpdate': {
      title: 'Location Updated',
      message: `Tow operator location has been updated${data.towRequestId ? ` for request ${data.towRequestId}` : ''}`,
      category: 'tow_request',
      type: 'tow_request_location_updated',
      priority: 'low',
    },
    'liveLocationUpdated': {
      title: 'Live Location Updated',
      message: `Live location has been updated${data.towRequestId ? ` for request ${data.towRequestId}` : ''}`,
      category: 'tow_request',
      type: 'tow_request_location_updated',
      priority: 'low',
    },

    // Chat Events
    'newMessage': {
      title: 'New Message',
      message: `You have received a new message${data.chatRoomId ? ` in room ${data.chatRoomId}` : ''}`,
      category: 'chat',
      type: 'chat_message_received',
      priority: 'medium',
    },
    'userJoined': {
      title: 'User Joined',
      message: `A user has joined the chat${data.chatRoomId ? ` room ${data.chatRoomId}` : ''}`,
      category: 'chat',
      type: 'chat_room_joined',
      priority: 'low',
    },
    'userLeft': {
      title: 'User Left',
      message: `A user has left the chat${data.chatRoomId ? ` room ${data.chatRoomId}` : ''}`,
      category: 'chat',
      type: 'chat_room_left',
      priority: 'low',
    },
    'userTyping': {
      title: 'User Typing',
      message: `Someone is typing${data.chatRoomId ? ` in room ${data.chatRoomId}` : ''}`,
      category: 'chat',
      type: 'user_typing',
      priority: 'low',
    },
    'messagesRead': {
      title: 'Messages Read',
      message: `Messages have been marked as read${data.chatRoomId ? ` in room ${data.chatRoomId}` : ''}`,
      category: 'chat',
      type: 'chat_message_received',
      priority: 'low',
    },
    'roomCreated': {
      title: 'Chat Room Created',
      message: `A new chat room has been created${data.chatRoomId ? ` (ID: ${data.chatRoomId})` : ''}`,
      category: 'chat',
      type: 'chat_room_joined',
      priority: 'medium',
    },

    // Parking Events
    'parkingBookingCreated': {
      title: 'Parking Booking Created',
      message: `A new parking booking has been created`,
      category: 'parking',
      type: 'parking_booking_created',
      priority: 'medium',
    },
    'parkingBookingCompleted': {
      title: 'Parking Booking Completed',
      message: `A parking booking has been completed`,
      category: 'parking',
      type: 'parking_booking_completed',
      priority: 'medium',
    },
    'parkingBookingCancelled': {
      title: 'Parking Booking Cancelled',
      message: `A parking booking has been cancelled`,
      category: 'parking',
      type: 'parking_booking_cancelled',
      priority: 'medium',
    },

    // Apartment Events
    'apartmentAssigned': {
      title: 'Apartment Assigned',
      message: `An apartment has been assigned to you`,
      category: 'apartment',
      type: 'apartment_assigned',
      priority: 'high',
    },
    'apartmentRemoved': {
      title: 'Apartment Removed',
      message: `Your apartment assignment has been removed`,
      category: 'apartment',
      type: 'apartment_removed',
      priority: 'high',
    },
    'licensePlateUpdated': {
      title: 'License Plate Updated',
      message: `A license plate has been updated`,
      category: 'apartment',
      type: 'license_plate_updated',
      priority: 'medium',
    },

    // User Management Events
    'roleChanged': {
      title: 'Role Changed',
      message: `Your role has been changed`,
      category: 'user_management',
      type: 'role_changed',
      priority: 'high',
    },
    'accountSuspended': {
      title: 'Account Suspended',
      message: `Your account has been suspended`,
      category: 'user_management',
      type: 'account_suspended',
      priority: 'urgent',
    },
    'accountReactivated': {
      title: 'Account Reactivated',
      message: `Your account has been reactivated`,
      category: 'user_management',
      type: 'account_reactivated',
      priority: 'high',
    },

    // System Events
    'systemAlert': {
      title: 'System Alert',
      message: data.payload?.message || 'A system alert has been issued',
      category: 'system',
      type: 'system_alert',
      priority: 'high',
    },

    // Default
    'default': {
      title: 'Notification',
      message: `Event: ${eventType}`,
      category: 'general',
      type: 'general',
      priority: 'low',
    },
  };

  return messages[eventType] || messages['default']! ;
};

/**
 * Create notification from socket event
 */
export const createSocketEventNotification = async (data: SocketEventData): Promise<void> => {
  try {
    // Get user information
    const user = await userService.getUserById(new mongoose.Types.ObjectId(data.userId));
    if (!user) {
      console.error('User not found for notification:', data.userId);
      return;
    }

    // Get notification message
    const notificationMessage = getNotificationMessage(data.eventType, data);

    // Create notification
    await notificationService.createSocketNotification({
      userId: data.userId,
      type: notificationMessage.type,
      category: notificationMessage.category,
      title: notificationMessage.title,
      message: notificationMessage.message,
      data: data.payload || {},
      priority: notificationMessage.priority,
      sourceId: data.towRequestId || data.chatRoomId || data.roomId!,
      metadata: {
        socketEvent: data.eventType,
        roomId: data.roomId,
        towRequestId: data.towRequestId,
        chatRoomId: data.chatRoomId,
        ...data.metadata,
      },
    });

    console.log(`Notification created for socket event: ${data.eventType} for user: ${data.userId}`);
  } catch (error) {
    console.error('Error creating socket event notification:', error);
  }
};

/**
 * Create notifications for multiple users from socket event
 */
export const createBulkSocketEventNotifications = async (
  userIds: string[],
  eventType: string,
  additionalData: Partial<SocketEventData> = {}
): Promise<void> => {
  try {
    const notifications = await Promise.all(
      userIds.map(async (userId) => {
        const user = await userService.getUserById(new mongoose.Types.ObjectId(userId));
        if (!user) {
          console.error('User not found for notification:', userId);
          return null;
        }

        const data: SocketEventData = {
          eventType,
          userId,
          ...additionalData,
        };

        const notificationMessage = getNotificationMessage(eventType, data);

        return {
          userId,
          type: notificationMessage.type,
          category: notificationMessage.category,
          title: notificationMessage.title,
          message: notificationMessage.message,
          data: data.payload || {},
          priority: notificationMessage.priority,
          sourceId: data.towRequestId || data.chatRoomId || data.roomId,
          metadata: {
            socketEvent: data.eventType,
            roomId: data.roomId,
            towRequestId: data.towRequestId,
            chatRoomId: data.chatRoomId,
            ...data.metadata,
          },
        };
      })
    );

    const validNotifications = notifications.filter(Boolean);
    if (validNotifications.length > 0) {
      await notificationService.bulkCreateNotifications(userIds, validNotifications[0] as Omit<CreateSocketNotificationData, 'userId'>);
      console.log(`Bulk notifications created for event: ${eventType} for ${validNotifications.length} users`);
    }
  } catch (error) {
    console.error('Error creating bulk socket event notifications:', error);
  }
};

/**
 * Create notification for specific event types with custom data
 */
export const createCustomSocketNotification = async (
  userId: string,
  eventType: string,
  customMessage: string,
  customTitle?: string,
  additionalData: Partial<SocketEventData> = {}
): Promise<void> => {
  try {
    const data: SocketEventData = {
      eventType,
      userId,
      ...additionalData,
    };

    const notificationMessage = getNotificationMessage(eventType, data);

    await notificationService.createSocketNotification({
      userId,
      type: notificationMessage.type,
      category: notificationMessage.category,
      title: customTitle || notificationMessage.title,
      message: customMessage,
      data: data.payload || {},
      priority: notificationMessage.priority,
      sourceId: data.towRequestId || data.chatRoomId || data.roomId!,
      metadata: {
        socketEvent: data.eventType,
        roomId: data.roomId,
        towRequestId: data.towRequestId,
        chatRoomId: data.chatRoomId,
        custom: true,
        ...data.metadata,
      },
    });

    console.log(`Custom notification created for user: ${userId}, event: ${eventType}`);
  } catch (error) {
    console.error('Error creating custom socket notification:', error);
  }
};
