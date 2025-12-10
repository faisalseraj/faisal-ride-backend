import { ReportSpan, generateAdminReport, generateCompanyReport } from './report-generator.service';
import { generatePDFFilename, generateReportPDF } from './report-pdf.service';

import User from '../user/user.model';
import config from '../../config/config';
import mongoose from 'mongoose';
import { sendEmail } from '../email/email.service';
import { userService } from '../user';

/**
 * Send scheduled admin reports to all admins
 */
export async function sendScheduledAdminReport(span: ReportSpan): Promise<void> {
  try {
    console.log(`Starting scheduled ${span} admin report generation...`);

    // Get all admins
    const adminList = await userService.getAllAdmins();


    if (adminList.length === 0) {
      console.log('No admins found. Skipping admin report.');
      return;
    }

    // Generate one admin report
    const report = await generateAdminReport(span);

    // Generate PDF
    const pdfBuffer = await generateReportPDF(report);
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfFilename = generatePDFFilename(report, 'admin');

    // Send to all admins
    const emailPromises = adminList.map(async (admin) => {
      if (!admin.email) {
        console.warn(`Admin ${admin._id} has no email. Skipping.`);
        return;
      }

      try {
        await sendEmail(
          {
            to: admin.email,
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
          admin,
          admin.fullName || 'Admin'
        );
        console.log(`Admin report sent to ${admin.email}`);
      } catch (error) {
        console.error(`Failed to send admin report to ${admin.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
    console.log(`Completed scheduled ${span} admin report dispatch to ${adminList.length} admin(s)`);
  } catch (error) {
    console.error(`Error in scheduled admin report (${span}):`, error);
    throw error;
  }
}

/**
 * Send scheduled company reports to tow company owners and their managers
 */
export async function sendScheduledCompanyReport(span: ReportSpan): Promise<void> {
  try {
    console.log(`Starting scheduled ${span} company report generation...`);

    // Get all tow company owners
    const owners = await User.find({
      userType: 'tow-company-owner',
      isDeleted: { $ne: true },
    }).lean();

    if (owners.length === 0) {
      console.log('No tow company owners found. Skipping company reports.');
      return;
    }

    // Process each owner
    const reportPromises = owners.map(async (owner) => {
      try {
        const ownerId = owner._id || owner.id;
        if (!ownerId) {
          console.warn(`Owner ${owner._id} has no valid ID. Skipping.`);
          return;
        }

        const companyId = new mongoose.Types.ObjectId(ownerId);

        // Generate company report for this owner
        const report = await generateCompanyReport({
          companyId,
          ownerId: companyId,
          span,
        });

        // Generate PDF
        const pdfBuffer = await generateReportPDF(report);
        const pdfBase64 = pdfBuffer.toString('base64');
        const pdfFilename = generatePDFFilename(report, 'company');

        // Get all managers for this company
        const managers = await User.find({
          towCompanyId: companyId,
          userType: 'tow-company-manager',
          isDeleted: { $ne: true },
        }).lean();

        // Prepare recipients: owner + all managers
        const recipients = [
          { user: owner, email: owner.email, name: owner.fullName || 'Owner' },
          ...managers.map((manager) => ({
            user: manager,
            email: manager.email,
            name: manager.fullName || 'Manager',
          })),
        ].filter((r) => r.email); // Filter out users without emails

        if (recipients.length === 0) {
          console.warn(`No valid recipients for company ${companyId}. Skipping.`);
          return;
        }

        // Send report to owner and all managers
        const emailPromises = recipients.map(async (recipient) => {
          try {
            await sendEmail(
              {
                to: recipient.email!,
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
              recipient.user,
              recipient.name
            );
            console.log(`Company report sent to ${recipient.email} (${recipient.name})`);
          } catch (error) {
            console.error(`Failed to send company report to ${recipient.email}:`, error);
          }
        });

        await Promise.allSettled(emailPromises);
        console.log(
          `Completed ${span} company report for owner ${owner.email}: sent to ${recipients.length} recipient(s)`
        );
      } catch (error) {
        console.error(`Error generating company report for owner ${owner._id}:`, error);
      }
    });

    await Promise.allSettled(reportPromises);
    console.log(`Completed scheduled ${span} company report dispatch for ${owners.length} company/companies`);
  } catch (error) {
    console.error(`Error in scheduled company report (${span}):`, error);
    throw error;
  }
}

/**
 * Send all scheduled reports (admin + company) for a given span
 */
export async function sendAllScheduledReports(span: ReportSpan): Promise<void> {
  console.log(`=== Starting scheduled ${span} reports dispatch ===`);
  
  try {
    // Send admin reports and company reports in parallel
    await Promise.allSettled([
      sendScheduledAdminReport(span),
      sendScheduledCompanyReport(span),
    ]);
    
    console.log(`=== Completed scheduled ${span} reports dispatch ===`);
  } catch (error) {
    console.error(`Error in scheduled reports dispatch (${span}):`, error);
    throw error;
  }
}

