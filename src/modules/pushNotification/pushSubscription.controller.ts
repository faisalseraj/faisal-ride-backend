import { Request, Response } from 'express';

import { pushSubscriptionService } from '.';

export const subscribe = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // from auth middleware
    const subscription = req.body;
    await pushSubscriptionService.addSubscription(userId, subscription);
    return res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to subscribe' });
  }
};

export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // from auth middleware
    const subscription = req.body;
    await pushSubscriptionService.removeSubscription(userId, subscription);
    return res.status(200).json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unsubscribe' });
  }
};
