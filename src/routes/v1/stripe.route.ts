import express from 'express';
import { stripeRoutes } from '../../modules/stripe';

const router = express.Router();

// Stripe webhook is now handled directly in app.ts before express.json() middleware
// All other Stripe routes
router.use('/', stripeRoutes);

export default router;
