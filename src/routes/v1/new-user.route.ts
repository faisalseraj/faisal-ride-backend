import express, { Router } from 'express';
import { newUserController, newUserValidation } from '../../modules/new-user';

import { auth } from '../../modules/auth';
// import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/')
  .get(auth('getNewUsers'), newUserController.getUsers)
  // .post(authenticateApiKey, validate(userValidation.createUser), userController.createUser)
  .post(auth('createParkingSpacesUnpaid'), validate(newUserValidation.createUserWithType), newUserController.createNewUser);

router
  .route('/approve-reject-user')
  // .post(authenticateApiKey, validate(userValidation.createUser), userController.createUser)
  .post(auth('manageUsers'), validate(newUserValidation.approveRejectUser), newUserController.approveRejectUser);

router
  .route('/:id')
  .get(auth('manageUsers'), validate(newUserValidation.getUserById), newUserController.getUserById)
  .delete(auth('createParkingSpacesUnpaid'), validate(newUserValidation.getUserById), newUserController.deleteUserById);

export default router;
