import express, { Router } from 'express';
import { unsubController, unsubValidation } from '../../modules/unsubscribe';

import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router.post('/decodeToken', authenticateApiKey, validate(unsubValidation.unsubscribe), unsubController.decodeToken);
router.post('/', authenticateApiKey, validate(unsubValidation.unsubscribe), unsubController.createUnsubscribe);

export default router;
