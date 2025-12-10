import express, { Router } from 'express';
import { licenseController, licenseValidation } from '../../modules/license';

import { auth } from '../../modules/auth';
import { uploadMiddleware } from '../../modules/license/license.util';
import { validate } from '../../modules/validate';

uploadMiddleware;
const router: Router = express.Router();
// router.route('/scan/azure-ocr').post(auth(), licenseController.scanLicenseWithAzure);
router.route('/scan/license-with-ocr').post(
  auth(),
  validate(licenseValidation.scanLicensesWithOcr),
  uploadMiddleware.array('files') as unknown as express.RequestHandler,
  // addUUIDToFiles as any,
  licenseController.scanLicenseWithGoogleVision
);

router.route('/scan/license-with-ocr-v1').post(
  auth(),
  validate(licenseValidation.scanLicensesWithOcr),
  uploadMiddleware.array('files') as unknown as express.RequestHandler,

  licenseController.runLicenseScanWithCustomOCR
);

router.route('/cropLicensePlate').post(
  auth(),
  uploadMiddleware.array('files') as unknown as express.RequestHandler,

  licenseController.cropLicensePlate
);

router.route('/cropVinNumber').post(
  auth(),
  uploadMiddleware.array('files') as unknown as express.RequestHandler,

  licenseController.cropVinNumber
);

router.route('/decodeVin').get(auth('self'), licenseController.decodeVin);

export default router;
