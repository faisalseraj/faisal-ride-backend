import {
  ChatMessageResponse,
  ChatRoomResponse,
  CreateRoomRequest,
  GetMessagesRequest,
  SendMessageRequest,
} from './chat.interfaces';

import { ApiError } from '../errors';
import Chat from './chat.model';
import { IoSocket } from '../../app';
// Faisal Ride refactor - TowRequest archived
// import TowRequest from '../tow-request/tow-request.model';
import User from '../user/user.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

// Placeholder for TowRequest model (archived)
const TowRequest = { findById: () => ({ populate: () => Promise.resolve(null) }) } as any;

// ---------- Helper Functions ----------
const checkTowRequestAccess = (towRequest: any, userId: string): boolean => {
  const userIdStr = userId.toString();

  return (
    towRequest.requestCreatedBy._id.toString() === userIdStr ||
    towRequest.towCompanyId._id.toString() === userIdStr ||
    (towRequest.assignedTo && towRequest.assignedTo._id.toString() === userIdStr) ||
    (towRequest.assignedBy && towRequest.assignedBy._id.toString() === userIdStr) ||
    (towRequest.pspCompanyId && towRequest.pspCompanyId._id.toString() === userIdStr)
  );
};

// Helper function to emit unread count updates to users
const emitUnreadCountUpdate = async (userIds: string[]) => {
  if (!IoSocket) {
    console.log('❌ Socket.IO not available for unread count update');
    return;
  }

  for (const userId of userIds) {
    try {
      const totalUnreadCount = await getTotalUnreadCount(userId);
      IoSocket.to(`user-${userId}`).emit('unreadCountUpdate', {
        totalUnreadCount,
      });
      console.log(`📤 Sent unread count update to user ${userId}: ${totalUnreadCount}`);
    } catch (error) {
      console.error(`❌ Error sending unread count update to user ${userId}:`, error);
    }
  }
};

// Helper function to emit room creation notifications
// Update room name
export const updateRoomName = async (roomId: string, userId: string, newName: string): Promise<ChatRoomResponse> => {
  try {
    console.log('🔄 Updating room name:', { roomId, userId, newName });

    // Find the room and verify user is a participant
    const room = await Chat.ChatRoom.findById(roomId);
    if (!room) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
    }

    // Prevent name changes for tow-request type rooms to avoid bugs
    if (room.type === 'tow-request') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot change the name of tow-request chat rooms');
    }

    // Check if user is a participant
    const isParticipant = await Chat.ChatRoom.isUserParticipant(roomId, userId);
    if (!isParticipant) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not a participant in this room');
    }

    // Update the room name
    room.name = newName.trim();
    await room.save();

    // Emit room update notification to all participants
    await emitRoomUpdateNotification(room, 'nameChanged', { newName, changedBy: userId });

    console.log('✅ Room name updated successfully');
    return await formatRoomResponse(room, userId);
  } catch (error) {
    console.error('❌ Error updating room name:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error updating room name');
  }
};

// Helper function to emit room update notifications
const emitRoomUpdateNotification = async (room: any, updateType: string, data: any) => {
  try {
    console.log('🔔 Emitting room update notification:', { roomId: room._id, updateType, data });

    if (!IoSocket) {
      console.log('❌ Socket.IO not available for room update notification');
      return;
    }

    // Get user details for participants
    const participantUsers = await User.find({
      _id: { $in: room.participants },
      isDeleted: { $ne: true },
    }).select('_id socketId firstName lastName');

    console.log(
      '👥 Found participants for room update:',
      participantUsers.map((u) => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        hasSocketId: !!u.socketId,
      }))
    );

    // Emit notification to each participant
    let notificationsSent = 0;
    participantUsers.forEach((user) => {
      if (user.socketId) {
        console.log(
          `📤 Sending room update to user ${user._id} (${user.firstName} ${user.lastName}) with socket ${user.socketId}`
        );
        IoSocket.to(user.socketId).emit('chatRoomUpdated', {
          roomId: room._id,
          updateType,
          data,
          updatedAt: new Date(),
        });
        notificationsSent++;
      } else {
        console.log(`⚠️ User ${user._id} (${user.firstName} ${user.lastName}) has no socket ID - offline`);
      }
    });

    console.log(
      `✅ Room update notification sent to ${notificationsSent}/${participantUsers.length} participants for room ${room._id}`
    );
  } catch (error) {
    console.error('❌ Error emitting room update notification:', error);
  }
};

