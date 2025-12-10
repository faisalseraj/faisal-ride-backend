// Disable console logs in non-LOCAL environments
import './utils/disable-console';

import app from './app';
import config from './config/config';
import { defineJobs } from './jobs/reminder.job';
import { initializeRolePermissionsCache } from './modules/roles/role-permissions-cache';
import logger from './modules/logger/logger';
import mongoose from 'mongoose';

// import { testingAllOTPs } from './modules/otp/otp.service';
// import { sendMeAllEmails } from './modules/email/email.service';
// sendMeAllEmails()
// testingAllOTPs()
let server: any;
mongoose.connect(config.mongoose.url).then(async () => {
  logger.info('Connected to MongoDB!');

  // Initialize role permissions cache from database
  try {
    await initializeRolePermissionsCache();
  } catch (error) {
    logger.error('Failed to initialize role permissions cache:', error);
    // Continue anyway - cache will fallback to config file
  }

  // Start server (HTTP + Socket.IO on same port)
  server = app.listen(config.port, () => {
    logger.info(`🚀 Server listening on port ${config.port} (HTTP + Socket.IO)`);
    console.log('🔌 Socket.IO server ready for connections');
    console.log(`  - Server URL: http://localhost:${config.port}`);
    console.log(`  - Socket URL: http://localhost:${config.port}/socket.io/`);
    console.log(`  - Environment: ${config.env}`);
    console.log(`  - Server Type: ${config.serverType}`);
  });

  defineJobs();
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit();
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: string) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
