import { auth, checkSuperadmin } from '../../modules/auth';
import express, { Router } from 'express';
import { systemSettingsController, systemSettingsValidation } from '../../modules/system-settings';

// import { catchAsync } from '../../modules/utils';
// import multer from 'multer';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/')
  .get(
    auth('systemSettings'),
    checkSuperadmin,
    // validate(systemSettingsValidation.getSystemSettings),
    systemSettingsController.getSystemSettings
  )
  .post(
    auth('systemSettings'),
    checkSuperadmin,
    validate(systemSettingsValidation.updateSystemSettings),
    systemSettingsController.createSystemSettings
  )
  .patch(
    auth('systemSettings'),
    checkSuperadmin,
    validate(systemSettingsValidation.updateSystemSettings),
    systemSettingsController.updateSystemSettings
  );

router
  .route('/:id')
  .get(
    auth('systemSettings'),
    checkSuperadmin,
    // validate(systemSettingsValidation.getSystemSettings),
    systemSettingsController.getSystemSettings
  )
  .patch(
    auth('systemSettings'),
    checkSuperadmin,
    validate(systemSettingsValidation.updateSystemSettings),
    systemSettingsController.updateSystemSettings
  );
// .delete(
//   auth('admin'),
//   checkSuperadmin,
//   validate(systemSettingsValidation.getSystemSettings),
//   systemSettingsController.deleteSystemSettings
// );
// Configure multer to handle file uploads
// const upload = multer({ dest: '../uploads/' });

export default router;
