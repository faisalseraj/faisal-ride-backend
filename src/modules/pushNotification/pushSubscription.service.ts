import PushSubscriptionModel from './pushSubscription.model';
import config from '../../config/config';
import webpush from 'web-push';

webpush.setVapidDetails('mailto:faisalseraj47@gmail.com', config.vapidPublicKey, config.vapidPrivateKey);

export const addSubscription = async (userId: string, subscription: any) => {
  await PushSubscriptionModel.updateOne(
    { endpoint: subscription.endpoint },
    { $set: { ...subscription, user: userId } },
    { upsert: true }
  );
};

export const removeSubscription = async (userId: string, subscription: any) => {
  await PushSubscriptionModel.deleteOne({
    endpoint: subscription.endpoint,
    user: userId
  });
};

export const sendToUsers = async (userIds: string[], title: string, body: string, url: string) => {
  const subs = await PushSubscriptionModel.find({ user: { $in: userIds } });
  const payload = JSON.stringify({ title, body, url });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub as any, payload);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ _id: sub._id });
      }
    }
  }
};
