import express from 'express';
import { tripRoutes } from '../../modules/trip';

const router = express.Router();

router.use('/', tripRoutes);

export default router;