export const emitRoomCreatedNotification = async (room: any, participants: string[]) => {
  try {
    console.log('🔔 Emitting room creation notification for room:', room._id, 'participants:', participants);

    if (!IoSocket) {
      console.log('❌ Socket.IO not available for room creation notification');
      return;
    }

    // Get user details for participants
    const participantUsers = await User.find({
      _id: { $in: participants },
      isDeleted: { $ne: true },
    }).select('_id socketId firstName lastName');

    console.log(
      '👥 Found participants with socket IDs:',
      participantUsers.map((u) => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        hasSocketId: !!u.socketId,
      }))
    );

    // Emit notification to each participant
    let notificationsSent = 0;
    participantUsers.forEach((user) => {
      if (user.socketId) {
        console.log(
          `📤 Sending notification to user ${user._id} (${user.firstName} ${user.lastName}) with socket ${user.socketId}`
        );
        IoSocket.to(user.socketId).emit('chatRoomCreated', {
          roomId: room._id,
          roomName: room.name,
          roomType: room.type,
          participants: room.participants,
          createdAt: room.createdAt,
          message: `New chat room "${room.name}" has been created`,
        });
        notificationsSent++;
      } else {
        console.log(`⚠️ User ${user._id} (${user.firstName} ${user.lastName}) has no socket ID - offline`);
      }
    });

    console.log(
      `✅ Room creation notification sent to ${notificationsSent}/${participantUsers.length} participants for room ${room._id}`
    );
  } catch (error) {
    console.error('❌ Error emitting room creation notification:', error);
  }
};

export const formatRoomResponse = async (room: any, userId?: string): Promise<ChatRoomResponse> => {
  const participants = room.participants.map((participant: any) => ({
    id: participant._id,
    name: participant.firstName + ' ' + participant.lastName,
    email: participant.email,
    avatar: participant.image,
    isOnline: participant.isOnline || false,
    lastSeen: participant.lastLogin,
  }));

  let lastMessage = undefined;
  if (room.lastMessage) {
    // Get the actual last message details
    const lastMsg = await Chat.ChatMessage.findOne({ roomId: room._id, isDeleted: false })
      .populate('senderId', 'firstName lastName')
      .sort({ createdAt: -1 });

    if (lastMsg) {
      lastMessage = {
        id: lastMsg._id,
        content: lastMsg.content,
        senderId: lastMsg.senderId._id,
        senderName: lastMsg?.senderId?.firstName + ' ' + lastMsg?.senderId?.lastName,
        messageType: lastMsg.messageType,
        createdAt: lastMsg.createdAt,
      };
    }
  }

  const unreadCount = userId ? await getUnreadCount(room._id, userId) : 0;

  const response: ChatRoomResponse = {
    id: room._id,
    name: room.name,
    type: room.type,
    participants,
    unreadCount,
    isActive: room.isActive,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };

  if (lastMessage) {
    response.lastMessage = lastMessage;
  }

  return response;
};

