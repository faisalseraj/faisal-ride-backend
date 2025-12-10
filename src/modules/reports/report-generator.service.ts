/**
 * REPORT GENERATOR SERVICE
 * 
 * This module generates HTML reports for email distribution.
 * It does NOT send emails - it only generates the report HTML and metadata.
 * 
 * INTEGRATION EXAMPLE:
 * ```typescript
 * import { generateAdminReport, generateCompanyReport } from './reports/report-generator.service';
 * import { sendEmail } from './email/email.service'; // your existing email service
 * 
 * // Generate admin report
 * const adminReport = await generateAdminReport('weekly');
 * await sendEmail(adminReport.recipients, adminReport.subject, adminReport.html);
 * 
 * // Generate company report
 * const companyReport = await generateCompanyReport({
 *   companyId: '...',
 *   ownerId: '...',
 *   span: 'monthly'
 * });
 * await sendEmail(companyReport.recipients, companyReport.subject, companyReport.html);
 * ```
 * 
 * SCHEMA FIELD MAPPINGS (detected from repo):
 * - User model: userType, towCompanyId, isPaidParkingSpaceProvider, towCompany.employees, towCompany.managers
 * - TowRequest model: requestCreatedBy, towCompanyId, charges.subTotal, status, createdAt
 * - Subscription model: companyId, status (active|expired|canceled|past_due|incomplete), startDate, endDate
 * 
 * DETECTED AMBIGUITIES & ASSUMPTIONS:
 * 1. Tow request source (manager/employee/parking_space): Determined by populating requestCreatedBy and checking userType
 * 2. Parking space provider count: Users with userType containing 'parking-spaces-provider' and isPaidParkingSpaceProvider flag
 * 3. System health metrics: Uses existing admin.service.ts getSystemHealth() function
 * 4. Revenue calculation: Uses charges.subTotal from completed tow requests
 * 5. Date spans: weekly = last 7 days, monthly = last 30 days, yearly = last 365 days (all UTC, inclusive of today)
 */

import Subscription from '../subscriptions/subscription.model';
import TowRequest from '../tow-request/tow-request.model';
import User from '../user/user.model';
import config from '../../config/config';
import { getSystemHealth } from '../admin/admin.service';
import mongoose from 'mongoose';

// ============================================================================
// TYPES
// ============================================================================

export type ReportSpan = 'weekly' | 'monthly' | 'yearly';

export interface ReportResult {
  subject: string;
  recipients: string[]; // Email addresses - caller should replace with actual recipient emails
  html: string; // Self-contained HTML string with inline styles
  data: Record<string, any>; // Raw numbers and aggregated objects for logging/testing
}

export interface CompanyReportParams {
  companyId: string | mongoose.Types.ObjectId;
  ownerId?: string | mongoose.Types.ObjectId; // Optional, for owner-specific reports
  span: ReportSpan;
}

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/**
 * Get date range for a given span
 * All dates are in UTC
 * - Weekly: Previous week (Monday to Sunday of last week)
 * - Monthly: Previous calendar month (first day to last day of previous month)
 * - Yearly: Current calendar year (January 1st to December 31st of current year)
 */
export function getSpanRange(span: ReportSpan): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;
  
  switch (span) {
    case 'weekly':
      // Previous week: Monday to Sunday of last week
      // Calculate last Sunday (end of previous week)
      const lastSunday = new Date(now);
      const daysFromLastSunday = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      lastSunday.setUTCDate(now.getUTCDate() - daysFromLastSunday);
      lastSunday.setUTCHours(23, 59, 59, 999);
      
      // Calculate last Monday (start of previous week)
      const lastMonday = new Date(lastSunday);
      lastMonday.setUTCDate(lastSunday.getUTCDate() - 6);
      lastMonday.setUTCHours(0, 0, 0, 0);
      
      start = lastMonday;
      end = lastSunday;
      break;
    case 'monthly':
      // Previous calendar month
      end = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999); // Last day of previous month
      start = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0); // First day of previous month
      break;
    case 'yearly':
      // Current calendar year (January 1st to December 31st of current year)
      end = new Date(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999); // December 31st of current year
      start = new Date(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0); // January 1st of current year
      break;
  }
  
  return { start, end };
}

/**
 * Format date range for display
 */
function formatDateRange(start: Date, end: Date): string {
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC'
    });
  };
  return `${formatDate(start)} - ${formatDate(end)} UTC`;
}

