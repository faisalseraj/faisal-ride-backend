/**
 * Faisal Ride - Job Definitions
 * Background jobs for carpooling application
 */

import { getPulse } from '../lib/pulse';
import * as tripService from '../modules/trip/trip.service';

export const defineJobs = async () => {
  const pulse = getPulse();
  await pulse.start();

  // TODO: Add Faisal Ride specific jobs
  // Example jobs for carpooling:
  
  // Trip reminder before departure
  pulse.define('send trip reminder', async (job) => {
    const { tripId } = job.attrs.data as { tripId: string };
    console.log(`Trip reminder sent for trip ID: ${tripId}`);
    // TODO: Implement trip reminder notification
  });

  // Trip completion notification
  pulse.define('complete trip', async (job) => {
    const { tripId } = job.attrs.data as { tripId: string };
    console.log(`Trip completion notification sent for trip ID: ${tripId}`);
    // TODO: Implement trip completion notification
  });

  // Review reminder after trip
  pulse.define('send review reminder', async (job) => {
    const { tripId, userId } = job.attrs.data as { tripId: string; userId: string };
    console.log(`Review reminder sent for trip ${tripId} to user ${userId}`);
    // TODO: Implement review reminder
  });

  // Auto-reject expired booking requests (runs every 15 minutes)
  pulse.define('auto-reject-expired-bookings', async () => {
    console.log('⏰ Running auto-reject job for expired booking requests...');
    try {
      await tripService.autoRejectExpiredBookings();
      console.log('✅ Auto-reject job completed successfully');
    } catch (error) {
      console.error('❌ Error in auto-reject job:', error);
    }
  });

  // Schedule auto-reject job to run every 15 minutes
  await pulse.every('15 minutes', 'auto-reject-expired-bookings');

  console.log('Faisal Ride jobs initialized');
};