const formatMessageResponse = async (message: any): Promise<ChatMessageResponse> => {
  const sender = message.senderId;
  console.log('🔍 formatMessageResponse: message', message);
  // Handle case where sender is not populated or is a string (system messages)
  let senderData;
if (sender && sender?._id) {
    // This is a populated sender
    senderData = {
      id: sender._id,
      name: sender?.firstName + ' ' + sender?.lastName,
      email: sender?.email,
      avatar: sender?.image,
    };
  } else if (sender ) {
    // This is an ObjectId (unpopulated sender)
    console.log('🔍 formatMessageResponse: sender is ObjectId, fetching user data for:', sender.toString());
    try {
      const user = await User.findById(new mongoose.Types.ObjectId(sender)).select('firstName lastName email image');
      if (user) {
        console.log('✅ Found user data for sender:', {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        });
        senderData = {
          id: user._id,
          name: (user.firstName || '') + ' ' + (user.lastName || ''),
          email: user.email || 'unknown@hitsparkingmanager.com',
          avatar: user.image,
        };
      } else {
        console.log('⚠️ User not found for sender ObjectId:', sender.toString());
        // User not found, use ObjectId as fallback
        senderData = {
          id: sender.toString(),
          name: 'Unknown User',
          email: 'unknown@hitsparkingmanager.com',
          avatar: undefined,
        };
      }
    } catch (error) {
      console.error('❌ Error fetching user data for sender:', error);
      // Fallback to ObjectId string
      senderData = {
        id: sender.toString(),
        name: 'Unknown User',
        email: 'unknown@hitsparkingmanager.com',
        avatar: undefined,
      };
    }
  } else {
    // Fallback for any other case
    senderData = {
      id: 'unknown',
      name: 'Unknown User',
      email: 'unknown@hitsparkingmanager.com',
      avatar: undefined,
    };
  }

  const readBy = (message.readBy || []).map((read: any) => {
    // Handle case where readBy.userId is not populated or is null
    if (!read.userId || !read.userId._id) {
      return {
        userId: read.userId || 'unknown',
        userName: 'Unknown User',
        readAt: read.readAt,
      };
    }

    return {
      userId: read.userId._id,
      userName: (read.userId.firstName || '') + ' ' + (read.userId.lastName || ''),
      readAt: read.readAt,
    };
  });

  let replyTo = undefined;
  if (message.replyTo && message.replyTo._id) {
    replyTo = {
      id: message.replyTo._id,
      content: message.replyTo.content || '',
      senderName: message.replyTo.senderId
        ? (message.replyTo.senderId.firstName || '') + ' ' + (message.replyTo.senderId.lastName || '')
        : 'Unknown User',
    };
  }

  const response: ChatMessageResponse = {
    id: message._id,
    roomId: message.roomId,
    sender: senderData,
    content: message.content,
    messageType: message.messageType,
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted,
    readBy,
    metadata: message.metadata,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };

  if (replyTo) {
    response.replyTo = replyTo;
  }

  return response;
};