// ============================================================================
// HTML TABLE GENERATORS
// ============================================================================

/**
 * Generate HTML table with email-safe styling
 * Matches repository's email template conventions (Outfit font, inline styles)
 */
function generateTable(rows: Array<Record<string, string | number>>, headers: string[]): string {
  const fontFamily = "'Outfit', sans-serif";
  
  let html = `
    <table 
      cellpadding="8" 
      cellspacing="0" 
      border="1" 
      style="
        width: 100%;
        max-width: 600px;
        margin: 16px 0;
        border-collapse: collapse;
        font-family: ${fontFamily};
        font-size: 14px;
        background-color: #ffffff;
      "
      role="table"
    >
      <thead>
        <tr style="background-color: #f5f5f5;">
  `;
  
  // Header row
  headers.forEach(header => {
    html += `
          <th style="
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #333333;
            border: 1px solid #dddddd;
          ">${header}</th>
    `;
  });
  
  html += `
        </tr>
      </thead>
      <tbody>
  `;
  
  // Data rows
  rows.forEach((row, idx) => {
    const bgColor = idx % 2 === 0 ? '#ffffff' : '#fafafa';
    html += `
        <tr style="background-color: ${bgColor};">
    `;
    
    headers.forEach(header => {
      const value = row[header] ?? '';
      html += `
          <td style="
            padding: 10px 12px;
            border: 1px solid #dddddd;
            color: #555555;
          ">${value}</td>
      `;
    });
    
    html += `
        </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  return html;
}

/**
 * Generate HTML report wrapper with branding
 */
function generateReportHTML(title: string, dateRange: string, tables: string[], additionalContent?: string): string {
  const fontFamily = "'Outfit', sans-serif";
  const brandName = 'Hits Towing Manager';
  const supportLink = config.visitNowLink ? `${config.visitNowLink}/auth/contact-support` : '#';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: ${fontFamily};
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 650px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #d43b57;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-name {
      font-size: 28px;
      font-weight: 700;
      color: #d43b57;
      margin: 0;
      text-align: center;
      letter-spacing: -0.5px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #333333;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .date-range {
      font-size: 14px;
      color: #666666;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #333333;
      margin-top: 32px;
      margin-bottom: 12px;
    }
    .note {
      font-size: 12px;
      color: #888888;
      font-style: italic;
      margin-top: 16px;
      padding: 12px;
      background-color: #f9f9f9;
      border-left: 3px solid #d43b57;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
    }
    .footer-text {
      font-size: 14px;
      color: #666666;
      margin-bottom: 16px;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .footer-link {
      display: inline-block;
      padding: 10px 20px;
      background-color: #d43b57;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    .footer-link:hover {
      background-color: #b8324a;
    }
    .footer-brand {
      margin-top: 20px;
      font-size: 12px;
      color: #999999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand-name">${brandName}</h1>
    </div>
    <div class="title">${title}</div>
    <div class="date-range">${dateRange}</div>
    ${tables.join('')}
    ${additionalContent || ''}
    <div class="footer">
      <p class="footer-text">Need assistance? We're here to help!</p>
      <div class="footer-links">
        <a href="${supportLink}" class="footer-link" target="_blank">Contact Support</a>
      </div>
      <p class="footer-brand">Powered by ${brandName}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================================
// DATA AGGREGATION HELPERS
// ============================================================================

/**
 * Get user counts by user type
 */
async function getUserCountsByType(span?: { start: Date; end: Date }): Promise<Record<string, { total: number; inSpan: number }>> {
  const userTypes = [
    'admin',
    'apartment-complex-owner',
    'tow-company-owner',
    'tow-company-employee',
    'apartment-complex-employee',
    'tow-company-manager',
    'apartment-complex-manager',
    'renter',
    'parking-spaces-provider-owner',
    'parking-spaces-provider-manager',
    'parking-spaces-provider-employee',
  ];

  const counts: Record<string, { total: number; inSpan: number }> = {};

  for (const userType of userTypes) {
    const totalCount = await User.countDocuments({ 
      userType, 
      isDeleted: { $ne: true } 
    });

    let inSpanCount = totalCount;
    if (span) {
      inSpanCount = await User.countDocuments({
        userType,
        isDeleted: { $ne: true },
        createdAt: { $gte: span.start, $lte: span.end }
      });
    }

    counts[userType] = { total: totalCount, inSpan: inSpanCount };
  }

  return counts;
}

/**
 * Get tow request breakdown by source (manager/employee/parking_space)
 */
async function getTowRequestBreakdown(
  filter: Record<string, any>,
  span: { start: Date; end: Date }
): Promise<{
  total: number;
  byManager: number;
  byEmployee: number;
  byParkingSpace: number;
}> {
  const baseFilter = {
    ...filter,
    createdAt: { $gte: span.start, $lte: span.end }
  };

  const total = await TowRequest.countDocuments(baseFilter);

  // Get requests with populated requestCreatedBy to check userType
  const requests = await TowRequest.find(baseFilter)
    .populate('requestCreatedBy', 'userType')
    .select('requestCreatedBy')
    .lean();

  let byManager = 0;
  let byEmployee = 0;
  let byParkingSpace = 0;

  requests.forEach((req: any) => {
    const creator = req.requestCreatedBy;
    if (!creator || typeof creator !== 'object') return;

    const userType = creator.userType || '';
    
    if (userType === 'tow-company-manager') {
      byManager++;
    } else if (userType === 'tow-company-employee') {
      byEmployee++;
    } else if (userType.includes('parking-spaces-provider')) {
      byParkingSpace++;
    }
  });

  return { total, byManager, byEmployee, byParkingSpace };
}

/**
 * Get top locations by tow request count
 */
async function getTopLocationsByTowRequests(
  filter: Record<string, any>,
  span: { start: Date; end: Date },
  limit: number = 5
): Promise<Array<{ location: string; city?: string; count: number }>> {
  const baseFilter = {
    ...filter,
    createdAt: { $gte: span.start, $lte: span.end },
    location: { $exists: true, $ne: null }
  };

  // Use aggregation to group by location
  const aggregation = await TowRequest.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: {
          address: '$location.address',
          city: '$location.city'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        location: '$_id.address',
        city: '$_id.city',
        count: 1
      }
    }
  ]);

  return aggregation.map((item: any) => ({
    location: item.location || 'Unknown Address',
    city: item.city || undefined,
    count: item.count
  }));
}

/**
 * Get subscription counts by status
 */
async function getSubscriptionCounts(span: { start: Date; end: Date }): Promise<Record<string, number>> {
  const statuses = ['active', 'expired', 'canceled', 'past_due', 'incomplete'];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    counts[status] = await Subscription.countDocuments({
      status,
      startDate: { $lte: span.end } // Subscriptions that started before or during span
    });
  }

  return counts;
}

/**
 * Get parking space provider counts (paid vs unpaid)
 */
async function getParkingSpaceProviderCounts(): Promise<{ paid: number; unpaid: number }> {
  const paid = await User.countDocuments({
    userType: { $in: ['parking-spaces-provider-owner', 'parking-spaces-provider-manager', 'parking-spaces-provider-employee'] },
    isPaidParkingSpaceProvider: true,
    isDeleted: { $ne: true }
  });

  const unpaid = await User.countDocuments({
    userType: { $in: ['parking-spaces-provider-owner', 'parking-spaces-provider-manager', 'parking-spaces-provider-employee'] },
    $or: [
      { isPaidParkingSpaceProvider: false },
      { isPaidParkingSpaceProvider: { $exists: false } }
    ],
    isDeleted: { $ne: true }
  });

  return { paid, unpaid };
}

/**
 * Get revenue statistics for a company
 */
async function getCompanyRevenue(
  companyId: mongoose.Types.ObjectId,
  span: { start: Date; end: Date }
): Promise<{
  total: number;
  avg: number;
  min: number;
  max: number;
  totalPaid: number;
  totalUnpaid: number;
  timeseries: Array<{ date: string; requests: number; revenue: number }>;
}> {
  // Get completed requests with charges
  const requests = await TowRequest.find({
    towCompanyId: companyId,
    status: 'COMPLETED',
    createdAt: { $gte: span.start, $lte: span.end },
    'charges.subTotal': { $exists: true, $ne: null }
  })
    .select('charges.subTotal createdAt')
    .lean();

  const revenues = requests
    .map((r: any) => r.charges?.subTotal || 0)
    .filter((r: number) => r > 0);

  const total = revenues.reduce((sum, r) => sum + r, 0);
  const avg = revenues.length > 0 ? total / revenues.length : 0;
  const min = revenues.length > 0 ? Math.min(...revenues) : 0;
  const max = revenues.length > 0 ? Math.max(...revenues) : 0;

  // For timeseries, group by day
  const timeseriesMap = new Map<string, { requests: number; revenue: number }>();

  requests.forEach((req: any) => {
    const date = new Date(req.createdAt).toISOString().split('T')[0];
    const revenue = req.charges?.subTotal || 0;
    
    const existing = timeseriesMap.get(date ?? '') || { requests: 0, revenue: 0 };
    timeseriesMap.set(date ?? '', {
      requests: existing.requests + 1,
      revenue: existing.revenue + revenue
    });
  });

  const timeseries = Array.from(timeseriesMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Payment status breakdown (assuming all completed are paid - adjust if you have payment status field)
  const totalPaid = total; // All completed requests are considered paid
  const totalUnpaid = 0; // Adjust if you track unpaid status

  return {
    total,
    avg: Math.round(avg * 100) / 100,
    min,
    max,
    totalPaid,
    totalUnpaid,
    timeseries
  };
}

// ============================================================================
// ADMIN REPORT GENERATOR
// ============================================================================

export async function generateAdminReport(span: ReportSpan): Promise<ReportResult> {
  const { start, end } = getSpanRange(span);
  const dateRangeStr = formatDateRange(start, end);

  try {
    // Fetch all data in parallel
    const [
      userCounts,
      towRequestBreakdown,
      subscriptionCounts,
      parkingSpaceCounts,
      systemHealth,
      totalUsersAllTime,
      topLocations
    ] = await Promise.all([
      getUserCountsByType({ start, end }),
      getTowRequestBreakdown({}, { start, end }),
      getSubscriptionCounts({ start, end }),
      getParkingSpaceProviderCounts(),
      getSystemHealth(),
      User.countDocuments({ isDeleted: { $ne: true } }),
      getTopLocationsByTowRequests({}, { start, end }, 5)
    ]);

    // Build tables
    const tables: string[] = [];

    // Table 1: Users by Type
    const userRows = Object.entries(userCounts)
      .filter(([_, counts]) => counts.total > 0 || counts.inSpan > 0)
      .map(([type, counts]) => ({
        'User Type': type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        'Total (All Time)': counts.total.toString(),
        'New in Period': counts.inSpan.toString()
      }));

    if (userRows.length > 0) {
      tables.push(`
        <div class="section-title">Users by Type</div>
        ${generateTable(userRows, ['User Type', 'Total (All Time)', 'New in Period'])}
      `);
    }

    // Table 2: Tow Requests Summary
    const towRequestRows = [
      { 'Source': 'Total', 'Count': towRequestBreakdown.total.toString() },
      { 'Source': 'By Manager', 'Count': towRequestBreakdown.byManager.toString() },
      { 'Source': 'By Employee', 'Count': towRequestBreakdown.byEmployee.toString() },
      { 'Source': 'By Parking Space Provider', 'Count': towRequestBreakdown.byParkingSpace.toString() }
    ];

    tables.push(`
      <div class="section-title">Tow Requests Summary</div>
      ${generateTable(towRequestRows, ['Source', 'Count'])}
    `);

    // Table 3: Subscriptions
    const subscriptionRows = Object.entries(subscriptionCounts)
      .map(([status, count]) => ({
        'Subscription Status': status.charAt(0).toUpperCase() + status.slice(1),
        'Count': count.toString()
      }));

    tables.push(`
      <div class="section-title">Subscriptions</div>
      ${generateTable(subscriptionRows, ['Subscription Status', 'Count'])}
    `);

    // Table 4: System Health
    const healthRows = [
      { 'Metric': 'Status', 'Value': systemHealth.status },
      { 'Metric': 'Health Percentage', 'Value': systemHealth.uptime.percentage },
      { 'Metric': 'Database Status', 'Value': systemHealth.database.status },
      { 'Metric': 'Active Users', 'Value': systemHealth.metrics.activeUsers.toString() },
      { 'Metric': 'Success Rate', 'Value': systemHealth.metrics.successRate },
      { 'Metric': 'Requests This Month', 'Value': systemHealth.metrics.requestsThisMonth.toString() },
      { 'Metric': 'Bookings This Month', 'Value': systemHealth.metrics.bookingsThisMonth.toString() }
    ];

    tables.push(`
      <div class="section-title">System Health</div>
      ${generateTable(healthRows, ['Metric', 'Value'])}
    `);

    // Table 5: Top 5 Locations by Tow Requests
    if (topLocations.length > 0) {
      const locationRows = topLocations.map((loc, index) => ({
        'Rank': `#${index + 1}`,
        'Location': loc.location,
        'City': loc.city || 'N/A',
        'Request Count': loc.count.toString()
      }));

      tables.push(`
        <div class="section-title">Top 5 Locations by Tow Requests</div>
        ${generateTable(locationRows, ['Rank', 'Location', 'City', 'Request Count'])}
      `);
    }

    const html = generateReportHTML(
      `System Report — Admin`,
      dateRangeStr,
      tables
    );

    // Prepare data object
    const data = {
      range: { start: start.toISOString(), end: end.toISOString() },
      userCounts,
      towRequestBreakdown,
      subscriptionCounts,
      parkingSpaceCounts,
      systemHealth,
      totalUsersAllTime,
      topLocations,
      warnings: []
    };

    return {
      subject: `Admin System Report — ${span.charAt(0).toUpperCase() + span.slice(1)} (${dateRangeStr})`,
      recipients: [], // Caller should populate with actual admin emails
      html,
      data
    };
  } catch (error: any) {
    console.error('Error generating admin report:', error);
    throw new Error(`Failed to generate admin report: ${error.message}`);
  }
}

