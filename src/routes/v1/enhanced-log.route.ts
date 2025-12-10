import { Router } from 'express';
import { auth } from '../../modules/auth';
import { enhancedLogController } from '../../modules/logs';
import { roleRights } from '../../config/roles';

const router = Router();

// Middleware to check getLogs permission
const checkLogsPermission = (req: any, res: any, next: any) => {
  const userRights = roleRights.get(req.user.userType) || [];
  if (!userRights.includes('getLogs')) {
    return res.status(403).json({ message: 'Access denied: No permission to view logs' });
  }
  next();
};

// Get logs (main endpoint)
router.get('/', auth(), checkLogsPermission, enhancedLogController.searchLogs);

// Search logs with advanced filtering and RBAC
router.get('/search', auth(), checkLogsPermission, enhancedLogController.searchLogs);

// Get log statistics
router.get('/statistics', auth(), checkLogsPermission, enhancedLogController.getLogStatistics);

// Export logs
router.get('/export', auth(), checkLogsPermission, enhancedLogController.exportLogs);

// Get log by ID
router.get('/:logId', auth(), checkLogsPermission, enhancedLogController.getLogById);

// Get detailed log information
router.get('/:logId/details', auth(), checkLogsPermission, enhancedLogController.getLogDetails);

// Get access control information
router.get('/access-control', auth(), checkLogsPermission, enhancedLogController.getLogAccessControl);

// Get available categories
router.get('/meta/categories', auth(), checkLogsPermission, enhancedLogController.getLogCategories);

// Get available actions
router.get('/meta/actions', auth(), checkLogsPermission, enhancedLogController.getLogActions);

// Get available priorities
router.get('/meta/priorities', auth(), checkLogsPermission, enhancedLogController.getLogPriorities);

// Get available event types
router.get('/meta/event-types', auth(), checkLogsPermission, enhancedLogController.getLogEventTypes);

// Get available event enums
router.get('/meta/event-enums', auth(), checkLogsPermission, enhancedLogController.getLogEventEnums);

// Get available statuses
router.get('/meta/statuses', auth(), checkLogsPermission, enhancedLogController.getLogStatuses);

// Create enhanced log
router.post('/', auth(), checkLogsPermission, enhancedLogController.createEnhancedLog);

// Get dashboard data
router.get('/dashboard', auth(), checkLogsPermission, enhancedLogController.getLogDashboard);

export default router;
