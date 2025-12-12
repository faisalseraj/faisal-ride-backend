import express, { Router } from 'express';

// Faisal Ride - Kept Routes
import adminRoute from './admin.route';
import adminSubscriptionRoute from './admin-subscription.route';
import apiKeyRoutes from './apiKey.route';
import appRoutes from './apps.route';
import authRoute from './auth.route';
import chatRoute from './chat.route';
import emailRoute from './email.route';
import logRoute from './log.route';
import newUserRoute from './new-user.route';
import notificationRoute from './notification.route';
import pushSubscriptionRoute from './pushSubscription.route';
import revenueRoute from './revenue.route';
import rolesRoute from './roles.route';
import selfRoute from './self.route';
import smsRoute from './sms.route';
import stripeRoute from './stripe.route';
import subscriptionRoute from './subscription.route';
import superAdminRoute from './super-admin.route';
import systemSettingRoute from './systemSetting.route';
import tierRoute from './tier.route';
import tripRoute from './trip.route';
import unsubRoutes from './unsubscribe.route';
import userRoute from './user.route';

// Archived routes (removed for Faisal Ride refactor):
// - apartmentComplexRoute
// - bookParkingRoute
// - chatGPTRoute
// - geminiRoute
// - jurisdictionRoute
// - licenseProcessingRoute
// - licenseRoute
// - passkeyRoute
// - reportRoute
// - towRequestRoute
// - vsfRoute
// - xAIRoute

const router = express.Router();

interface IRoute {
  path: string;
  route: Router;
}

const defaultIRoute: IRoute[] = [
  // Core admin routes
  {
    path: '/admin',
    route: adminRoute,
  },
  {
    path: '/super-admin',
    route: superAdminRoute,
  },
  
  // Authentication
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/app',
    route: appRoutes,
  },
  
  // Communication
  {
    path: '/email',
    route: emailRoute,
  },
  {
    path: '/sms',
    route: smsRoute,
  },
  {
    path: '/chat',
    route: chatRoute,
  },
  {
    path: '/notifications',
    route: notificationRoute,
  },
  {
    path: '/push-subscription',
    route: pushSubscriptionRoute,
  },
  
  // User management
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/self',
    route: selfRoute,
  },
  {
    path: '/new-user',
    route: newUserRoute,
  },
  {
    path: '/roles',
    route: rolesRoute,
  },
  
  // Trips/Rides
  {
    path: '/trips',
    route: tripRoute,
  },
  
  // Subscriptions & Payments
  {
    path: '/subscriptions',
    route: subscriptionRoute,
  },
  {
    path: '/admin-subscriptions',
    route: adminSubscriptionRoute,
  },
  {
    path: '/stripe',
    route: stripeRoute,
  },
  {
    path: '/tiers',
    route: tierRoute,
  },
  {
    path: '/revenue',
    route: revenueRoute,
  },
  
  // System
  {
    path: '/system-settings',
    route: systemSettingRoute,
  },
  {
    path: '/apiKey',
    route: apiKeyRoutes,
  },
  {
    path: '/unsubscribe',
    route: unsubRoutes,
  },
  
  // Logs
  {
    path: '/logs',
    route: logRoute,
  },
];

defaultIRoute.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
