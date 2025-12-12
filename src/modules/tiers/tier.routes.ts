import express, { Router } from 'express';
import { tierController, tierValidation } from './';

import { auth } from '../auth';
import { validate } from '../validate';

const router: Router = express.Router();

router
  .route('/')
  .get(tierController.getTiers)
  .post(auth('manageTiers'), validate(tierValidation.tierValidation.createTier), tierController.createTier);

router.route('/active').get(tierController.getActiveTiers);

router
  .route('/:tierId')
  .get(tierController.getTier)
  .patch(auth('manageTiers'), validate(tierValidation.tierValidation.updateTier), tierController.updateTier)
  .delete(auth('manageTiers'), tierController.deleteTier);

router.route('/:tierId/hard-delete').delete(auth('manageTiers'), tierController.hardDeleteTier);

export default router;
