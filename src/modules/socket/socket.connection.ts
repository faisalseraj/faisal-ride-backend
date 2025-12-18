// Faisal Ride refactor - TowRequest archived
// import { emitToTowRequest, getNotificationMessage } from '../tow-request/tow-request.service';

import Chat from '../chat/chat.model';
import { Socket } from 'socket.io';
// import TowRequest from '../tow-request/tow-request.model';
import User from '../user/user.model';
import { chatService } from '../chat';
import { createSocketEventNotification } from '../notifications/socketNotification.service';
import { logService } from '../logs';
import mongoose from 'mongoose';
import { userService } from '../user';

// Placeholder functions for archived tow-request module
const emitToTowRequest = async (..._args: any[]) => { /* archived */ };
const getNotificationMessage = (..._args: any[]) => ({ title: '', message: '' });
const TowRequest = { findById: () => ({ populate: () => Promise.resolve(null) }) } as any;

// Function to send tow request events to chat
const sendTowRequestEventToChat = async (
  socket: Socket,
  towRequestId: string,
  eventType: string,
  towRequest: any,
  userId: string,
  payload: any
) => {
  try {
    // Get the tow request chat room
    const chatRoom = await chatService.getTowRequestChatRoom(towRequestId, userId);
    if (!chatRoom) {
      console.log(`No chat room found for tow request ${towRequestId}`);
      return;
    }

    // Get user information
    const user = await userService.getUserById(new mongoose.Types.ObjectId(userId));
    if (!user) {
      console.log(`User not found for tow request event: ${userId}`);
      return;
    }

    // Create event message content
    const eventMessages: Record<string, string> = {
      requestCreated: `🚨 New tow request created by ${(user as any).name || (user as any).fullName || 'Unknown User'}`,
      requestAssigned: `👤 Tow request assigned to ${towRequest.assignedTo?.name || 'Unknown User'}`,
      requestAccepted: `✅ Tow request accepted by ${(user as any).name || (user as any).fullName || 'Unknown User'}`,
      requestRejected: `❌ Tow request rejected by ${(user as any).name || (user as any).fullName || 'Unknown User'}`,
      requestInProgress: `🔄 Tow request is now in progress`,
      requestCompleted: `✅ Tow request completed by ${(user as any).name || (user as any).fullName || 'Unknown User'}`,
      updateStatus: `📝 Tow request status updated to ${payload.status} by ${
        (user as any).name || (user as any).fullName || 'Unknown User'
      }`,
      locationUpdate: `📍 Location updated by ${(user as any).name || (user as any).fullName || 'Unknown User'}`,
      operatorLocationUpdate: `🚗 Tow operator location updated`,
      liveLocationUpdated: `📍 Live location updated`,
    };

    const messageContent = eventMessages[eventType] || `📋 Tow request event: ${eventType}`;

    // Add additional context based on event type
    let additionalContext = '';
    if (payload?.reason) {
      additionalContext += `\nReason: ${payload.reason}`;
    }
    if (payload?.notes) {
      additionalContext += `\nNotes: ${payload.notes}`;
    }
    if (payload?.location) {
      additionalContext += `\nLocation: ${payload.location}`;
    }

    const fullMessage = messageContent + additionalContext;

    // Get tow company owner ID for the message sender
    const ownerId = await chatService.getTowCompanyOwnerId(towRequestId);
    const senderId = ownerId || userId; // Fallback to current user if owner not found

    // Send message to chat room from tow company owner
    const result = await chatService.sendMessage(senderId, {
      roomId: chatRoom.id,
      content: fullMessage,
      messageType: 'text', // Use text instead of system
      metadata: {
        towRequestId,
        eventType,
        isSystemMessage: true,
        isTowCompanyOwnerMessage: !!ownerId,
        originalEvent: {
          eventType,
          towRequestId,
          userId,
          payload,
        },
      },
    });

    // Emit chat notification to room participants
    socket.to(`chat-${chatRoom.id}`).emit('chatNotification', {
      eventType: 'newMessage',
      roomId: chatRoom.id,
      message: result,
      timestamp: new Date(),
    });

    console.log(`Tow request event ${eventType} sent to chat room ${chatRoom.id}`);
  } catch (error) {
    console.error('Error sending tow request event to chat:', error);
  }
};