// ---------- Room Management ----------
export const createRoom = async (userId: string, roomData: CreateRoomRequest): Promise<ChatRoomResponse> => {
  const { name, type, participants, towRequestId, tripId, metadata } = roomData;

  // Validate participants
  const validParticipants = await User.find({
    _id: { $in: participants },
    isDeleted: { $ne: true },
  });

  if (validParticipants.length !== participants.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'One or more participants are invalid');
  }

  // Add creator to participants if not already included
  if (!participants.includes(userId)) {
    participants.push(userId);
  }

  let room;

  if (type === 'direct') {
    if (participants.length !== 2) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Direct room must have exactly 2 participants');
    }
    room = await Chat.ChatRoom.createDirectRoom(participants?.[0]!, participants?.[1]!);
  } else if (type === 'tow-request') {
    if (!towRequestId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request ID is required for tow-request type rooms');
    }

    // Verify tow request exists and user has access
    const towRequest = await TowRequest.findById(towRequestId);
    if (!towRequest) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Tow request not found');
    }

    // Check if user has access to this tow request
    const hasAccess = checkTowRequestAccess(towRequest, userId);
    if (!hasAccess) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this tow request');
    }

    room = await Chat.ChatRoom.createTowRequestRoom(towRequestId, participants);
  } else if (type === 'trip') {
    if (!tripId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Trip ID is required for trip type rooms');
    }

    // Import Trip model
    const Trip = require('../trip/trip.model').default;
    
    // Verify trip exists and user has access
    const trip = await Trip.findById(tripId);
    if (!trip) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
    }

    // Check if user is driver or passenger
    const driverId = trip.driverId.toString();
    const isDriver = driverId === userId;
    const isPassenger = (trip.passengers || []).some(
      (p: any) => (p.userId?._id || p.userId)?.toString() === userId && p.status === 'confirmed'
    );

    if (!isDriver && !isPassenger) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this trip chat');
    }

    // Check if trip room already exists
    const existingRoom = await Chat.ChatRoom.findOne({
      type: 'trip',
      tripId,
      isActive: true,
    });

    if (existingRoom) {
      // Add user to existing room if not already a participant
      if (!existingRoom.participants.some((p: any) => p.toString() === userId)) {
        existingRoom.participants.push(userId as any);
        await existingRoom.save();
      }
      room = existingRoom;
    } else {
      // Create new trip room
      room = new Chat.ChatRoom({
        name: name || `Trip Chat - ${trip.origin.city || trip.origin.address} to ${trip.destination.city || trip.destination.address}`,
        type: 'trip',
        participants: [...new Set([driverId, ...participants])], // Include driver and all participants
        createdBy: userId as any,
        tripId: tripId as any,
        isActive: true,
        metadata,
      });
      await room.save();
    }
  } else {
    // Group room
    room = new Chat.ChatRoom({
      name,
      type,
      participants,
      createdBy: userId,
      metadata,
    });
    await room.save();
  }

  // Add participants to the room
  for (const participantId of participants) {
    await Chat.ChatParticipant.addParticipant(room._id, participantId, participantId === userId ? 'admin' : 'member');
  }

  // Emit room creation notification to all participants
  await emitRoomCreatedNotification(room, participants);

  return await formatRoomResponse(room);
};

export const getUserRooms = async (userId: string): Promise<ChatRoomResponse[]> => {
  const rooms = await Chat.ChatRoom.getUserRooms(userId);
  const formattedRooms = await Promise.all(rooms.map((room) => formatRoomResponse(room, userId)));
  return formattedRooms;
};

export const getRoomById = async (roomId: string, userId: string): Promise<ChatRoomResponse> => {
  const room = await Chat.ChatRoom.findById(roomId)
    .populate('participants', 'firstName lastName email image isOnline lastLogin')
    .populate('createdBy', 'firstName lastName email image')
    .populate('towRequestId', 'status requesterName');

  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
  }

  // Check if user is a participant
  const isParticipant = await Chat.ChatRoom.isUserParticipant(roomId, userId);
  if (!isParticipant) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not a participant in this room');
  }

  return await formatRoomResponse(room, userId);
};

// ---------- Direct Chat Management ----------
export const createDirectChat = async (userId: string, targetUserId: string): Promise<ChatRoomResponse> => {
  // Verify both users exist
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Target user not found');
  }

  // Check if direct chat already exists between these users
  let room = await Chat.ChatRoom.findOne({
    type: 'direct',
    participants: { $all: [userId, targetUserId] },
    isActive: true,
  });

  if (!room) {
    // Create new direct chat room
    room = new Chat.ChatRoom({
      type: 'direct',
      participants: [userId, targetUserId],
      createdBy: userId,
      metadata: {
        description: `Direct chat with ${targetUser.fullName || targetUser.firstName + ' ' + targetUser.lastName}`,
      },
    });

    await room.save();

    // Add participants
    await Chat.ChatParticipant.addParticipant(room._id, userId, 'member');
    await Chat.ChatParticipant.addParticipant(room._id, targetUserId, 'member');

    // Emit room creation notification to both participants
    await emitRoomCreatedNotification(room, [userId, targetUserId]);
  }

  return await formatRoomResponse(room, userId);
};

export const getDirectChats = async (userId: string): Promise<ChatRoomResponse[]> => {
  const rooms = await Chat.ChatRoom.find({
    type: 'direct',
    participants: userId,
    isActive: true,
  })
    .populate('participants', 'firstName lastName fullName email userType')
    .sort({ updatedAt: -1 });

  return await Promise.all(rooms.map((room) => formatRoomResponse(room, userId)));
};

