/**
 * Faisal Ride - Admin Service
 * System health and monitoring for carpooling application
 */

import Subscription from '../subscriptions/subscription.model';
import User from '../user/user.model';
import mongoose from 'mongoose';

/**
 * Get system health metrics
 */
export const getSystemHealth = async () => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

    // Calculate uptime
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    // Get current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Count new users this month
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Count active users
    const activeUsers = await User.countDocuments({
      isSuspended: false,
      isArchived: false,
      isDeleted: { $ne: true }
    });

    // Count riders
    const totalRiders = await User.countDocuments({
      userType: 'rider',
      isDeleted: { $ne: true }
    });

    // Calculate system health percentage
    const dbHealth = dbStatus === 'connected' ? 100 : 0;
    const userHealth = activeUsers > 0 ? 100 : 0;
    const activityHealth = newUsersThisMonth > 0 ? 100 : 50;
    
    const healthPercentage = (
      (dbHealth * 0.5) +
      (userHealth * 0.3) +
      (activityHealth * 0.2)
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
        newUsersThisMonth,
        activeUsers,
        totalRiders,
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
        newUsersThisMonth: 0,
        activeUsers: 0,
        totalRiders: 0,
      },
      lastChecked: new Date().toISOString(),
      error: 'Failed to retrieve system health'
    };
  }
};

/**
 * Get system alerts
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

    // Check for unverified users
    const unverifiedUsers = await User.countDocuments({ 
      isVerified: false,
      isDeleted: { $ne: true }
    });
    if (unverifiedUsers > 10) {
      alerts.push({
        id: 'unverified-users',
        type: 'info',
        severity: 'low',
        message: `${unverifiedUsers} user(s) have not verified their accounts`,
        timestamp: new Date().toISOString()
      });
    }

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
