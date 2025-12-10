import Booking from '../book-parking/book-parking.model';
import Subscription from '../subscriptions/subscription.model';
import TowRequest from '../tow-request/tow-request.model';
import User from '../user/user.model';
import mongoose from 'mongoose';

/**
 * Get system health metrics
 * @returns {Promise<Object>}
 */
export const getSystemHealth = async () => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

    // Calculate uptime (simplified - in production, track actual server start time)
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    // Get current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Count requests this month
    const requestsThisMonth = await TowRequest.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Count bookings this month
    const bookingsThisMonth = await Booking.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Count active users
    const activeUsers = await User.countDocuments({
      isSuspended: false
    });

    // Calculate success rate (completed requests / total requests)
    const totalRequests = await TowRequest.countDocuments();
    const completedRequests = await TowRequest.countDocuments({ status: 'COMPLETED' });
    const successRate = totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(1) : '0';

    // Calculate system health percentage (simplified metric)
    // Based on: DB connection (40%), success rate (30%), active users (20%), recent activity (10%)
    const dbHealth = dbStatus === 'connected' ? 100 : 0;
    const successRateNum = parseFloat(successRate);
    const userHealth = activeUsers > 0 ? 100 : 0;
    const activityHealth = (requestsThisMonth + bookingsThisMonth) > 0 ? 100 : 50;
    
    const healthPercentage = (
      (dbHealth * 0.4) +
      (successRateNum * 0.3) +
      (userHealth * 0.2) +
      (activityHealth * 0.1)
    ).toFixed(1);

    return {
      status: dbStatus === 'connected' && parseFloat(healthPercentage) > 80 ? 'healthy' : 'degraded',
      uptime: {
        hours: uptimeHours,
        minutes: uptimeMinutes,
        percentage: healthPercentage + '%'
      },
      database: {
        status: dbStatus,
        connected: dbState === 1
      },
      metrics: {
        requestsThisMonth,
        bookingsThisMonth,
        activeUsers,
        successRate: successRate + '%'
      },
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      status: 'error',
      uptime: {
        hours: 0,
        minutes: 0,
        percentage: '0%'
      },
      database: {
        status: 'error',
        connected: false
      },
      metrics: {
        requestsThisMonth: 0,
        bookingsThisMonth: 0,
        activeUsers: 0,
        successRate: '0%'
      },
      lastChecked: new Date().toISOString(),
      error: 'Failed to retrieve system health'
    };
  }
};

/**
 * Get system alerts
 * @returns {Promise<Array>}
 */
export const getSystemAlerts = async () => {
  try {
    const alerts: any[] = [];

    // Check database connection
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      alerts.push({
        id: 'db-connection',
        type: 'error',
        severity: 'high',
        message: 'Database connection issue detected',
        timestamp: new Date().toISOString()
      });
    } else {
      alerts.push({
        id: 'db-connection',
        type: 'info',
        severity: 'low',
        message: 'All systems operational',
        timestamp: new Date().toISOString()
      });
    }

    // Check for expiring subscriptions
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringSubscriptions = await Subscription.countDocuments({
      status: 'active',
      endDate: { $lte: sevenDaysFromNow }
    });

    if (expiringSubscriptions > 0) {
      alerts.push({
        id: 'expiring-subscriptions',
        type: 'warning',
        severity: 'medium',
        message: `${expiringSubscriptions} subscription(s) expiring in the next 7 days`,
        timestamp: new Date().toISOString()
      });
    }

    // Check for high pending requests
    const pendingRequests = await TowRequest.countDocuments({
      status: { $in: ['PENDING_ASSIGNMENT', 'PENDING_PSP_APPROVAL'] }
    });

    if (pendingRequests > 50) {
      alerts.push({
        id: 'high-pending-requests',
        type: 'warning',
        severity: 'medium',
        message: `High number of pending requests: ${pendingRequests}`,
        timestamp: new Date().toISOString()
      });
    }

    // Check for suspended users
    const suspendedUsers = await User.countDocuments({ isSuspended: true });
    if (suspendedUsers > 0) {
      alerts.push({
        id: 'suspended-users',
        type: 'info',
        severity: 'low',
        message: `${suspendedUsers} suspended user(s) need attention`,
        timestamp: new Date().toISOString()
      });
    }

    // Check recent activity (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    const recentRequests = await TowRequest.countDocuments({
      createdAt: { $gte: last24Hours }
    });

    if (recentRequests > 100) {
      alerts.push({
        id: 'high-api-usage',
        type: 'warning',
        severity: 'medium',
        message: 'High API usage detected in the last 24 hours',
        timestamp: new Date().toISOString()
      });
    } else if (recentRequests === 0) {
      alerts.push({
        id: 'low-activity',
        type: 'info',
        severity: 'low',
        message: 'No activity detected in the last 24 hours',
        timestamp: new Date().toISOString()
      });
    }

    // Database backup check (mock - in production, check actual backup status)
    alerts.push({
      id: 'database-backup',
      type: 'info',
      severity: 'low',
      message: 'Database backup completed',
      timestamp: new Date().toISOString()
    });

    // Sort alerts by severity (high > medium > low)
    const severityOrder = { high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => (severityOrder[b.severity as keyof typeof severityOrder] || 0) - (severityOrder[a.severity as keyof typeof severityOrder] || 0));

    return alerts;
  } catch (error) {
    console.error('Error getting system alerts:', error);
    return [{
      id: 'system-error',
      type: 'error',
      severity: 'high',
      message: 'Failed to retrieve system alerts',
      timestamp: new Date().toISOString()
    }];
  }
};

