import { jurisdictionController, jurisdictionValidation } from '../../modules/jurisdiction';

import { auth } from '../../modules/auth';
import express from 'express';
import { validate } from '../../modules/validate';

const router = express.Router();

router
  .route('/')
  .get(auth('self'), validate(jurisdictionValidation.getJurisdictions), jurisdictionController.getJurisdictions)
  .post(
    auth('jurisdiction'),
    validate(jurisdictionValidation.createJurisdiction),
    jurisdictionController.createJurisdiction
  );

router
  .route('/bulk-update')
  .patch(
    auth('jurisdiction'),
    validate(jurisdictionValidation.bulkUpdateJurisdictions),
    jurisdictionController.bulkUpdateJurisdictions
  );

router
  .route('/:jurisdictionId')
  .get(auth('self'), jurisdictionController.getJurisdiction)
  .patch(
    auth('jurisdiction'),
    validate(jurisdictionValidation.updateJurisdiction),
    jurisdictionController.updateJurisdiction
  )
  .delete(auth('jurisdiction'), jurisdictionController.deleteJurisdiction);

export default router;
