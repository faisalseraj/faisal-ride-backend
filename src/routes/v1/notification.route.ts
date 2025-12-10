import { Router } from 'express';
import notificationRoutes from '../../modules/notifications/notification.routes';

const router = Router();

router.use('/', notificationRoutes);

export default router;