export const UserSocketConnection = (socket: Socket) => {
  console.log('🔌 ===== NEW SOCKET CONNECTION =====');
  console.log('  - Socket ID:', socket.id);
  console.log('  - Client IP:', socket.handshake.address);
  console.log('  - User Agent:', socket.handshake.headers['user-agent']);
  console.log('  - Authorization Header:', socket.handshake.headers.authorization ? 'Present' : 'Missing');
  console.log('  - Connection Time:', new Date().toISOString());
  console.log('  - Transport:', socket.conn.transport.name);
  console.log('=====================================');

  // Store socket ID when user connects
  socket.on('authenticate', async (data: { userId: string }) => {
    try {
      const { userId } = data;
      if (userId) {
        // Update user's socket ID
        await User.findByIdAndUpdate(userId, { socketId: socket.id });
        console.log(`Socket ID ${socket.id} stored for user ${userId}`);
        
        // Join user-specific room
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined user room`);
      }
    } catch (error) {
      console.error('Error storing socket ID:', error);
    }
  });

  // Clear socket ID when user disconnects
  socket.on('disconnect', async () => {
    try {
      // Find user with this socket ID and clear it
      await User.updateOne({ socketId: socket.id }, { $unset: { socketId: 1 } });
      console.log(`Socket ID ${socket.id} cleared from user document`);
    } catch (error) {
      console.error('Error clearing socket ID:', error);
    }
  });

  // Generic socket join handlers
  socket.on('joinUserRoom', async (data: { userId: string }) => {
    const { userId } = data;
    if (userId) {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined user room`);
    }
  });

  socket.on('joinTowRequestRoom', async (data: { towRequestId: string }) => {
    const { towRequestId } = data;
    if (towRequestId) {
      socket.join(`tow-request-${towRequestId}`);
      console.log(`User joined tow request room: ${towRequestId}`);
    }
  });

  socket.on('joinChatRoom', async (data: { roomId: string }) => {
    const { roomId } = data;
    if (roomId) {
      socket.join(`chat-${roomId}`);
      console.log(`User joined chat room: ${roomId}`);
    }
  });

  socket.on('leaveUserRoom', async (data: { userId: string }) => {
    const { userId } = data;
    if (userId) {
      socket.leave(`user-${userId}`);
      console.log(`User ${userId} left user room`);
    }
  });

  socket.on('leaveTowRequestRoom', async (data: { towRequestId: string }) => {
    const { towRequestId } = data;
    if (towRequestId) {
      socket.leave(`tow-request-${towRequestId}`);
      console.log(`User left tow request room: ${towRequestId}`);
    }
  });

  socket.on('leaveChatRoom', async (data: { roomId: string }) => {
    const { roomId } = data;
    if (roomId) {
      socket.leave(`chat-${roomId}`);
      console.log(`User left chat room: ${roomId}`);
    }
  });

  // Trip room handlers
  socket.on('joinTripRoom', async (data: { tripId: string }) => {
    const { tripId } = data;
    if (tripId) {
      socket.join(`trip-${tripId}`);
      console.log(`🚗 [SOCKET] User joined trip room: ${tripId}`);
    }
  });

  socket.on('leaveTripRoom', async (data: { tripId: string }) => {
    const { tripId } = data;
    if (tripId) {
      socket.leave(`trip-${tripId}`);
      console.log(`🚗 [SOCKET] User left trip room: ${tripId}`);
    }
  });

  // Trip event handlers
  socket.on('tripEvent', async (data: { eventType: string; tripId: string; userId: string; payload?: any }) => {
    try {
      const { eventType, tripId, userId } = data;
      console.log('🚗 [SOCKET] Handling trip event:', { eventType, tripId, userId });

      // Join trip room if not already joined
      socket.join(`trip-${tripId}`);

      // Handle different trip event types
      switch (eventType) {
        case 'viewTrip':
          console.log(`🚗 [SOCKET] User ${userId} viewing trip ${tripId}`);
          // Could emit to trip room that someone is viewing
          socket.to(`trip-${tripId}`).emit('tripNotification', {
            eventType: 'tripViewed',
            tripId,
            viewedBy: userId,
            timestamp: new Date(),
          });
          break;

        case 'subscribeTrip':
          console.log(`🚗 [SOCKET] User ${userId} subscribing to trip ${tripId}`);
          socket.join(`trip-${tripId}`);
          break;

        case 'unsubscribeTrip':
          console.log(`🚗 [SOCKET] User ${userId} unsubscribing from trip ${tripId}`);
          socket.leave(`trip-${tripId}`);
          break;

        default:
          console.log('🚗 [SOCKET] Unknown trip event type:', eventType);
      }
    } catch (error) {
      console.error('❌ [SOCKET] Error handling trip event:', error);
      socket.emit('tripError', {
        eventType: data.eventType,
        message: 'Failed to handle trip event',
      });
    }
  });

  // Booking event handlers
  socket.on('bookingEvent', async (data: { eventType: string; tripId: string; userId: string; payload?: any }) => {
    try {
      const { eventType, tripId, userId } = data;
      console.log('🎫 [SOCKET] Handling booking event:', { eventType, tripId, userId });

      // Join trip room if not already joined
      socket.join(`trip-${tripId}`);

      // Handle different booking event types
      switch (eventType) {
        case 'subscribeBooking':
          console.log(`🎫 [SOCKET] User ${userId} subscribing to booking updates for trip ${tripId}`);
          socket.join(`trip-${tripId}`);
          break;

        case 'unsubscribeBooking':
          console.log(`🎫 [SOCKET] User ${userId} unsubscribing from booking updates for trip ${tripId}`);
          socket.leave(`trip-${tripId}`);
          break;

        default:
          console.log('🎫 [SOCKET] Unknown booking event type:', eventType);
      }
    } catch (error) {
      console.error('❌ [SOCKET] Error handling booking event:', error);
      socket.emit('bookingError', {
        eventType: data.eventType,
        message: 'Failed to handle booking event',
      });
    }
  });

  // Generic notification handler for all tow request related events
  socket.on('towRequestEvent', async (data: { eventType: string; towRequestId: string; userId: string; payload?: any }) => {
    try {
      const { eventType, towRequestId, userId, payload } = data;
      console.log('Handling tow request event:', { eventType, towRequestId, userId });

      let updatedTowRequest;

      switch (eventType) {
        case 'updateLocation':
          updatedTowRequest = await TowRequest.findByIdAndUpdate(
            towRequestId,
            {
              liveLocation: payload.location,
              $set: { 'liveLocation.updatedAt': new Date() },
            },
            { new: true }
          );
          break;

        case 'completeRequest':
          updatedTowRequest = await TowRequest.findByIdAndUpdate(
            towRequestId,
            {
              status: 'COMPLETED',
              completedAt: new Date(),
              completedBy: userId,
              ...payload,
            },
            { new: true }
          ).populate('requestCreatedBy assignedTo assignedBy');
          break;

        case 'updateStatus':
          updatedTowRequest = await TowRequest.findByIdAndUpdate(
            towRequestId,
            {
              status: payload.status,
              updatedAt: new Date(),
              updatedBy: userId,
              ...(payload.reason && { statusReason: payload.reason }),
            },
            { new: true }
          ).populate('requestCreatedBy assignedTo assignedBy');
          break;

        default:
          console.log('Unknown event type:', eventType);
          return;
      }

      if (updatedTowRequest) {
        // Generic notification structure
        const notification = {
          eventType,
          towRequestId,
          updatedBy: userId,
          updatedAt: new Date(),
          towRequest: updatedTowRequest,
          payload,
          ...payload, // Spread any additional data
        };

        // Broadcast to tow request room
        socket.to(`tow-request-${towRequestId}`).emit('towRequestNotification', notification);

        // Broadcast to user room for personal notifications
        socket.to(`user-${userId}`).emit('userNotification', notification);

        // Send tow request event to chat room
        await sendTowRequestEventToChat(socket, towRequestId, eventType, updatedTowRequest, userId, payload);

        // Create notification for the event
        await createSocketEventNotification({
          eventType,
          userId,
          towRequestId,
          payload: payload,
          metadata: {
            updatedBy: userId,
            updatedAt: new Date(),
            towRequest: updatedTowRequest,
          },
        });

        // Create enhanced log for the event
        try {
          const user = await userService.getUserById(new mongoose.Types.ObjectId(userId));
          if (user) {
            // Ensure user has required fields for logging
            const userForLog = {
              ...user,
              name:
                (user as any)?.name ||
                user?.fullName ||
                `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() ||
                user?.email ||
                user?.id ||
                'Unknown User',
              phoneNumber: user?.phoneNumber || '',
              email: user?.email || 'unknown@hitsparkingmanager.com',
              id: user?.id || 'unknown-id',
            };

            await logService.logSystem(`Socket Event: ${eventType}`, {
              metadata: {
                socketEvent: eventType,
                towRequestId,
                payload,
                updatedBy: userId,
                updatedAt: new Date(),
                affectedUser: payload?.affectedUserId,
                ipAddress: socket.handshake.address,
                userId: userForLog.id,
              },
            });
          }
        } catch (logError) {
          console.error('Error creating enhanced log for tow request event:', logError);
          // Continue execution even if logging fails
        }

        console.log(`${eventType} event handled successfully for tow request:`, towRequestId);
      } else {
        socket.emit('towRequestError', {
          eventType,
          message: 'Tow request not found or could not be updated',
        });
      }
    } catch (error) {
      console.error('Error handling tow request event:', error);
      socket.emit('towRequestError', {
        eventType: data.eventType,
        message: 'Failed to handle tow request event',
      });
    }
  });

  // Handle tow operator location updates with rate limiting
  const locationUpdateRateLimit = new Map<string, number>();
  const LOCATION_UPDATE_COOLDOWN = 1000; // 1 second cooldown per user

  socket.on('updateTowOperatorLocation', async (data: { towRequestId: string; location: any; userId: string }) => {
    try {
      const { towRequestId, location, userId } = data;

      // Rate limiting check
      const now = Date.now();
      const lastUpdate = locationUpdateRateLimit.get(userId);
      if (lastUpdate && now - lastUpdate < LOCATION_UPDATE_COOLDOWN) {
        console.log('Rate limiting location update for user:', userId);
        return;
      }
      locationUpdateRateLimit.set(userId, now);

      // Validate required fields
      if (!towRequestId || !location || !userId) {
        socket.emit('locationUpdateError', {
          message: 'Missing required fields: towRequestId, location, or userId',
        });
        return;
      }

      // Validate location coordinates
      if (
        typeof location.lat !== 'number' ||
        typeof location.lng !== 'number' ||
        isNaN(location.lat) ||
        isNaN(location.lng)
      ) {
        socket.emit('locationUpdateError', {
          message: 'Invalid location coordinates',
        });
        return;
      }

      if (process.env['NODE_ENV'] === 'development') {
        console.log('Handling tow operator location update:', { towRequestId, userId });
      }

      // Update the tow request with new location
      const updatedTowRequest = await TowRequest.findByIdAndUpdate(
        towRequestId,
        {
          liveLocation: {
            lat: location.lat,
            lng: location.lng,
            updatedAt: new Date(),
          },
        },
        { new: true }
      ).populate('requestCreatedBy assignedTo assignedBy');

      if (updatedTowRequest) {
        // Notify all stakeholders
        emitToTowRequest(towRequestId, 'tow-request-update', {
          updatedBy: userId,
          id: towRequestId,
          message: getNotificationMessage('operatorLocationUpdate', { id: towRequestId }),
          status: updatedTowRequest.status,
          towRequest: updatedTowRequest,
          type: 'updated',
        });

        // Also emit specific location update event for real-time tracking (tow company entities only)
        emitToTowRequest(towRequestId, 'towOperatorLocationUpdated', {
          towRequestId,
          location: {
            lat: location.lat,
            lng: location.lng,
          },
          updatedAt: new Date().toISOString(),
          towOperatorId: userId,
        });

        // Create notification for location update
        await createSocketEventNotification({
          eventType: 'operatorLocationUpdate',
          userId,
          towRequestId,
          payload: {
            location: {
              lat: location.lat,
              lng: location.lng,
            },
            updatedAt: new Date().toISOString(),
          },
          metadata: {
            towOperatorId: userId,
            location: location,
          },
        });

        if (process.env['NODE_ENV'] === 'development') {
          console.log('Tow operator location update handled successfully for tow request:', towRequestId);
        }
      } else {
        socket.emit('locationUpdateError', {
          message: 'Tow request not found or could not be updated',
        });
      }
    } catch (error) {
      console.error('Error handling tow operator location update:', error);
      socket.emit('locationUpdateError', {
        message: 'Failed to handle location update',
      });
    }
  });

  // Generic chat event handler
  socket.on('chatEvent', async (data: { eventType: string; roomId: string; userId: string; payload?: any }) => {
    const sequenceNumber = Date.now();
    try {
      const { eventType, roomId, userId, payload } = data;
     
      console.log(`🔍 [${sequenceNumber}] Backend: Handling chat event`, {
        eventType,
        roomId,
        userId,
        socketId: socket.id,
        hasPayload: !!payload,
      });

      // Verify user is a participant in the room for most events
      if (['joinRoom', 'sendMessage', 'markAsRead', 'typing'].includes(eventType)) {
        console.log(`🔍 [${sequenceNumber}] Backend: Checking participant status for room ${roomId}`);
        const isParticipant = await Chat.ChatRoom.isUserParticipant(roomId, userId);
        console.log(`🔍 [${sequenceNumber}] Backend: Participant check result`, { isParticipant, roomId, userId });
        if (!isParticipant) {
          console.log(`🔍 [${sequenceNumber}] Backend: User not participant, emitting error`);
          socket.emit('chatError', { message: 'You are not a participant in this room' });
          return;
        }
      }

      let result;
      console.log(`🔍 [${sequenceNumber}] Backend: Processing event type: ${eventType}`);
      switch (eventType) {
        case 'joinRoom':
          console.log(`🔍 [${sequenceNumber}] Backend: Processing joinRoom for room ${roomId}`);
          socket.join(`chat-${roomId}`);
          console.log(`🔍 [${sequenceNumber}] Backend: Socket joined room, emitting userJoined notification`);
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'userJoined',
            roomId,
            userId,
            timestamp: new Date(),
          });

          // Create notification for user joining
          await createSocketEventNotification({
            eventType: 'userJoined',
            userId,
            chatRoomId: roomId,
            metadata: {
              roomId,
              timestamp: new Date(),
            },
          });

          // Create enhanced log for user joining
          try {
            const user = await userService.getUserById(new mongoose.Types.ObjectId(userId));
            if (user) {
              // Ensure user has required fields for logging
              const userForLog = {
                ...user,
                name:
                  (user as any)?.name ||
                  user?.fullName ||
                  `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() ||
                  user?.email ||
                  user?.id ||
                  'Unknown User',
                phoneNumber: user?.phoneNumber || '',
                email: user?.email || 'unknown@hitsparkingmanager.com',
                id: user?.id || 'unknown-id',
              };

              await logService.logCommunication({
                user: userForLog as any,
                type: 'chat',
                recipient: `Room ${roomId}`,
                event: `Socket Event: User joined chat room`,
                metadata: {
                  socketEvent: 'userJoined',
                  chatRoomId: roomId,
                  timestamp: new Date(),
                  ipAddress: socket.handshake.address,
                },
              });
            }
          } catch (logError) {
            console.error('Error creating enhanced log for user joining:', logError);
            // Continue execution even if logging fails
          }
          break;

        case 'leaveRoom':
          socket.leave(`chat-${roomId}`);
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'userLeft',
            roomId,
            userId,
            timestamp: new Date(),
          });

          // Create notification for user leaving
          await createSocketEventNotification({
            eventType: 'userLeft',
            userId,
            chatRoomId: roomId,
            metadata: {
              roomId,
              timestamp: new Date(),
            },
          });
          break;

        case 'sendMessage':
          console.log("Sending message to chat room", roomId);
          result = await chatService.sendMessage(userId, {
            roomId,
            content: payload.content,
            messageType: payload.messageType || 'text',
            replyTo: payload.replyTo,
            metadata: payload.metadata,
          });

          // Emit to all users in the room, including the sender
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'newMessage',
            roomId,
            message: result,
            timestamp: new Date(),
          });
          
          // Also emit to the sender for immediate UI update
          socket.emit('chatNotification', {
            eventType: 'newMessage',
            roomId,
            message: result,
            timestamp: new Date(),
          });

          // Create notification for new message
          await createSocketEventNotification({
            eventType: 'newMessage',
            userId,
            chatRoomId: roomId,
            payload: {
              message: result,
              content: payload.content,
              messageType: payload.messageType || 'text',
            },
            metadata: {
              roomId,
              timestamp: new Date(),
              replyTo: payload.replyTo,
            },
          });
          break;

        case 'markAsRead':
          console.log(`🔍 [${sequenceNumber}] Backend: Processing markAsRead for room ${roomId}`);
          await chatService.markRoomAsRead(roomId, userId);
          console.log(`🔍 [${sequenceNumber}] Backend: MarkAsRead completed, emitting messagesRead notification`);
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'messagesRead',
            roomId,
            userId,
            timestamp: new Date(),
          });
          break;

        case 'typing':
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'userTyping',
            roomId,
            userId,
            isTyping: payload.isTyping,
            timestamp: new Date(),
          });
          break;

        case 'createTowRequestChat':
          result = await chatService.createTowRequestChat(payload.towRequestId, userId);
          socket.join(result.id);
          socket.emit('chatNotification', {
            eventType: 'roomCreated',
            room: result,
            timestamp: new Date(),
          });

          // Create notification for room creation
          await createSocketEventNotification({
            eventType: 'roomCreated',
            userId,
            chatRoomId: result.id,
            towRequestId: payload.towRequestId,
            payload: {
              room: result,
            },
            metadata: {
              roomId: result.id,
              towRequestId: payload.towRequestId,
              timestamp: new Date(),
            },
          });
          break;

        case 'editMessage':
          result = await chatService.editMessage(payload.messageId, userId, payload.content);

          // Emit to all users in the room, including the sender
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'messageUpdated',
            roomId,
            message: result,
            timestamp: new Date(),
          });
          
          // Also emit to the sender for immediate UI update
          socket.emit('chatNotification', {
            eventType: 'messageUpdated',
            roomId,
            message: result,
            timestamp: new Date(),
          });

          // Create notification for message edit
          await createSocketEventNotification({
            eventType: 'messageUpdated',
            userId,
            chatRoomId: roomId,
            payload: {
              message: result,
              content: payload.content,
            },
            metadata: {
              messageId: payload.messageId,
              originalContent: payload.originalContent,
            },
          });
          break;

        case 'deleteMessage':
          await chatService.deleteMessage(payload.messageId, userId);

          // Emit to all users in the room, including the sender
          socket.to(`chat-${roomId}`).emit('chatNotification', {
            eventType: 'messageDeleted',
            roomId,
            messageId: payload.messageId,
            timestamp: new Date(),
          });
          
          // Also emit to the sender for immediate UI update
          socket.emit('chatNotification', {
            eventType: 'messageDeleted',
            roomId,
            messageId: payload.messageId,
            timestamp: new Date(),
          });

          // Create notification for message deletion
          await createSocketEventNotification({
            eventType: 'messageDeleted',
            userId,
            chatRoomId: roomId,
            payload: {
              messageId: payload.messageId,
            },
            metadata: {
              messageId: payload.messageId,
            },
          });
          break;

        default:
          console.log('Unknown chat event type:', eventType);
          return;
      }

      console.log(`🔍 [${sequenceNumber}] Backend: ${eventType} chat event handled successfully`);
    } catch (error) {
      console.error(`🔍 [${sequenceNumber}] Backend: Error handling chat event:`, error);
      socket.emit('chatError', {
        eventType: data.eventType,
        message: 'Failed to handle chat event',
      });
    }
  });
};
