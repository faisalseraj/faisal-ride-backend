import * as notificationController from './notification.controller';
import * as notificationValidation from './notification.validation';

import express, { Router } from 'express';

import { auth } from '../auth';
import { validate } from '../validate';

const router: Router = express.Router();

router
  .route('/')
  .post(auth(), validate(notificationValidation.createNotification), notificationController.createNotification)
  .get(auth(), validate(notificationValidation.getNotifications), notificationController.getNotifications);

router.route('/unread-count').get(auth(), notificationController.getUnreadCount);

router.route('/mark-all-read').post(auth(), notificationController.markAllAsRead);

router.route('/stats').get(auth(), notificationController.getNotificationStats);

router.route('/preferences').get(auth(), notificationController.getNotificationPreferences);

router
  .route('/:notificationId')
  .get(auth(), validate(notificationValidation.getNotificationById), notificationController.getNotificationById)
  .patch(auth(), validate(notificationValidation.updateNotification), notificationController.updateNotification)
  .delete(auth(), validate(notificationValidation.deleteNotification), notificationController.deleteNotification);

router
  .route('/:notificationId/mark-read')
  .post(auth(), validate(notificationValidation.markAsRead), notificationController.markAsRead);

export default router;
