import { bookParkingController, bookParkingValidation } from '../../modules/book-parking';
import express, { Router } from 'express';

import { auth } from '../../modules/auth';
// import { uploadMiddleware } from '../../modules/license/license.util';
// import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/')
  .get(auth('self'), validate(bookParkingValidation.getBookParkings), bookParkingController.getBookingParkings)
  // .post(authenticateApiKey, validate(bookParkingValidation.createUser), bookParkingController.createUser)
  .post(
    auth('self'),
    validate(bookParkingValidation.createBookParking),

    // uploadMiddleware.array('files'),
    bookParkingController.createBookingParking
  );

router
  .route('/parking/:id')
  .get(auth('self'), validate(bookParkingValidation.getBookParkingById), bookParkingController.getParkingDetailsById);
router
  .route('/:id')
  .get(auth('self'), validate(bookParkingValidation.getBookParkingById), bookParkingController.getBookingParkingById)
  .patch(auth('self'), validate(bookParkingValidation.updateBookParkingStatus), bookParkingController.updateBookParking);

router
  .route('/dashboard/status-counts')
  .get(auth('self'), bookParkingController.getBookParkingStatusCounts);
// .delete(auth('manageUsers'), validate(userValidation.deleteUser), userController.deleteUser);

export default router;
