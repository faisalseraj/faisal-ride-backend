import express, { Router } from 'express';
import { towRequestController, towRequestValidation } from '../../modules/tow-request';

import { auth } from '../../modules/auth';
import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/')
  .get(auth('self'), validate(towRequestValidation.getTowRequests), towRequestController.getTowRequests)
  .post(auth('createTow'), towRequestController.createTowRequest);
router.route('/getNextInvoiceNumber').get(auth('self'), towRequestController.getNextInvoiceNumber);

router
  .route('/assignTow')
  .post(auth('assignTow'), validate(towRequestValidation.assignTowToOperator), towRequestController.assignTowToOperator);

router
  .route('/forceAssignTow')
  .post(auth('assignTow'), validate(towRequestValidation.assignTowToOperator), towRequestController.forceAssignTowToOperator);

router
  .route('/:towRequestId/assignToSelf')
  .post(auth('assignTow'), towRequestController.assignTowToSelf);

router
  .route('/:towRequestId/reassign')
  .post(auth('assignTow'), towRequestController.reassignTowRequest);

router
  .route('/:towRequestId/live-location')
  .post(auth('updateTow'), towRequestController.updateLiveLocation);

router
  .route('/:towRequestId/mark-picked-up')
  .post(auth('updateTow'), towRequestController.markVehiclePickedUp);
  
router
  .route('/oneTimeInviteLink')
  .post(auth('oneTimeInviteLink'), validate(towRequestValidation.oneTimeInviteLink), towRequestController.createOneTimeLink);

router
  .route('/check-passkey-requirement/:pspId')
  .get(auth('self'), towRequestController.checkPasskeyRequirement);

router
  .route('/validate-referer/:refererId')
  .get(auth('self'), towRequestController.validateReferer);

router
  .route('/updateTowRequestStatus')
  .post(
    auth('updateTowRequestStatus'),
    validate(towRequestValidation.updateTowRequestStatus),
    towRequestController.updateTowRequestStatus
  );

router
  .route('/followUpTowRequest')
  .post(auth('self'), validate(towRequestValidation.followUpTowRequest), towRequestController.followUpTowRequest);

router
  .route('/verifyOneTimeLink/:token')
  .post(authenticateApiKey, validate(towRequestValidation.verifyOneTimeInviteLink), towRequestController.handleInviteLink);
//not needed fow now
// router
//   .route('/checkGraceTime/:token')
//   .post(authenticateApiKey, validate(towRequestValidation.verifyOneTimeInviteLink), towRequestController.checkGraceTime);

router
  .route('/discardCrossCompanyTransfer/:token')
  .post(
    auth('self'),
    validate(towRequestValidation.verifyOneTimeInviteLink),
    towRequestController.discardCrossCompanyTransfer
  );

  router
  .route('/getTowRequestsIDs')
  .get(auth('self'), towRequestController.getTowRequestByIDs)

router
  .route('/dashboard/status-counts')
  .get(auth('self'), towRequestController.getTowRequestStatusCounts)

router
  .route('/count-and-limit')
  .get(auth('self'), towRequestController.getTowRequestCountAndLimit)

router
  .route('/pending-assignment')
  .get(auth('self'), towRequestController.getPendingAssignment)

router
  .route('/most-recent-active')
  .get(auth('self'), towRequestController.getMostRecentActiveTowRequest)

router
  .route('/recent-license-plates')
  .get(auth('self'), towRequestController.getRecentLicensePlates)

router
  .route('/pending-invites')
  .get(auth('self'), towRequestController.getPendingTowInvites)

router
  .route('/sent-invites')
  .get(auth('self'), towRequestController.getSentTowInvites)

router
  .route('/revoke-invite/:token')
  .post(auth('self'), towRequestController.revokeTowInvite)

router
  .route('/resend-invite/:token')
  .post(auth('self'), towRequestController.resendTowInvite)

router
  .route('/reject-invite/:token')
  .post(auth('self'), towRequestController.rejectTowInvite)

router
  .route('/:towRequestId/location')
  .post(auth('self'), towRequestController.updateOperatorLocation);

router
  .route('/:towRequestId/invoice/pdf')
  .get(auth('getTowRequests'), validate(towRequestValidation.getTowRequestById), towRequestController.downloadInvoicePDF);

router
  .route('/:towRequestId/invoice/email')
  .post(auth('getTowRequests'), validate(towRequestValidation.getTowRequestById), towRequestController.emailInvoicePDF);

router
  .route('/:towRequestId')
  .get(auth('getTowRequests'), validate(towRequestValidation.getTowRequestById), towRequestController.getTowRequestById)
  .patch(auth('createTow'), validate(towRequestValidation.updateTowRequest), towRequestController.updateTowRequest);
// .delete(auth('manageUsers'), validate(userValidation.deleteUser), userController.deleteUser);

export default router;
