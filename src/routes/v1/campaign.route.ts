import { campaignController, emailValidation } from '../../modules/email';
import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import { userController } from '../../modules/user';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router.route('/getFilters').get(auth('runCampaign'), userController.getFilters);
// router.route('/getUsers').get(auth('runCampaign'), userController.getUsersWithAdvancedFilter);
router.route('/smsCampaign').post(auth('runCampaign'), validate(emailValidation.smsCampaign), campaignController.sendCampaignSMS);

export default router;