export const addParticipant = async (
  roomId: string,
  userId: string,
  newParticipantId: string,
  bypassAdminCheck: boolean = false
): Promise<void> => {
  const room = await Chat.ChatRoom.findById(roomId);
  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
  }

  // Check if user is admin or creator
  const isAdmin = room.createdBy.toString() === userId;
  if (!isAdmin && !bypassAdminCheck) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only room admins can add participants');
  }

  // Check if participant already exists
  const existingParticipant = await Chat.ChatParticipant.findOne({
    roomId,
    userId: new mongoose.Types.ObjectId(newParticipantId),
  });

  if (existingParticipant && existingParticipant.isActive) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is already a participant in this room');
  }

  // Add participant to room
  room.participants.push(new mongoose.Types.ObjectId(newParticipantId));
  await room.save();

  // Add participant record
  await Chat.ChatParticipant.addParticipant(roomId, newParticipantId, 'member');
};

export const removeParticipant = async (roomId: string, userId: string, participantId: string, skipAdminCheck: boolean = false): Promise<void> => {
  const room = await Chat.ChatRoom.findById(roomId);
  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
  }

  // Check if user is admin or removing themselves
  const isAdmin = room.createdBy.toString() === userId;
  const isRemovingSelf = userId === participantId;

  if (!isAdmin && !isRemovingSelf && !skipAdminCheck) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only remove yourself or be an admin to remove others');
  }

  // Remove participant
  await Chat.ChatParticipant.removeParticipant(roomId, participantId);

  // Remove from room participants array
  room.participants = room.participants.filter((id) => id.toString() !== participantId);
  await room.save();
};

// ---------- Message Management ----------
export const sendMessage = async (userId: string, messageData: SendMessageRequest): Promise<ChatMessageResponse> => {
  const { roomId, content, messageType = 'text', replyTo, metadata } = messageData;

  // Verify room exists and user is a participant
  const room = await Chat.ChatRoom.findById(roomId);
  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const isParticipant = await Chat.ChatRoom.isUserParticipant(roomId, userId);
  if (!isParticipant) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not a participant in this room');
  }

  // Verify reply-to message exists if provided
  if (replyTo) {
    const replyMessage = await Chat.ChatMessage.findById(replyTo);
    if (!replyMessage || replyMessage.roomId.toString() !== roomId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reply-to message');
    }
  }

  // Create message
  const message = new Chat.ChatMessage({
    roomId,
    senderId: userId,
    content,
    messageType,
    replyTo,
    metadata,
  });

  await message.save();

  // Update room's last message
  room.lastMessage = content;
  room.lastMessageAt = new Date();
  await room.save();

  // Mark as read by sender
  await Chat.ChatMessage.markAsRead(message._id, userId);

  return await formatMessageResponse(message);
};

export const getRoomMessages = async (
  roomId: string,
  userId: string,
  query: GetMessagesRequest
): Promise<ChatMessageResponse[]> => {
  try {
    const { page = 1, limit = 50 } = query;

    console.log('getRoomMessages called with:', { roomId, userId, page, limit });

    // Verify room exists and user is a participant
    const room = await Chat.ChatRoom.findById(roomId);
    if (!room) {
      console.log('Room not found:', roomId);
      throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
    }

    console.log('Room found:', { id: room._id, type: room.type, participants: room.participants });

    const isParticipant = await Chat.ChatRoom.isUserParticipant(roomId, userId);
    if (!isParticipant) {
      console.log('User is not a participant:', { userId, roomId });
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not a participant in this room');
    }

    const messages = await Chat.ChatMessage.getRoomMessages(roomId, page, limit);
    console.log('Retrieved messages count:', messages.length);

    // Format messages with error handling
    const formattedMessages = await Promise.all(
      messages.map(async (message) => {
        try {
          return await formatMessageResponse(message);
        } catch (error) {
          console.error('Error formatting message:', error, 'Message ID:', message._id);
          // Return a basic message structure if formatting fails
          return {
            id: message._id,
            roomId: message.roomId,
            sender: {
              id: 'unknown',
              name: 'Unknown User',
              email: 'unknown@hitsparkingmanager.com',
              avatar: '',
            },
            content: message.content || 'Error loading message',
            messageType: message.messageType || 'text',
            isEdited: false,
            isDeleted: message.isDeleted || false,
            readBy: [],
            metadata: message.metadata || {},
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          } as ChatMessageResponse;
        }
      })
    );

    return formattedMessages;
  } catch (error) {
    console.error('Error getting room messages:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error getting room messages' + error);
  }
};

