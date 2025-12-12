import auth from '../auth/auth.middleware';
import authOptional from '../auth/auth.middleware.optional';
import express from 'express';
import tripController from './trip.controller';
import tripValidation from './trip.validation';
import validate from '../validate/validate.middleware';

const router = express.Router();

router
  .route('/')
  .post(
    auth(),
    validate(tripValidation.createTrip),
    tripController.createTrip
  )
  .get(
    authOptional(),
    validate(tripValidation.searchTrips),
    tripController.searchTrips
  );

router
  .route('/my-trips')
  .get(auth(), tripController.getMyTrips);

router
  .route('/my-bookings')
  .get(auth(), tripController.getMyBookings);

router
  .route('/:tripId')
  .get(
    authOptional(),
    validate(tripValidation.getTrip),
    tripController.getTrip
  )
  .patch(
    auth(),
    validate(tripValidation.updateTrip),
    tripController.updateTrip
  )
  .delete(
    auth(),
    validate(tripValidation.deleteTrip),
    tripController.deleteTrip
  );

router
  .route('/:tripId/book')
  .post(
    auth(),
    validate(tripValidation.bookTrip),
    tripController.bookTrip
  );

router
  .route('/:tripId/cancel-booking')
  .post(
    auth(),
    validate(tripValidation.cancelBooking),
    tripController.cancelBooking
  );

router
  .route('/:tripId/complete')
  .post(
    auth(),
    validate(tripValidation.completeTrip),
    tripController.completeTrip
  );

export default router;
