import express, { Router } from 'express';

import adminRoute from './admin.route';
import adminSubscriptionRoute from './admin-subscription.route';
import apartmentComplexRoute from './apartmentComplex.route';
import apiKeyRoutes from './apiKey.route';
import appRoutes from './apps.route';
import authRoute from './auth.route';
import bookParkingRoute from './book-parking.route';
import chatGPTRoute from './chatGPT.route';
import chatRoute from './chat.route';
import emailRoute from './email.route';
import enhancedLogRoute from './enhanced-log.route';
import geminiRoute from './gemini.route';
import jurisdictionRoute from './jurisdiction.route';
import licenseProcessingRoute from './license-processing.route';
import licenseRoute from './license.route';
import logRoute from './log.route';
import newUserRoute from './new-user.route';
import notificationRoute from './notification.route';
import passkeyRoute from './passkey.route';
import pushSubscriptionRoute from './pushSubscription.route';
import reportRoute from './report.route';
import revenueRoute from './revenue.route';
import rolesRoute from './roles.route';
import selfRoute from './self.route';
import smsRoute from './sms.route';
import stripeRoute from './stripe.route';
import subscriptionRoute from './subscription.route';
import superAdminRoute from './super-admin.route';
import systemSettingRoute from './systemSetting.route';
import tierRoute from './tier.route';
import towRequestRoute from './tow-request.route';
// by GD
import unsubRoutes from './unsubscribe.route';
import userRoute from './user.route';
import vsfRoute from './vsf.route';
import xAIRoute from './xAI.route';

const router = express.Router();

interface IRoute {
  path: string;
  route: Router;
}

const defaultIRoute: IRoute[] = [
  {
    path: '/admin',
    route: adminRoute,
  },
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/app',
    route: appRoutes,
  },
  {
    path: '/email',
    route: emailRoute,
  },
  {
    path: '/sms',
    route: smsRoute,
  },
  {
    path: '/apiKey',
    route: apiKeyRoutes,
  },
  {
    path: '/unsubscribe',
    route: unsubRoutes,
  },

  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/logs',
    route: logRoute,
  },
  {
    path: '/self',
    route: selfRoute,
  },
  {
    path: '/chatGPT',
    route: chatGPTRoute,
  },
  {
    path: '/chat',
    route: chatRoute,
  },
  {
    path: '/gemini',
    route: geminiRoute,
  },
  {
    path: '/xAI',
    route: xAIRoute,
  },

  {
    path: '/license',
    route: licenseRoute,
  },

  {
    path: '/apartmentComplex',
    route: apartmentComplexRoute,
  },
  {
    path: '/super-admin',
    route: superAdminRoute,
  },
  {
    path: '/system-settings',
    route: systemSettingRoute,
  },
  {
    path: '/tiers',
    route: tierRoute,
  },
  {
    path: '/subscriptions',
    route: subscriptionRoute,
  },
  {
    path: '/stripe',
    route: stripeRoute,
  },
  {
    path: '/admin-subscriptions',
    route: adminSubscriptionRoute,
  },
  {
    path: '/revenue',
    route: revenueRoute,
  },

  {
    path: '/license-processing',
    route: licenseProcessingRoute,
  },

  {
    path: '/new-user',
    route: newUserRoute,
  },
  {
    path: '/tow-request',
    route: towRequestRoute,
  },
  {
    path: '/push-subscription',
    route: pushSubscriptionRoute,
  },

  {
    path: '/book-parking',
    route: bookParkingRoute,
  },
  {
    path: '/jurisdictions',
    route: jurisdictionRoute,
  },
  {
    path: '/enhanced-logs',
    route: enhancedLogRoute,
  },
  {
    path: '/notifications',
    route: notificationRoute,
  },
  {
    path: '/passkeys',
    route: passkeyRoute,
  },
  {
    path: '/vsf',
    route: vsfRoute,
  },
  {
    path: '/reports',
    route: reportRoute,
  },
  {
    path: '/roles',
    route: rolesRoute,
  },
];

defaultIRoute.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