export const markRoomAsRead = async (roomId: string, userId: string): Promise<void> => {
  // Verify room exists and user is a participant
  const room = await Chat.ChatRoom.findById(roomId);
  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const isParticipant = await Chat.ChatRoom.isUserParticipant(roomId, userId);
  if (!isParticipant) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not a participant in this room');
  }

  // Mark all messages as read
  await Chat.ChatMessage.markRoomAsRead(roomId, userId);

  // Update participant's last read time
  await Chat.ChatParticipant.updateLastRead(roomId, userId);

  await emitUnreadCountUpdate([userId]);
};

export const markAllRoomsAsRead = async (userId: string): Promise<{ markedRooms: number }> => {
  // Get all rooms where user is a participant
  const userRooms = await Chat.ChatRoom.getUserRooms(userId);

  if (userRooms.length === 0) {
    return { markedRooms: 0 };
  }

  let markedRooms = 0;

  // Mark all messages in all user rooms as read
  for (const room of userRooms) {
    try {
      await Chat.ChatMessage.markRoomAsRead(room._id.toString(), userId);
      await Chat.ChatParticipant.updateLastRead(room._id.toString(), userId);
      markedRooms++;
    } catch (error) {
      console.error(`Error marking room ${room._id} as read:`, error);
      // Continue with other rooms even if one fails
    }
  }

  // Emit unread count update
  await emitUnreadCountUpdate([userId]);

  return { markedRooms };
};

export const editMessage = async (messageId: string, userId: string, newContent: string): Promise<ChatMessageResponse> => {
  const message = await Chat.ChatMessage.findById(messageId);
  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }

  // Check if user is the sender
  if (message.senderId.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only edit your own messages');
  }

  // Update message
  message.content = newContent;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  return await formatMessageResponse(message);
};

export const deleteMessage = async (messageId: string, userId: string): Promise<void> => {
  const message = await Chat.ChatMessage.findById(messageId);
  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }

  // Check if user is the sender
  if (message.senderId.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own messages');
  }

  // Soft delete message
  message.isDeleted = true;
  message.deletedAt = new Date();
  message.content = 'This message was deleted';
  await message.save();
};

export const getUnreadCount = async (roomId: string, userId: string): Promise<number> => {
  return Chat.ChatMessage.getUnreadCount(roomId, userId);
};

/**
 * Get total unread message count for a user across all rooms
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - Total unread message count
 */
