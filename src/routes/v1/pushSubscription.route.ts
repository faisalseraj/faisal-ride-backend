import { Router } from 'express';
import { auth } from '../../modules/auth';
import { pushSubscriptionController } from '../../modules/pushNotification';

const router = Router();
router.post('/subscribe', auth(), pushSubscriptionController.subscribe);
router.post('/unsubscribe', auth(), pushSubscriptionController.unsubscribe);

export default router;
