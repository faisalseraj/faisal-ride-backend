import { chatController, chatValidation } from '.';

import { auth } from '../auth';
import express from 'express';
import { validate } from '../validate';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth());

// ---------- Room Management Routes ----------
router.post('/rooms', auth(), validate(chatValidation.createRoom), chatController.createRoom);
router.get('/rooms', auth(), chatController.getUserRooms);
router.get('/rooms/:roomId', auth(), validate(chatValidation.getRoomById), chatController.getRoomById);
router.put('/rooms/:roomId/name', auth(), chatController.updateRoomName);
router.post('/rooms/participants', auth(), validate(chatValidation.addParticipant), chatController.addParticipant);
router.delete('/rooms/participants', auth(), validate(chatValidation.removeParticipant), chatController.removeParticipant);

// ---------- Message Management Routes ----------
router.post('/messages', auth(), validate(chatValidation.sendMessage), chatController.sendMessage);
router.get('/messages', auth(), validate(chatValidation.getMessages), chatController.getRoomMessages);
router.post('/messages/read', auth(), validate(chatValidation.markRoomAsRead), chatController.markRoomAsRead);
router.post('/messages/read-all', auth(), chatController.markAllRoomsAsRead);
router.put('/messages/edit', validate(chatValidation.editMessage), chatController.editMessage);
router.delete('/messages/:messageId', auth(), validate(chatValidation.deleteMessage), chatController.deleteMessage);
router.get('/unread-count', validate(chatValidation.getUnreadCount), chatController.getUnreadCount);
router.get('/total-unread-count', auth(), chatController.getTotalUnreadCount);

// ---------- Direct Chat Routes ----------
router.post('/direct', auth(), chatController.createDirectChat);
router.get('/direct', auth(), chatController.getDirectChats);

// ---------- Tow Request Integration Routes ----------
router.post(
  '/tow-request/:towRequestId',
  auth(),
  validate(chatValidation.createTowRequestChat),
  chatController.createTowRequestChat
);
router.get(
  '/tow-request/:towRequestId',
  auth(),
  chatController.getTowRequestChatRoom
);

// ---------- Test Routes ----------
router.post('/test/room-notification', auth(), chatController.testRoomNotification);

export default router;
