import express from 'express';
import { revenueRoutes } from '../../modules/revenue/revenue.routes';

const router = express.Router();

router.use('/', revenueRoutes);

export default router;