export const getTotalUnreadCount = async (userId: string): Promise<number> => {
  try {
    console.log(`🔍 Getting total unread count for user: ${userId}`);

    // Get all rooms where the user is a participant
    const userRooms = await Chat.ChatRoom.find({
      participants: new mongoose.Types.ObjectId(userId),
      isActive: true,
    }).select('_id');

    if (userRooms.length === 0) {
      console.log('ℹ️ No active rooms found for user');
      return 0;
    }

    const roomIds = userRooms.map((room) => room._id);

    // Get total unread count across all rooms
    const totalUnreadCount = await Chat.ChatMessage.aggregate([
      {
        $match: {
          roomId: { $in: roomIds },
          isDeleted: { $ne: true },
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $lookup: {
          from: 'chatparticipants',
          localField: 'roomId',
          foreignField: 'roomId',
          as: 'participants',
        },
      },
      {
        $unwind: '$participants',
      },
      {
        $match: {
          'participants.userId': new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $project: {
          isUnread: {
            $cond: {
              if: {
                $anyElementTrue: {
                  $map: {
                    input: '$readBy',
                    as: 'read',
                    in: {
                      $and: [
                        { $eq: ['$$read.userId', new mongoose.Types.ObjectId(userId)] },
                        { $gte: ['$$read.readAt', '$createdAt'] },
                      ],
                    },
                  },
                },
              },
              then: 0,
              else: 1,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalUnread: { $sum: '$isUnread' },
        },
      },
    ]);

    const count = totalUnreadCount.length > 0 ? totalUnreadCount[0].totalUnread : 0;
    console.log(`✅ Total unread count for user ${userId}: ${count}`);

    return count;
  } catch (error) {
    console.error('❌ Error getting total unread count:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get total unread count');
  }
};

// ---------- Tow Request Integration ----------
export const createTowRequestChat = async (towRequestId: string, userId: string): Promise<ChatRoomResponse> => {
  const towRequest = await TowRequest.findById(towRequestId).populate(
    'requestCreatedBy assignedTo assignedBy towCompanyId pspCompanyId'
  );

  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow request not found');
  }

  // Check if user has access to this tow request
  const hasAccess = checkTowRequestAccess(towRequest, userId);
  if (!hasAccess) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this tow request');
  }

  // Get all relevant participants
  const participants = [towRequest.requestCreatedBy._id, towRequest.towCompanyId._id];

  if (towRequest.assignedTo) {
    participants.push(towRequest.assignedTo._id);
  }

  if (towRequest.assignedBy) {
    participants.push(towRequest.assignedBy._id);
  }

  if (towRequest.pspCompanyId) {
    participants.push(towRequest.pspCompanyId._id);
  }

  // Remove duplicates
  const uniqueParticipants = [...new Set(participants.map((id) => id.toString()))];

  // Create or get existing room
  let room: any = await Chat.ChatRoom.findOne({
    type: 'tow-request',
    towRequestId,
    isActive: true,
  });

  if (!room) {
    room = await Chat.ChatRoom.createTowRequestRoom(towRequestId, uniqueParticipants);

    // Add all participants
    for (const participantId of uniqueParticipants) {
      await Chat.ChatParticipant.addParticipant(room._id, participantId, 'member');
    }

    // Emit room creation notification to all participants
    await emitRoomCreatedNotification(room, uniqueParticipants);
  }

  return await formatRoomResponse(room, userId);
};

// Get tow request chat room
export const getTowRequestChatRoom = async (towRequestId: string, userId: string): Promise<any> => {
  // First verify the tow request exists and user has access
  const towRequest = await TowRequest.findById(towRequestId).populate(
    'requestCreatedBy assignedTo assignedBy towCompanyId pspCompanyId'
  );

  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow request not found');
  }

  // Check if user has access to this tow request
  const hasAccess = checkTowRequestAccess(towRequest, userId);
  if (!hasAccess) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this tow request');
  }

  // Find the chat room
  const room = await Chat.ChatRoom.findOne({
    type: 'tow-request',
    towRequestId,
    isActive: true,
  })
    .populate('participants', 'firstName lastName email image isOnline lastLogin')
    .populate('createdBy', 'firstName lastName email image')
    .populate('towRequestId', 'status requesterName');

  return room;
};

// Get tow request chat room by ID only (for system operations)
export const getTowRequestChatRoomById = async (towRequestId: string): Promise<any> => {
  try {
    // Find the chat room by tow request ID only
    const room = await Chat.ChatRoom.findOne({
      type: 'tow-request',
      name: `Tow Request #${towRequestId}`,
      isActive: true,
    });

    return room;
  } catch (error) {
    console.error('Error getting tow request chat room by ID:', error);
    return null;
  }
};

