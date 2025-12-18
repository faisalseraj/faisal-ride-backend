/**
 * Faisal Ride - User Routes
 * Simplified routes for carpooling application
 */

import express, { Router } from 'express';
import { userController, userValidation } from '../../modules/user';

import { auth } from '../../modules/auth';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

// ============================================
// USER MANAGEMENT (Admin)
// ============================================

router
  .route('/')
  .get(auth('getUsers'), validate(userValidation.getUsers), userController.getUsers)
  .post(auth('createUser'), validate(userValidation.createUser), userController.createUser);

router.route('/admins')
  .get(auth('manageAdmins'), userController.getAllAdmins)
  .post(auth('manageAdmins'), validate(userValidation.createAdmin), userController.createAdmin);

router.route('/riders')
  .get(auth(), validate(userValidation.getRiders), userController.getRiders);

router.route('/search')
  .get(auth(), validate(userValidation.searchUsers), userController.searchUsers);

router.route('/filters')
  .get(auth(), userController.getFilters);

// ============================================
// USER PROFILE (Self)
// ============================================

router.route('/profile')
  .patch(auth(), validate(userValidation.updateProfile), userController.updateProfile);

router.route('/vehicle')
  .patch(auth(), validate(userValidation.updateVehicle), userController.updateVehicle);

router.route('/ride-preferences')
  .patch(auth(), validate(userValidation.updateRidePreferences), userController.updateRidePreferences);

router.route('/syncLocation')
  .post(auth(), validate(userValidation.syncLocation), userController.syncLocation);

// ============================================
// NOTIFICATIONS
// ============================================

router.route('/notifications/:notificationId/read')
  .patch(auth(), validate(userValidation.notification), userController.markNotificationAsRead);

router.route('/notifications/:notificationId')
  .delete(auth(), validate(userValidation.notification), userController.deleteNotification);

// ============================================
// VERIFICATION
// ============================================

router.route('/resend-verification')
  .post(auth(), validate(userValidation.resendVerificationEmail), userController.resendVerificationEmail);

router.route('/:userId/verify-license')
  .post(auth('verifyDriver'), validate(userValidation.verifyDriversLicense), userController.verifyDriversLicense);

// ============================================
// USER STATUS (Admin)
// ============================================

router.route('/:userId/status')
  .patch(auth('manageUsers'), validate(userValidation.updateUserStatus), userController.updateUserStatus);

router.route('/:userId/super-admin')
  .patch(auth('manageSuperAdmin'), validate(userValidation.updateSuperAdmin), userController.updateSuperAdmin);

// ============================================
// INDIVIDUAL USER (CRUD)
// ============================================

router
  .route('/:userId')
  .get(auth('getUsers'), validate(userValidation.getUser), userController.getUser)
  .patch(auth('updateUser'), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth('deleteUser'), validate(userValidation.deleteUser), userController.deleteUser);

export default router;
