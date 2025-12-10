import { auth, authValidation } from '../../modules/auth';
import express, { Router } from 'express';
import { userController, userValidation } from '../../modules/user';

// import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/')
  .get(auth('getUsers'), validate(userValidation.getUsers), userController.getUsers)
  // .post(authenticateApiKey, validate(userValidation.createUser), userController.createUser)
  .post(auth('createUserWithType'), validate(userValidation.createUserWithType), userController.createUserWithType);

router
  .route('/change-email-v2')
  .post(auth('changeEmail'), validate(authValidation.emailChangeV2), userController.updateEmailV2);
router
  .route('/resend-verification-link')
  .post(auth(), validate(authValidation.resendVerificationLink), userController.resendVerificationLink);
router.route('/list/:userType').get(auth(), validate(authValidation.listUser), userController.listUsers);
router.route('/getTowCompanyEmployees').post(auth('createUserWithType'), userController.getTowCompanyEmployees);
router
  .route('/renter/occupant')
  .post(auth('manageOccupant'), validate(userValidation.createOccupant), userController.createOccupant)
  .patch(auth('manageOccupant'), validate(userValidation.updateOccupant), userController.updateOccupant)
  .delete(auth('manageOccupant'), validate(userValidation.deleteOccupant), userController.deleteOccupant);
router
  .route('/renter/occupant/attach')
  .post(
    auth('manageOccupant'),
    validate(userValidation.attachOccupantToApartment),
    userController.attachOccupantToApartment
  );
// router.route('/apartment-complex-owner').get(auth('manageCompany'), userController.getApartmentComplexUsers);
router.route('/listTowCompanies').get(auth('self'), userController.listTowCompanies);
router.route('/searchUsers').get(auth('self'), userController.searchUsers);

router.route('/getFilters').get(auth(), userController.getFilters);
router.route('/get-my-tow-company-employees').get(auth('getMyTowEmployees'), userController.getMyTowCompanyEmployees);
router
  .route('/updateUserStatus/:userId')
  .patch(auth('manageStatus'), validate(userValidation.updateStatus), userController.updateUserStatus);
router.route('/notifications/:id').delete(auth(), validate(userValidation.notifications), userController.deleteNotification);
router
  .route('/promote-demote/:userId')
  .post(auth('manageUsers'), validate(userValidation.promoteDemote), userController.promoteDemoteUser);

router
  .route('/accept-reject-promote-demote')
  .post(
    auth('accept-reject-promote-demote'),
    validate(userValidation.acceptReject),
    userController.acceptRejectPromoteDemoteUser
  );
router.route('/generateQRCode/').post(auth(), validate(userValidation.generateQRCode), userController.generateQRCode);
router.route('/syncLocation').post(auth(), validate(userValidation.syncLocation), userController.syncLocation);

router
  .route('/generateParkingQRCode/:parkingId')
  .post(auth(), validate(userValidation.generateParkingQRCode), userController.generateParkingQRCode);
// router.route('/recover').post(auth('manageUsers'), validate(userValidation.recoverUser), userController.recoverUser);

router
  .route('/:userId')
  .get(auth('getUsers'), validate(userValidation.getUser), userController.getUser)
  .patch(auth('updateUser'), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth('manageUsers'), validate(userValidation.deleteUser), userController.deleteUser);

export default router;
