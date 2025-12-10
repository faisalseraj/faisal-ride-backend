import * as chatService from './chat.service';

import { Request, Response } from 'express';

import { ApiError } from '../errors';
import { createChatLog } from '../logs/enhanced-log-migration.service';
import { formatRoomResponse } from './chat.service';
import httpStatus from 'http-status';

// ---------- Room Management ----------
export const createRoom = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const room = await chatService.createRoom(userId, req.body);
    
    // Log chat room creation
    await createChatLog({
      user: req.user,
      event: 'Chat Room Created',
      ipAddress: req.ip,
      customMetadata: {
        action: 'chat_room_create',
        category: 'communication',
        priority: 'low',
        roomId: room?.id?.toString(),
        roomName: room.name,
        roomType: room.type,
        participants: room.participants?.length || 0,
      },
    });
    
    res.status(httpStatus.CREATED).json({
      success: true,
      message: 'Room created successfully',
      data: room,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error creating room' + error);
  }
};

export const getUserRooms = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const rooms = await chatService.getUserRooms(userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rooms retrieved successfully',
      data: rooms,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving rooms' + error);
  }
};

export const getRoomById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId } = req.params;
    const room = await chatService.getRoomById(roomId!, userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Room retrieved successfully',
      data: room,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving room' + error);
  }
};

export const addParticipant = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId, participantId } = req.body;
    await chatService.addParticipant(roomId, userId, participantId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Participant added successfully',
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error adding participant' + error);
  }
};

export const removeParticipant = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId, participantId } = req.body;
    await chatService.removeParticipant(roomId, userId, participantId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Participant removed successfully',
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error removing participant' + error);
  }
};

// ---------- Message Management ----------
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const message = await chatService.sendMessage(userId, req.body);
    res.status(httpStatus.CREATED).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error sending message' + error);
  }
};

export const getRoomMessages = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId, page, limit } = req.query;
    const messages = await chatService.getRoomMessages(roomId as string, userId, {
      roomId: roomId as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Messages retrieved successfully',
      data: messages,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving messages' + error);
  }
};

export const markRoomAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId } = req.body;
    await chatService.markRoomAsRead(roomId, userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Room marked as read successfully',
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error marking room as read' + error);
  }
};

export const markAllRoomsAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const result = await chatService.markAllRoomsAsRead(userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: `All rooms marked as read successfully. ${result.markedRooms} rooms processed.`,
      data: result,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error marking all rooms as read' + error);
  }
};

export const editMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { messageId, content } = req.body;
    const message = await chatService.editMessage(messageId, userId, content);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Message edited successfully',
      data: message,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error editing message' + error);
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { messageId } = req.params;
    await chatService.deleteMessage(messageId!, userId);
    
    // Log message deletion
    await createChatLog({
      user: req.user,
      event: 'Chat Message Deleted',
      ipAddress: req.ip,
      customMetadata: {
        action: 'chat_message_delete',
        category: 'communication',
        priority: 'low',
        messageId: messageId,
        deletedBy: userId,
      },
    });
    
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error deleting message' + error);
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId } = req.query;
    const count = await chatService.getUnreadCount(roomId as string, userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: { unreadCount: count },
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving unread count' + error);
  }
};

export const getTotalUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const count = await chatService.getTotalUnreadCount(userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Total unread count retrieved successfully',
      data: { totalUnreadCount: count },
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving total unread count: ' + error);
  }
};

// ---------- Tow Request Integration ----------
export const createTowRequestChat = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { towRequestId } = req.params;
    const room = await chatService.createTowRequestChat(towRequestId!, userId);
    res.status(httpStatus.CREATED).json({
      success: true,
      message: 'Tow request chat created successfully',
      data: room,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error creating tow request chat' + error);
  }
};

export const getTowRequestChatRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { towRequestId } = req.params;
    const room = await chatService.getTowRequestChatRoom(towRequestId!, userId);
    
    if (!room) {
      res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'No chat room found for this tow request',
        data: null,
      });
      return;
    }

    // Format the room response
    const formattedRoom = await formatRoomResponse(room, userId);
    
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Tow request chat room retrieved successfully',
      data: formattedRoom,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving tow request chat room' + error);
  }
};

// ---------- Direct Chat Management ----------
export const createDirectChat = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { targetUserId } = req.body;
    if (!targetUserId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Target user ID is required');
    }

    const room = await chatService.createDirectChat(userId, targetUserId);
    res.status(httpStatus.CREATED).json({
      success: true,
      message: 'Direct chat created successfully',
      data: room,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error creating direct chat' + error);
  }
};

export const getDirectChats = async (req: Request, res: Response, ) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const rooms = await chatService.getDirectChats(userId);
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Direct chats retrieved successfully',
      data: rooms,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error retrieving direct chats' + error);
  }
};

// Update room name
export const updateRoomName = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const { roomId } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Room name is required');
    }

    const room = await chatService.updateRoomName(roomId!, userId, name);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Room name updated successfully',
      data: room,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error updating room name' + error);
  }
};

// Test endpoint to manually trigger room creation notification
export const testRoomNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Create a test room and emit notification
    const testRoom = {
      _id: 'test-room-' + Date.now(),
      name: 'Test Room',
      type: 'group',
      participants: [userId],
      createdAt: new Date(),
    };

    // Use the notification function
    await chatService.emitRoomCreatedNotification(testRoom, [userId]);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Test room notification sent',
      data: { roomId: testRoom._id, participants: [userId] },
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error sending test room notification' + error);
  }
};

