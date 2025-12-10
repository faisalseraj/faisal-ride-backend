// src/jobs/reminder.job.ts
import { bookParkingService } from '../modules/book-parking';
// import { defineSubscriptionJobs } from './subscription.job';
import { getPulse } from '../lib/pulse';
import { sendAllScheduledReports } from '../modules/reports/scheduled-reports.service';
import { towRequestService } from '../modules/tow-request';

export const defineJobs = async () => {
  const pulse = getPulse();
  await pulse.start();
  pulse.define('send booking reminder', async (job) => {
    const { bookingId } = job.attrs.data as { bookingId: string };
    await bookParkingService.parkingReminderNotification(bookingId);

    console.log(`Reminder sent to `);
  });

  pulse.define('complete booking', async (job) => {
    const { bookingId } = job.attrs.data as { bookingId: string };
    await bookParkingService.parkingCompletionNotification(bookingId);

    console.log(`Parking completion notification sent for booking ID: ${bookingId}`);
  });

  pulse.define('sendTokenExpiryNotificationToManager', async (job) => {
    const { token } = job.attrs.data as { token: string };
    await towRequestService.sendTokenExpiryNotificationToManager(token);
  });
  pulse.define('sendTokenExpiryNotificationToInvitee', async (job) => {
    const { token } = job.attrs.data as { token: string };
    await towRequestService.sendTokenExpiryNotificationToInvitee(token);
  });

  pulse.define('autoApproveTowRequest', async (job) => {
    const { towRequestId } = job.attrs.data as { towRequestId: string };
    await towRequestService.autoApproveTowRequest(towRequestId);
  });

  pulse.define('autoApproveCrossCompanyTransfer', async (job) => {
  const { actorId, targetUserId, fromCompanyId, toCompanyId, token } = job.attrs.data as {
    actorId: string;
    targetUserId: string;
    fromCompanyId: string;
    toCompanyId: string;
    token:string
  };

  await towRequestService.autoApproveCrossCompanyTransfer(actorId, targetUserId, fromCompanyId, toCompanyId, token);
});

  pulse.define('autoRejectTowRequest', async (job) => {
    const { towRequestId } = job.attrs.data as { towRequestId: string };
    await towRequestService.autoRejectTowRequest(towRequestId);
    console.log(`Auto-rejection job completed for tow request: ${towRequestId}`);
  });

  // Scheduled Report Jobs - with auto-rescheduling
  pulse.define('sendWeeklyReports', async () => {
    console.log('Weekly scheduled reports job started');
    try {
      await sendAllScheduledReports('weekly');
      console.log('Weekly scheduled reports job completed');
    } finally {
      // Reschedule for next Sunday at 9 PM UTC
      const nextRun = new Date();
      const daysUntilSunday = (7 - nextRun.getUTCDay()) % 7 || 7;
      nextRun.setUTCDate(nextRun.getUTCDate() + daysUntilSunday);
      nextRun.setUTCHours(21, 0, 0, 0); // 9 PM UTC
      await pulse.schedule(nextRun, 'sendWeeklyReports', {});
      console.log(`Weekly reports rescheduled for ${nextRun.toISOString()}`);
    }
  });

  // pulse.define('sendMonthlyReports', async () => {
  //   console.log('Monthly scheduled reports job started');
  //   try {
  //     await sendAllScheduledReports('monthly');
  //     console.log('Monthly scheduled reports job completed');
  //   } finally {
  //     // Reschedule for next month (1st at 8 AM UTC)
  //     const nextRun = new Date();
  //     nextRun.setUTCMonth(nextRun.getUTCMonth() + 1, 1);
  //     nextRun.setUTCHours(8, 0, 0, 0);
  //     await pulse.schedule(nextRun, 'sendMonthlyReports', {});
  //     console.log(`Monthly reports rescheduled for ${nextRun.toISOString()}`);
  //   }
  // });

  // pulse.define('sendYearlyReports', async () => {
  //   console.log('Yearly scheduled reports job started');
  //   try {
  //     await sendAllScheduledReports('yearly');
  //     console.log('Yearly scheduled reports job completed');
  //   } finally {
  //     // Reschedule for next year (December 31st at 9 PM UTC)
  //     const nextRun = new Date();
  //     nextRun.setUTCFullYear(nextRun.getUTCFullYear() + 1, 11, 31); // December 31st
  //     nextRun.setUTCHours(21, 0, 0, 0); // 9 PM UTC
  //     await pulse.schedule(nextRun, 'sendYearlyReports', {});
  //     console.log(`Yearly reports rescheduled for ${nextRun.toISOString()}`);
  //   }
  // });

  // // Initialize recurring report jobs (only if they don't already exist)
  // const existingWeekly = await pulse.jobs({ name: 'sendWeeklyReports' });
  // const existingMonthly = await pulse.jobs({ name: 'sendMonthlyReports' });
  // const existingYearly = await pulse.jobs({ name: 'sendYearlyReports' });

  // // Weekly: Every Sunday at 9:00 PM UTC (for previous week's report)
  // if (existingWeekly.length === 0) {
  //   const now = new Date();
  //   const nextSunday = new Date(now);
  //   const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  //   nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  //   nextSunday.setUTCHours(21, 0, 0, 0); // 9 PM UTC
    
  //   // If today is Sunday and it's before 9 PM, schedule for today
  //   if (now.getUTCDay() === 0 && now.getUTCHours() < 21) {
  //     nextSunday.setUTCDate(now.getUTCDate());
  //   }
    
  //   await pulse.schedule(nextSunday, 'sendWeeklyReports', {});
  //   console.log(`Scheduled weekly reports: First run on ${nextSunday.toISOString()} (Sunday 9 PM UTC)`);
  // }

  // // Monthly: First day of every month at 8:00 AM UTC (for previous month's report)
  // if (existingMonthly.length === 0) {
  //   const now = new Date();
  //   const nextMonth = new Date(now);
  //   // If today is the 1st and before 8 AM, schedule for today, otherwise next month
  //   if (now.getUTCDate() === 1 && now.getUTCHours() < 8) {
  //     nextMonth.setUTCHours(8, 0, 0, 0);
  //   } else {
  //     nextMonth.setUTCMonth(now.getUTCMonth() + 1, 1);
  //     nextMonth.setUTCHours(8, 0, 0, 0);
  //   }
    
  //   await pulse.schedule(nextMonth, 'sendMonthlyReports', {});
  //   console.log(`Scheduled monthly reports: First run on ${nextMonth.toISOString()} (1st of month 8 AM UTC)`);
  // }

  // // Yearly: December 31st at 9:00 PM UTC (for current year's report)
  // if (existingYearly.length === 0) {
  //   const now = new Date();
  //   const nextYearEnd = new Date(now);
  //   // If today is Dec 31 and before 9 PM, schedule for today, otherwise next year's Dec 31
  //   if (now.getUTCMonth() === 11 && now.getUTCDate() === 31 && now.getUTCHours() < 21) {
  //     nextYearEnd.setUTCHours(21, 0, 0, 0);
  //   } else {
  //     nextYearEnd.setUTCFullYear(now.getUTCFullYear() + 1, 11, 31); // December 31st
  //     nextYearEnd.setUTCHours(21, 0, 0, 0); // 9 PM UTC
  //   }
    
  //   await pulse.schedule(nextYearEnd, 'sendYearlyReports', {});
  //   console.log(`Scheduled yearly reports: First run on ${nextYearEnd.toISOString()} (Dec 31 9 PM UTC)`);
  // }

  // console.log('Scheduled report jobs initialized: Weekly (Sun 9 PM UTC), Monthly (1st 8 AM UTC), Yearly (Dec 31 9 PM UTC)');

  // Initialize subscription jobs
  // await defineSubscriptionJobs();
};
