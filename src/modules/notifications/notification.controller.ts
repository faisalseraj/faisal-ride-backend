import { Request, Response } from 'express';

import { IUserDoc } from '../user/user.interfaces';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import { notificationService } from './';
import pick from '../utils/pick';

export const createNotification = catchAsync(async (req: Request, res: Response) => {
  const notification = await notificationService.createNotification(req.body);
  res.status(httpStatus.CREATED).send(notification);
});

export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const options = pick(req.query, ['page', 'limit', 'category', 'type', 'isRead', 'priority']);
  const result = await notificationService.getNotificationsForUser(user.id, options);
  res.send(result);
});

export const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const count = await notificationService.getUnreadCount(user.id);
  res.send({ unreadCount: count });
});

export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const { notificationId } = req.params;
  const notification = await notificationService.markAsRead(notificationId!, user.id);
  res.send(notification);
});

export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const count = await notificationService.markAllAsRead(user.id);
  res.send({ markedAsRead: count });
});

export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const { notificationId } = req.params;
  await notificationService.deleteNotification(notificationId!, user.id);
  res.status(httpStatus.NO_CONTENT).send();
});

export const getNotificationById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const { notificationId } = req.params;
  const notification = await notificationService.getNotificationById(notificationId!, user.id);
  res.send(notification);
});

export const updateNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const { notificationId } = req.params;
  const notification = await notificationService.updateNotification(notificationId!, user.id, req.body);
  res.send(notification);
});

export const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const stats = await notificationService.getNotificationStats(user.id);
  res.send(stats);
});

export const getNotificationPreferences = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const preferences = await notificationService.getNotificationPreferences(user.id);
  res.send(preferences);
});
