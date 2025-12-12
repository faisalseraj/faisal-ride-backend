import { Router } from 'express';
import smsRoutes from '../../modules/sms/sms.routes';

const router = Router();

// Mount SMS routes
router.use('/', smsRoutes);

export default router;
