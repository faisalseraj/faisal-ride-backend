import { ApiError, errorHandler } from './modules/errors';
import express, { Express } from 'express';

import { Constants } from './modules/utils/Constants';
import ExpressMongoSanitize from 'express-mongo-sanitize';
import { RequestHandler } from 'express';
import { Server } from 'socket.io';
import { UserSocketConnection } from './modules/socket/socket.connection';
import { authLimiter } from './modules/utils';
import compression from 'compression';
import config from './config/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import helmet from 'helmet';
import httpStatus from 'http-status';
import { jwtStrategy } from './modules/auth';
import { morgan } from './modules/logger'; // ✅ if you re-exported, else `import morgan from "morgan"`
import passport from 'passport';
import routes from './routes/v1';
import xss from 'xss-clean';

const app: Express = express();

// static assets
app.use('/images', express.static('public'));

// middleware
app.use(cookieParser());

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  // app.use(morgan.errorHandler);
}

// security headers
app.use(helmet());

// enable CORS
app.use(cors() as unknown as RequestHandler);

// Stripe webhook endpoint (needs raw body - MUST be before express.json())
app.use('/v1/stripe/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Import the webhook handler here to avoid circular dependencies
  const { handleStripeWebhook } = require('./modules/stripe/webhook.handler');
  handleStripeWebhook(req, res, next);
});

// body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// sanitize data
app.use(xss() as any); // 👈 add `as any` if TS complains (since no types)
app.use(ExpressMongoSanitize());

// gzip compression
app.use(compression() as unknown as RequestHandler);

// passport jwt
app.use(passport.initialize() as unknown as RequestHandler);
passport.use('jwt', jwtStrategy);

console.log('🚀 App initialized');

// limit brute force attempts in prod
if (config.serverType === Constants.productionServer) {
  app.use('/v1/auth', authLimiter);
}

// create HTTP + socket.io server
const httpServer = createServer(app);

export const IoSocket = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
});

console.log('🔌 Socket.IO server initialized');
console.log('  - CORS enabled for all origins');
console.log('  - Engine.IO v3 compatibility enabled');

IoSocket.on('connection', UserSocketConnection);

// // Add connection debugging
// IoSocket.engine.on('connection_error', (err) => {
//   console.error('🚨 Socket.IO Engine connection error:', err);
//   console.error('  - Error code:', err.code);
//   console.error('  - Error message:', err.message);
//   console.error('  - Error context:', err.context);
// });

// v1 routes
app.use('/v1', routes);

// simple server check
app.use('/checkServer', async (req, res) => {
  res.status(200).send(req.headers);
});

// Socket.IO test endpoint
app.get('/socket-test', (req, res) => {
  res.status(200).json({
    message: 'Socket.IO server is accessible',
    socketUrl: `http://${req.get('host')}/socket.io/`,
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    engineIO: 'v3 compatible',
  });
});

// 404 handler
app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// global error handler
app.use(errorHandler);

export default httpServer;
