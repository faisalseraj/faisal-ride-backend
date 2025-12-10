import * as vsfController from '../../modules/vsf/vsf.controller';

import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import { validate } from '../../modules/validate';
import { vsfValidation } from '../../modules/vsf/vsf.validation';

const router: Router = express.Router();

// VSF CRUD routes
router
  .route('/')
  .post(auth('manageVsfs'), validate(vsfValidation.createVSF), vsfController.createVSF)
  .get(auth('getVsfs'), validate(vsfValidation.getVSFs), vsfController.getVSFs);

// Specific routes (must come before parameterized routes)
router.route('/scrape').post(auth('manageVsfs'), validate(vsfValidation.scrapeVSFs), vsfController.scrapeVSFs);

// Bulk operations
router.route('/bulk').post(auth('manageVsfs'), validate(vsfValidation.bulkCreateVSFs), vsfController.bulkCreateVSFs);
router.route('/bulk').put(auth('manageVsfs'), validate(vsfValidation.bulkUpdateVSFs), vsfController.bulkUpdateVSFs);
router.route('/bulk').delete(auth('manageVsfs'), validate(vsfValidation.bulkDeleteVSFs), vsfController.bulkDeleteVSFs);

// Utility routes
router.route('/stats').get(auth('getVsfs'), vsfController.getVSFStats);
router.route('/search').get(auth('getVsfs'), vsfController.searchVSFs);
router.route('/search-location').get(auth('getVsfs'), validate(vsfValidation.searchVSFsByLocation), vsfController.searchVSFsByLocation);
router.route('/closest').get(auth('getVsfs'), vsfController.getClosestVSFs);
router.route('/mcr').get(auth('getVsfs'), validate(vsfValidation.getVSFByMcrNumber), vsfController.getVSFByMcrNumber);
router.route('/check').get(auth('getVsfs'), validate(vsfValidation.checkVSFExists), vsfController.checkVSFExists);

// Parameterized routes (must come after specific routes)
router
  .route('/:vsfId')
  .get(auth('getVsfs'), validate(vsfValidation.getVSF), vsfController.getVSF)
  .patch(auth('manageVsfs'), validate(vsfValidation.updateVSF), vsfController.updateVSF)
  .delete(auth('manageVsfs'), validate(vsfValidation.deleteVSF), vsfController.deleteVSF);

// Soft delete route
router.route('/:vsfId/soft-delete').patch(auth('manageVsfs'), validate(vsfValidation.deleteVSF), vsfController.softDeleteVSF);

export default router;
