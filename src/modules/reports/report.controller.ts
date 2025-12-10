import { ReportSpan, generateAdminReport, generateCompanyReport } from './report-generator.service';
import { Request, Response } from 'express';
import { generatePDFFilename, generateReportPDF } from './report-pdf.service';

import ApiError from '../errors/ApiError';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { sendEmail } from '../email/email.service';

/**
 * Generate admin report
 * GET /admin/reports?span=weekly|monthly|yearly
 */
export const generateAdminReportController = catchAsync(async (req: Request, res: Response) => {
  const span = ((req.query as any)?.span as ReportSpan) || 'weekly';

  if (!['weekly', 'monthly', 'yearly'].includes(span)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid span. Must be weekly, monthly, or yearly');
  }

  const report = await generateAdminReport(span);

  // Send email to logged-in user with PDF attachment
  const userEmail = req.user?.email;
  if (userEmail) {
    try {
      // Generate PDF
      const pdfBuffer = await generateReportPDF(report);
      const pdfBase64 = pdfBuffer.toString('base64');
      const pdfFilename = generatePDFFilename(report, 'admin');

      await sendEmail(
        {
          to: userEmail,
          from: config.from,
          subject: report.subject,
          html: report.html,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBase64,
              type: 'application/pdf',
            },
          ],
        },
        req.user,
        req.user?.fullName || 'Admin'
      );
    } catch (emailError) {
      console.error('Error sending report email:', emailError);
      // Continue even if email fails
    }
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      ...report,
      emailSent: !!userEmail,
    },
  });
});

/**
 * Generate company report for tow company owner/manager
 * GET /reports/company?span=weekly|monthly|yearly
 * The companyId is automatically determined from the logged-in user
 */
export const generateCompanyReportController = catchAsync(async (req: Request, res: Response) => {
  const span = ((req.query as any)?.span as ReportSpan) || 'weekly';
  const user = req.user;

  if (!['weekly', 'monthly', 'yearly'].includes(span)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid span. Must be weekly, monthly, or yearly');
  }

  // Determine companyId based on user type
  let companyId: mongoose.Types.ObjectId;

  if (user.userType === 'tow-company-owner') {
    // For owners, their own ID is the company ID
    companyId = new mongoose.Types.ObjectId(user.id || user._id);
  } else if (user.userType === 'tow-company-manager') {
    // For managers, use their towCompanyId
    if (!user.towCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not associated with a tow company');
    }
    companyId = new mongoose.Types.ObjectId(user.towCompanyId);
  } else {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only tow company owners and managers can access company reports');
  }

  const report = await generateCompanyReport({
    companyId,
    ownerId: user.userType === 'tow-company-owner' ? new mongoose.Types.ObjectId(user.id || user._id) : user.towCompanyId,
    span,
  });

  // Send email to logged-in user with PDF attachment
  const userEmail = user?.email;
  if (userEmail) {
    try {
      // Generate PDF
      const pdfBuffer = await generateReportPDF(report);
      const pdfBase64 = pdfBuffer.toString('base64');
      const pdfFilename = generatePDFFilename(report, 'company');

      await sendEmail(
        {
          to: userEmail,
          from: config.from,
          subject: report.subject,
          html: report.html,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBase64,
              type: 'application/pdf',
            },
          ],
        },
        user,
        user?.fullName || 'User'
      );
    } catch (emailError) {
      console.error('Error sending report email:', emailError);
      // Continue even if email fails
    }
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      ...report,
      emailSent: !!userEmail,
    },
  });
});
