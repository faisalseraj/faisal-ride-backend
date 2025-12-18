import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';

export interface IChatRoom {
  _id: string;
  name?: string;
  type: 'direct' | 'group' | 'tow-request' | 'trip';
  participants: IUserDoc['_id'][]; // Array of user IDs
  createdBy: IUserDoc['_id']; // User ID who created the room
  towRequestId?: string; // Optional: for tow-request specific chats
  tripId?: string; // Optional: for trip-specific chats
  lastMessage?: string;
  lastMessageAt?: Date;
  isActive: boolean;
  metadata?: {
    description?: string;
    avatar?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatRoomDoc extends Omit<IChatRoom, '_id'>, Document {}
export interface IChatRoomModel extends Model<IChatRoomDoc> {
  isUserParticipant(roomId: string, userId: string): Promise<boolean>;
  getUserRooms(userId: string): Promise<IChatRoomDoc[]>;
  createDirectRoom(user1Id: string, user2Id: string): Promise<IChatRoomDoc>;
  createTowRequestRoom(towRequestId: string, participants: string[]): Promise<IChatRoomDoc>;
}

export interface IChatMessage {
  _id: string;
  roomId: string;
  senderId: IUserDoc['_id'];
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  replyTo?: string; // Message ID this is replying to
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  readBy: {
    userId: string;
    readAt: Date;
  }[];
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    imageUrl?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatMessageDoc extends Omit<IChatMessage, '_id'>, Document {}
export interface IChatMessageModel extends Model<IChatMessageDoc> {
  getRoomMessages(roomId: string, page?: number, limit?: number): Promise<IChatMessageDoc[]>;
  markAsRead(messageId: string, userId: string): Promise<void>;
  markRoomAsRead(roomId: string, userId: string): Promise<void>;
  getUnreadCount(roomId: string, userId: string): Promise<number>;
}

export interface IChatParticipant {
  _id: string;
  roomId: string;
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
  role: 'admin' | 'member';
  isActive: boolean;
  lastReadAt?: Date;
  notificationsEnabled: boolean;
}

export interface IChatParticipantDoc extends Omit<IChatParticipant, '_id'>, Document {}
export interface IChatParticipantModel extends Model<IChatParticipantDoc> {
  addParticipant(roomId: string, userId: string, role?: 'admin' | 'member'): Promise<IChatParticipantDoc>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  getRoomParticipants(roomId: string): Promise<IChatParticipantDoc[]>;
  updateLastRead(roomId: string, userId: string): Promise<void>;
}

// Request/Response interfaces
export interface CreateRoomRequest {
  name?: string;
  type: 'direct' | 'group' | 'tow-request' | 'trip';
  participants: string[];
  towRequestId?: string;
  tripId?: string;
  metadata?: {
    description?: string;
    avatar?: string;
    [key: string]: any;
  };
}

export interface SendMessageRequest {
  roomId: string;
  content: string;
  messageType?: 'text' | 'image' | 'file' | 'system';
  replyTo?: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    imageUrl?: string;
    [key: string]: any;
  };
}

export interface GetMessagesRequest {
  roomId: string;
  page?: number;
  limit?: number;
}

export interface ChatRoomResponse {
  id: string;
  name?: string;
  type: 'direct' | 'group' | 'tow-request' | 'trip';
  participants: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: Date;
  }[];
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    messageType: 'text' | 'image' | 'file' | 'system';
    createdAt: Date;
  };
  unreadCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageResponse {
  id: string;
  roomId: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  readBy: {
    userId: string;
    userName: string;
    readAt: Date;
  }[];
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    imageUrl?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}