// ---------- System Message Functions ----------
export const getTowCompanyOwnerId = async (towRequestId: string): Promise<string | null> => {
  try {
    // Find the tow request to get the tow company ID
    const towRequest = await TowRequest.findById(towRequestId);
    if (!towRequest) {
      console.log(`Tow request ${towRequestId} not found`);
      return null;
    }

    // Find the tow company owner
    const towCompanyOwner = await User.findOne({
      _id: towRequest.towCompanyId,
      userType: 'tow-company-owner',
    });

    if (!towCompanyOwner) {
      console.log(`Tow company owner not found for company ${towRequest.towCompanyId}`);
      return null;
    }

    return towCompanyOwner._id.toString();
  } catch (error) {
    console.error('Error getting tow company owner:', error);
    return null;
  }
};

export const emitMessageToTowRequestChat = async (towRequestId: string, message: string, metadata?: any) => {
  try {
    console.log('🔔 Sending message to tow request chat:', towRequestId, 'message:', message);

    if (!IoSocket) {
      console.log('❌ Socket.IO not available for tow request chat message');
      return;
    }

    // Find the tow request chat room
    const room = await Chat.ChatRoom.findOne({
      type: 'tow-request',
      towRequestId,
      isActive: true,
    });

    if (!room) {
      console.log(`❌ No chat room found for tow request ${towRequestId}`);
      return;
    }

    // Get the tow company owner ID for sender
    const ownerId = await getTowCompanyOwnerId(towRequestId);

    let senderId;
    let messageType = 'text';

    if (ownerId) {
      // Use tow company owner as sender
      senderId = new mongoose.Types.ObjectId(ownerId);
    } else {
      // Fallback: find any participant in the room to use as sender
      console.log(`Could not find tow company owner for tow request ${towRequestId}, using first participant as sender`);
      const firstParticipant = room.participants[0];
      if (firstParticipant) {
        senderId = new mongoose.Types.ObjectId(firstParticipant);
      } else {
        console.log('No participants found in room, using system message');
        senderId = 'system';
        messageType = 'system';
      }
    }

    // Create and save the message
    const chatMessage = new Chat.ChatMessage({
      roomId: room._id,
      senderId,
      content: message,
      messageType,
      metadata: {
        isSystemMessage: true,
        isTowCompanyOwnerMessage: !!ownerId,
        ...metadata,
      },
    });

    await chatMessage.save();

    // Update room's last message
    room.lastMessage = message;
    room.lastMessageAt = new Date();
    await room.save();

    // Get user details for participants
    const participantUsers = await User.find({
      _id: { $in: room.participants },
      isDeleted: { $ne: true },
    }).select('_id socketId firstName lastName');

    console.log(
      '👥 Found participants with socket IDs:',
      participantUsers.map((u) => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        hasSocketId: !!u.socketId,
      }))
    );

    // Format message response for socket emission
    const messageResponse = await formatMessageResponse(chatMessage);
    console.log('messageResponse xxxx', messageResponse);
    // Emit message to each participant
    let messagesSent = 0;
    participantUsers.forEach((user) => {
      if (user.socketId) {
        console.log(
          `📤 Sending message to user ${user._id} (${user.firstName} ${user.lastName}) with socket ${user.socketId}`
        );

        IoSocket.to(`chat-${room._id}`).emit('chatNotification', {
          eventType: 'newMessage',
          roomId: room._id,
          message: messageResponse,
          timestamp: new Date(),
        });
        messagesSent++;
      } else {
        console.log(`⚠️ User ${user._id} (${user.firstName} ${user.lastName}) has no socket ID - offline`);
      }
    });

    console.log(
      `✅ Message sent to ${messagesSent}/${participantUsers.length} participants in tow request chat ${towRequestId}`
    );

    // Emit unread count updates to all participants
    const participantIds = participantUsers.map((user) => user._id.toString());
    await emitUnreadCountUpdate(participantIds);
  } catch (error) {
    console.error('❌ Error sending message to tow request chat:', error);
  }
};