// ============================================================================
// COMPANY REPORT GENERATOR
// ============================================================================

export async function generateCompanyReport(params: CompanyReportParams): Promise<ReportResult> {
  const { companyId, span } = params;
  const { start, end } = getSpanRange(span);
  const dateRangeStr = formatDateRange(start, end);

  try {
    const companyObjectId = typeof companyId === 'string' 
      ? new mongoose.Types.ObjectId(companyId) 
      : companyId;

    // Get company info
    const company = await User.findById(companyObjectId)
      .select('email fullName towCompany.companyName')
      .lean();

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const companyName = (company as any).towCompany?.companyName || company.fullName || 'Unknown Company';

    // Fetch all data in parallel
    const [
      employeeCount,
      managerCount,
      parkingSpaceCounts,
      towRequestBreakdown,
      revenueStats
    ] = await Promise.all([
      User.countDocuments({
        towCompanyId: companyObjectId,
        userType: 'tow-company-employee',
        isDeleted: { $ne: true }
      }),
      User.countDocuments({
        towCompanyId: companyObjectId,
        userType: 'tow-company-manager',
        isDeleted: { $ne: true }
      }),
      getParkingSpaceProviderCounts(),
      getTowRequestBreakdown(
        { towCompanyId: companyObjectId },
        { start, end }
      ),
      getCompanyRevenue(companyObjectId, { start, end })
    ]);

    // Build tables
    const tables: string[] = [];

    // Table 1: Company Headcounts
    const headcountRows = [
      { 'Role': 'Employees', 'Count': employeeCount.toString() },
      { 'Role': 'Managers', 'Count': managerCount.toString() }
    ];

    tables.push(`
      <div class="section-title">Company Headcounts</div>
      ${generateTable(headcountRows, ['Role', 'Count'])}
    `);

    // Table 2: Parking Providers
    const parkingRows = [
      { 'Type': 'Paid Providers', 'Count': parkingSpaceCounts.paid.toString() },
      { 'Type': 'Unpaid Providers', 'Count': parkingSpaceCounts.unpaid.toString() }
    ];

    tables.push(`
      <div class="section-title">Parking Space Providers</div>
      ${generateTable(parkingRows, ['Type', 'Count'])}
    `);

    // Table 3: Tow Requests Summary
    const towRequestRows = [
      { 'Source': 'Total', 'Count': towRequestBreakdown.total.toString() },
      { 'Source': 'By Manager', 'Count': towRequestBreakdown.byManager.toString() },
      { 'Source': 'By Employee', 'Count': towRequestBreakdown.byEmployee.toString() },
      { 'Source': 'By Parking Space Provider', 'Count': towRequestBreakdown.byParkingSpace.toString() }
    ];

    tables.push(`
      <div class="section-title">Tow Requests Summary</div>
      ${generateTable(towRequestRows, ['Source', 'Count'])}
    `);

    // Table 4: Revenue Summary
    const revenueRows = [
      { 'Metric': 'Total Revenue', 'Value': `$${revenueStats.total.toFixed(2)}` },
      { 'Metric': 'Average Charge', 'Value': `$${revenueStats.avg.toFixed(2)}` },
      { 'Metric': 'Minimum Charge', 'Value': `$${revenueStats.min.toFixed(2)}` },
      { 'Metric': 'Maximum Charge', 'Value': `$${revenueStats.max.toFixed(2)}` },
      { 'Metric': 'Total Paid', 'Value': `$${revenueStats.totalPaid.toFixed(2)}` },
      { 'Metric': 'Total Unpaid', 'Value': `$${revenueStats.totalUnpaid.toFixed(2)}` }
    ];

    tables.push(`
      <div class="section-title">Revenue Summary</div>
      ${generateTable(revenueRows, ['Metric', 'Value'])}
    `);

    // Table 5: Timeseries Data
    if (revenueStats.timeseries.length > 0) {
      const timeseriesRows = revenueStats.timeseries.map(ts => ({
        'Date': new Date(ts.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Requests': ts.requests.toString(),
        'Revenue': `$${ts.revenue.toFixed(2)}`
      }));

      // Limit to last 30 days for readability
      const displayRows = timeseriesRows.slice(-30);

      tables.push(`
        <div class="section-title">Daily Performance (Last 30 Days)</div>
        ${generateTable(displayRows, ['Date', 'Requests', 'Revenue'])}
      `);
    }

    const html = generateReportHTML(
      `Company Report — ${companyName}`,
      dateRangeStr,
      tables
    );

    // Prepare data object
    const data = {
      range: { start: start.toISOString(), end: end.toISOString() },
      companyId: companyObjectId.toString(),
      companyName,
      employeeCount,
      managerCount,
      parkingSpaceCounts,
      towRequestBreakdown,
      revenueStats,
      warnings: []
    };

    // Determine recipients
    const recipients: string[] = [];
    if (company.email) {
      recipients.push(company.email);
    }

    // If ownerId provided, try to get owner email
    if (params.ownerId) {
      const ownerObjectId = typeof params.ownerId === 'string'
        ? new mongoose.Types.ObjectId(params.ownerId)
        : params.ownerId;
      
      const owner = await User.findById(ownerObjectId)
        .select('email')
        .lean();
      
      if (owner && (owner as any).email && !recipients.includes((owner as any).email)) {
        recipients.push((owner as any).email);
      }
    }

    return {
      subject: `Company Report — ${companyName} — ${span.charAt(0).toUpperCase() + span.slice(1)} (${dateRangeStr})`,
      recipients,
      html,
      data
    };
  } catch (error: any) {
    console.error('Error generating company report:', error);
    throw new Error(`Failed to generate company report: ${error.message}`);
  }
}

// ============================================================================
// DEMO / TEST FUNCTION
// ============================================================================

/**
 * Demo function showing example usage
 * Run this to test report generation
 */
export async function demo(): Promise<void> {
  console.log('=== REPORT GENERATOR DEMO ===\n');
  try {
    // Example: Generate admin weekly report
    console.log('Generating admin weekly report...');
    const adminReport = await generateAdminReport('weekly');
    console.log('✓ Admin report generated');
    console.log('Subject:', adminReport.subject);
    console.log('Recipients:', adminReport.recipients);
    console.log('Data keys:', Object.keys(adminReport.data));
    console.log('HTML length:', adminReport.html.length, 'characters\n');

    // Example: Generate company monthly report
    // NOTE: Replace with actual company ID from your database
    console.log('Generating company monthly report...');
    console.log('⚠️  Note: Replace companyId with actual ID from your database');
    
    // Uncomment and provide real company ID:
    // const companyReport = await generateCompanyReport({
    //   companyId: 'YOUR_COMPANY_ID_HERE',
    //   span: 'monthly'
    // });
    // console.log('✓ Company report generated');
    // console.log('Subject:', companyReport.subject);
    // console.log('Recipients:', companyReport.recipients);
    // console.log('Data keys:', Object.keys(companyReport.data));
    // console.log('HTML length:', companyReport.html.length, 'characters\n');

    console.log('=== DEMO COMPLETE ===');
  } catch (error: any) {
    console.error('Demo error:', error.message);
  }
}

