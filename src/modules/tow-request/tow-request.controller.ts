import * as subscriptionService from '../subscriptions/subscription.service';
import * as towRequestService from './tow-request.service';

import { Request, Response } from 'express';
import {
  createSystemLog,
  createTowRequestLog
} from '../logs/enhanced-log-migration.service';
import { generateInvoicePDF, getCompanyUserForInvoice } from './pdf-invoice.service';

import { ApiError } from '../errors';
import { IOptions } from '../paginate/paginate';
import { IUserDoc } from '../user/user.interfaces';
import { IoSocket } from '../../app';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { passkeyService } from '../passkey';
import pick from '../utils/pick';
import { sendInvoiceEmail } from '../email/email.service';

// Helper to emit socket events to a user
const emitToUser = (userId: string, event: string, data: any) => {
  console.log(`Emitting to user room: user-${userId}`, event, data);
  IoSocket.emit(`user-${userId}`, data);
};

export const createTowRequest = catchAsync(async (req: Request, res: Response) => {
  try {
    console.log('🚀 Starting tow request creation...');
    const loggedInUser = req.user;
    const licensePlates = req.body.licensePlates;
    


    if (loggedInUser.userType === 'tow-company-employee' && !loggedInUser.isTowOperator) {
      try {
        await createSystemLog({
          user: loggedInUser,
          event: 'Tow request creation denied - insufficient permissions',
          customMetadata: {
            reason: 'User is tow-company-employee but not tow operator',
            userType: loggedInUser.userType,
            isTowOperator: (loggedInUser as any).isTowOperator,
          },
        });
      } catch (logError) {
        console.error('Failed to log permission denial:', logError);
      }
      throw new ApiError(httpStatus.BAD_REQUEST, "You're not allowed for this operation.");
    }
    
    if (licensePlates.length == 0) {
      try {
        await createSystemLog({
          user: loggedInUser,
          event: 'Tow request creation failed - no license plates',
          customMetadata: {
            reason: 'No license plates provided',
            licensePlatesCount: licensePlates?.length || 0,
          },
        });
      } catch (logError) {
        console.error('Failed to log no license plates error:', logError);
      }
      throw new ApiError(httpStatus.BAD_REQUEST, 'No license plates found');
    }

    // Check if user needs subscription and validate limits
    const userTypesRequiringSubscription = [
      'tow-company-owner',
      'tow-company-manager',
      'tow-company-employee',
      'parking-spaces-provider-owner',
      'parking-spaces-provider-manager',
      'parking-spaces-provider-employee',
    ];

    if (userTypesRequiringSubscription.includes(loggedInUser.userType)) {
      // Get company ID based on user type
      let companyId: mongoose.Types.ObjectId;
      if (loggedInUser.userType === 'tow-company-owner') {
        companyId = new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id);
      } else if (loggedInUser.userType === 'tow-company-manager' || loggedInUser.userType === 'tow-company-employee') {
        if (!loggedInUser.towCompanyId) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Tow company ID not found');
        }
        companyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
      } else if (loggedInUser.userType.includes('parking-spaces-provider')) {
        // PSP users are associated with a tow company, and the tow company has the subscription
        // So we need to use the tow company's ID to check subscription
        if (!loggedInUser.towCompanyId) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Tow company ID not found for parking space provider');
        }
        companyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
      } else {
        companyId = new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id);
      }

      // Get subscription
      const subscription = await subscriptionService.getCompanySubscription(companyId);
      
      if (!subscription || subscription.status !== 'active') {
        try {
          await createSystemLog({
            user: loggedInUser,
            event: 'Tow request creation denied - no active subscription',
            customMetadata: {
              reason: 'No active subscription found',
              userType: loggedInUser.userType,
              companyId: companyId.toString(),
              subscriptionStatus: subscription?.status || 'none',
            },
          });
        } catch (logError) {
          console.error('Failed to log subscription denial:', logError);
        }
        throw new ApiError(httpStatus.FORBIDDEN, 'You need an active subscription to create tow requests. Please subscribe to a plan.', true, '', 'NO_SUBSCRIPTION');
      }

      // Check if subscription has billing period dates
      if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
        // If no billing period, use subscription start/end dates
        const periodStart = subscription.startDate || new Date();
        const periodEnd = subscription.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Count tow requests in this period
        const towRequestCount = await towRequestService.countTowRequestsInBillingPeriod(
          loggedInUser,
          periodStart,
          periodEnd
        );

        // Get tier limit
        const tier = subscription.tierId as any;
        const freeTowRequestsLimit = tier?.freeTowRequests || 0;

        if (towRequestCount >= freeTowRequestsLimit) {
          try {
            await createSystemLog({
              user: loggedInUser,
              event: 'Tow request creation denied - limit reached',
              customMetadata: {
                reason: 'Tow request limit reached',
                userType: loggedInUser.userType,
                companyId: companyId.toString(),
                currentCount: towRequestCount,
                limit: freeTowRequestsLimit,
                periodStart: periodStart.toISOString(),
                periodEnd: periodEnd.toISOString(),
              },
            });
          } catch (logError) {
            console.error('Failed to log limit reached:', logError);
          }
          throw new ApiError(
            httpStatus.FORBIDDEN,
            `You have reached your monthly limit of ${freeTowRequestsLimit} tow requests. Please upgrade your plan or wait for the next billing cycle.`
          );
        }
      } else {
        // Use billing period from subscription
        const periodStart = subscription.currentPeriodStart;
        const periodEnd = subscription.currentPeriodEnd;
        
        // Count tow requests in this period
        const towRequestCount = await towRequestService.countTowRequestsInBillingPeriod(
          loggedInUser,
          periodStart,
          periodEnd
        );

        // Get tier limit
        const tier = subscription.tierId as any;
        const freeTowRequestsLimit = tier?.freeTowRequests || 0;

        if (towRequestCount >= freeTowRequestsLimit) {
          try {
            await createSystemLog({
              user: loggedInUser,
              event: 'Tow request creation denied - limit reached',
              customMetadata: {
                reason: 'Tow request limit reached',
                userType: loggedInUser.userType,
                companyId: companyId.toString(),
                currentCount: towRequestCount,
                limit: freeTowRequestsLimit,
                periodStart: periodStart.toISOString(),
                periodEnd: periodEnd.toISOString(),
              },
            });
          } catch (logError) {
            console.error('Failed to log limit reached:', logError);
          }
          throw new ApiError(
            httpStatus.FORBIDDEN,
            `You have reached your monthly limit of ${freeTowRequestsLimit} tow requests. Please upgrade your plan or wait for the next billing cycle.`,
            true,
            '',
            'LIMIT_REACHED'
          );
        }
      }
    }

    console.log('🔍 Checking if tow request exists for plate:', licensePlates[0]?.plateText);
    await towRequestService.checkIfTowRequestExists(licensePlates[0]?.plateText);
    console.log('✅ No existing tow request found');
    
    const towRequestPayload = {
      ...req.body,
      licensePlates,
    };
    console.log('📦 Tow request payload:', towRequestPayload);

    // Save to DB
    console.log('💾 Creating tow request in database...');
    const towRequest = await towRequestService.createTowRequest(towRequestPayload, req.user);
    console.log('✅ Tow request created successfully:', towRequest._id);
    
    // Log successful creation
    try {
      await createTowRequestLog({
        user: loggedInUser,
        event: 'Tow request created successfully',
        customMetadata: {
          towRequestId: towRequest._id,
          licensePlates: licensePlates.map((lp: any) => lp.plateText),
          status: towRequest.status,
          ipAddress: req.ip,
        },
      });
    } catch (logError) {
      console.error('Failed to log successful creation:', logError);
    }

    console.log('🎉 Sending success response...');
    res.send({
      message: 'Tow Request created successfully',
      towRequest,
      code: 200,
    });
  } catch (e) {
    console.error('💥 Error in createTowRequest:', e);
    console.error('📊 Error details:', {
      message: (e as any)?.message,
      stack: (e as any)?.stack,
      name: (e as any)?.name
    });
    
    // Log error
    try {
      await createSystemLog({
        user: req.user,
        event: 'Tow request creation failed with error',
        customMetadata: {
          error: (e as any)?.message || 'Unknown error',
          stack: (e as any)?.stack,
          licensePlates: req.body.licensePlates?.map((lp: any) => lp.plateText),
        },
      });
    } catch (logError) {
      console.error('Failed to log creation error:', logError);
    }
    console.log(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'error' + e);
  }
});

export const assignTowToOperator = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId, assignedTo, towOperatorLocation } = req.body;


  if (!towRequestId || !assignedTo) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request assignment failed - missing required fields',
      customMetadata: {
        reason: 'Missing towRequestId or assignedTo',
        towRequestId: !!towRequestId,
        assignedTo: !!assignedTo,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow id and assigned to is required');
  }
  
  const towRequest = await towRequestService.assignTowToOperator(
    new mongoose.Types.ObjectId(towRequestId),
    new mongoose.Types.ObjectId(assignedTo),
    towOperatorLocation,
    req.user
  );
  
  // Log successful assignment
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request assigned successfully',
    customMetadata: {
      towRequestId: towRequest._id,
      assignedTo,
      status: towRequest.status,
      ipAddress: req.ip,
    },
  });

  res.status(httpStatus.CREATED).send(towRequest);
});

export const forceAssignTowToOperator = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId, assignedTo, towOperatorLocation } = req.body;

  if (!towRequestId || !assignedTo) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request force assignment failed - missing required fields',
      customMetadata: {
        reason: 'Missing towRequestId or assignedTo',
        towRequestId: !!towRequestId,
        assignedTo: !!assignedTo,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow id and assigned to is required');
  }
  
  const towRequest = await towRequestService.forceAssignTowToOperator(
    new mongoose.Types.ObjectId(towRequestId),
    new mongoose.Types.ObjectId(assignedTo),
    towOperatorLocation,
    req.user
  );
  
  // Log successful force assignment
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request forcefully assigned successfully',
    customMetadata: {
      towRequestId: towRequest._id,
      assignedTo,
      status: towRequest.status,
      ipAddress: req.ip,
      isForceAssignment: true,
    },
  });

  res.status(httpStatus.CREATED).send(towRequest);
});

export const updateTowRequestStatus = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId, status } = req.body;
  
  // Log status update attempt
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request status update attempted',
    customMetadata: {
      towRequestId,
      newStatus: status,
      ipAddress: req.ip,
    },
  });

  if (!towRequestId) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request status update failed - missing towRequestId',
      customMetadata: {
        reason: 'Missing towRequestId',
        status,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow id and assigned to is required');
  }

  const towRequest = await towRequestService.updateTowRequestStatus(
    new mongoose.Types.ObjectId(towRequestId),
    status,
    req.user
  );
  
  // Log successful status update
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request status updated successfully',
    customMetadata: {
      towRequestId: towRequest._id,
      newStatus: towRequest.status,
      ipAddress: req.ip,
    },
  });

  res.send(towRequest);
});

export const updateTowRequest = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;
  
  // Log update attempt
  if (!towRequestId) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request update failed - missing towRequestId',
      customMetadata: {
        reason: 'Missing towRequestId in params',
        updateFields: Object.keys(req.body),
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow id and assigned to is required');
  }

  const towRequest = await towRequestService.updateTowRequest(
    new mongoose.Types.ObjectId(towRequestId),
    req.body,
    req.user
  );
  
  // Log successful update
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request updated successfully',
    customMetadata: {
      towRequestId: towRequest._id,
      updatedFields: Object.keys(req.body),
      ipAddress: req.ip,
    },
  });

  res.send(towRequest);
});

export const followUpTowRequest = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.body;
  
  // Log follow-up attempt
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request follow-up attempted',
    customMetadata: {
      towRequestId,
      ipAddress: req.ip,
    },
  });

  if (!towRequestId) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request follow-up failed - missing towRequestId',
      customMetadata: {
        reason: 'Missing towRequestId',
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow id and assigned to is required');
  }
  
  const towRequest = await towRequestService.followUpTowRequest(
    new mongoose.Types.ObjectId(towRequestId),
    req.user
  );
  
  // Log successful follow-up
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request follow-up completed successfully',
    customMetadata: {
      towRequestId: towRequest._id,
      status: towRequest.status,
      ipAddress: req.ip,
    },
  });

  res.send({ towRequest, message: 'Follow up successful', code: 200 });
});

export const getTowRequests = catchAsync(async (req: Request, res: Response) => {
  let filter = pick(req.query, ['status']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);
  const loggedInUser = req.user as IUserDoc;
  const orFilterAdvance: any = [];
  // filtre for tow
  if (loggedInUser.userType === 'tow-company-manager' || loggedInUser.userType === 'tow-company-owner') {
    if (!filter.status) {
      filter.status = { $ne: 'PENDING_PSP_APPROVAL' };
    }
    if (loggedInUser.userType === 'tow-company-manager') {
      filter.towCompanyId = loggedInUser.towCompanyId;
    } else {
      filter.towCompanyId = loggedInUser.id;
    }
  }

  if (loggedInUser.userType === 'tow-company-employee') {
    if (!filter.status) {
      filter.status = { $ne: 'PENDING_PSP_APPROVAL' };
    }
    // orFilterAdvance.push({ assignedTo: loggedInUser.id });
    // orFilterAdvance.push({ requestCreatedBy: loggedInUser.id });
    // orFilterAdvance.push({ towCompanyId: loggedInUser.towCompanyId });
    filter = {
      ...filter,
      $or: [{ assignedTo: new mongoose.Types.ObjectId(loggedInUser.id) }, { requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id) }, { towCompanyId: new mongoose.Types.ObjectId(loggedInUser.towCompanyId) }],
    };
  }

  if (loggedInUser.userType.includes('parking-spaces-provider')) {
    // For PSP owners, use their own ID as pspCompanyId
    // For PSP managers and employees, use their pspCompanyId field
    const pspCompanyId = loggedInUser.userType === 'parking-spaces-provider-owner' 
      ? loggedInUser.id 
      : loggedInUser.pspCompanyId;
    
    filter = {
      ...filter,
      $or: [
        { pspCompanyId: new mongoose.Types.ObjectId(pspCompanyId) }, 
        { requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id) }
      ],
    };
  }


  if (loggedInUser.userType === 'tow-requester') {
    filter = {
      ...filter,
      $or: [
        { requesterId: new mongoose.Types.ObjectId(loggedInUser.id) },
        { requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id) }
      ],
    };
  }
  
  const result = await towRequestService.queryTowRequests(filter, {
    ...options,
    orFilterAdvance,
    ...(search?.search
      ? {
          // Expanded the search to include new fields from the updated schema
          search: `${decodeURIComponent(
            search?.search
          )}#licensePlates,images,sentTo,assignedToEmail,assignedToName,requesterName,requesterEmail,requesterPhoneNumber,invoiceNumber,vehicleMake,vehicleModel,vin,truckNumber`,
        }
      : {}),
  });

  res.send(result);
});

export const getTowRequestById = catchAsync(async (req: Request, res: Response) => {
  const towRequest = await towRequestService.getTowRequestById(req.params['towRequestId'] as any, req.user);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }
  res.send(towRequest);
});

export const downloadInvoicePDF = catchAsync(async (req: Request, res: Response) => {
  const towRequest = await towRequestService.getTowRequestById(req.params['towRequestId'] as any, req.user);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }

  // Get company user using shared helper (same logic as email service)
  const companyUser = await getCompanyUserForInvoice(towRequest.towCompanyId);

  // Generate PDF using the same service function used for email attachments
  const pdfBuffer = await generateInvoicePDF(towRequest, companyUser);

  // Set response headers
  const invoiceNumber = towRequest.invoiceNumber || towRequest.id || towRequest._id;
  const filename = `Invoice_${invoiceNumber}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length.toString());

  // Send PDF
  res.send(pdfBuffer);
});

export const emailInvoicePDF = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;
  const loggedInUser = req.user;

  if (!loggedInUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  if (!towRequestId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request ID is required');
  }

  const towRequest = await towRequestService.getTowRequestById(
    new mongoose.Types.ObjectId(towRequestId),
    loggedInUser
  );

  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }

  // Get company user for invoice details
  const companyUser = await getCompanyUserForInvoice(towRequest.towCompanyId);

  // Generate PDF
  const pdfBuffer = await generateInvoicePDF(towRequest, companyUser);

  // Send email to requester
  const recipientEmail = towRequest.requesterEmail;
  const recipientName = towRequest.requesterName || 'Customer';
  const invoiceNumber = towRequest.invoiceNumber || towRequest.id?.toString() || towRequest._id?.toString() || undefined;

  await sendInvoiceEmail(
    recipientEmail,
    recipientName,
    towRequestId,
    invoiceNumber,
    pdfBuffer,
    loggedInUser
  );

  res.status(httpStatus.OK).send({
    message: 'Invoice email sent successfully',
    sentTo: recipientEmail,
  });
});


export const getNextInvoiceNumber = catchAsync(async (_: Request, res: Response) => {
  const invoiceNumber = await towRequestService.getNextInvoiceNumber();
  if (!invoiceNumber) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }
  res.send({ invoiceNumber });
});

// export const updateTowRequestById = catchAsync(async (req: Request, res: Response) => {
//   const towRequest = await towRequestService.updateTowRequestById(req.params['id'] as any, req.body);
//   res.send(towRequest);
// });

export const deleteTowRequestById = catchAsync(async (req: Request, res: Response) => {
  await towRequestService.deleteTowRequestById(req.params['id'] as any);
  res.status(httpStatus.NO_CONTENT).send();
});

export const createOneTimeLink = catchAsync(async (req: Request, res: Response) => {
  try {
    // Body: { email?: string, phoneNumber?: string, otherInfo: any, passkey?: string, contactMethod: 'email' | 'phone' }
    const { email, phoneNumber, passkey, contactMethod = 'email' } = req.body as { 
      email?: string; 
      phoneNumber?: string; 
      passkey?: string; 
      contactMethod?: 'email' | 'phone';
      otherInfo?: any;
    };
    let loggedInUser = req.user;

    // Check if user needs subscription and validate limits (same as createTowRequest)
    const userTypesRequiringSubscription = [
      'tow-company-owner',
      'tow-company-manager',
      'tow-company-employee',
      'parking-spaces-provider-owner',
      'parking-spaces-provider-manager',
      'parking-spaces-provider-employee',
      'tow-requester',
    ];

    if (userTypesRequiringSubscription.includes(loggedInUser.userType)) {
      // Get company ID based on user type
      let companyId: mongoose.Types.ObjectId;
      if (loggedInUser.userType === 'tow-company-owner') {
        companyId = new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id);
      } else if (loggedInUser.userType === 'tow-company-manager' || loggedInUser.userType === 'tow-company-employee') {
        if (!loggedInUser.towCompanyId) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Tow company ID not found');
        }
        companyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
      } else if (loggedInUser.userType.includes('parking-spaces-provider')) {
        // PSP users are associated with a tow company, and the tow company has the subscription
        if (!loggedInUser.towCompanyId) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Tow company ID not found for parking space provider');
        }
        companyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
      } else {
        companyId = new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id);
      }

      // Get subscription
      const subscription = await subscriptionService.getCompanySubscription(companyId);
      
      if (!subscription || subscription.status !== 'active') {
        try {
          await createSystemLog({
            user: loggedInUser,
            event: 'One-time link creation denied - no active subscription',
            customMetadata: {
              reason: 'No active subscription found',
              userType: loggedInUser.userType,
              companyId: companyId.toString(),
              subscriptionStatus: subscription?.status || 'none',
            },
          });
        } catch (logError) {
          console.error('Failed to log subscription denial:', logError);
        }
        throw new ApiError(httpStatus.FORBIDDEN, 'You need an active subscription to generate one-time tow request links. Please subscribe to a plan.', true, '', 'NO_SUBSCRIPTION');
      }

      // Check if subscription has billing period dates
      if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
        // If no billing period, use subscription start/end dates
        const periodStart = subscription.startDate || new Date();
        const periodEnd = subscription.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Count tow requests in this period
        const towRequestCount = await towRequestService.countTowRequestsInBillingPeriod(
          loggedInUser,
          periodStart,
          periodEnd
        );

        // Get tier limit
        const tier = subscription.tierId as any;
        const freeTowRequestsLimit = tier?.freeTowRequests || 0;

        if (towRequestCount >= freeTowRequestsLimit) {
          try {
            await createSystemLog({
              user: loggedInUser,
              event: 'One-time link creation denied - limit reached',
              customMetadata: {
                reason: 'Tow request limit reached',
                userType: loggedInUser.userType,
                companyId: companyId.toString(),
                currentCount: towRequestCount,
                limit: freeTowRequestsLimit,
                periodStart: periodStart.toISOString(),
                periodEnd: periodEnd.toISOString(),
              },
            });
          } catch (logError) {
            console.error('Failed to log limit reached:', logError);
          }
          throw new ApiError(
            httpStatus.FORBIDDEN,
            `You have reached your monthly limit of ${freeTowRequestsLimit} tow requests. Please upgrade your plan or wait for the next billing cycle.`,
            true,
            '',
            'LIMIT_REACHED'
          );
        }
      } else {
        // Use billing period from subscription
        const periodStart = subscription.currentPeriodStart;
        const periodEnd = subscription.currentPeriodEnd;
        
        // Count tow requests in this period
        const towRequestCount = await towRequestService.countTowRequestsInBillingPeriod(
          loggedInUser,
          periodStart,
          periodEnd
        );

        // Get tier limit
        const tier = subscription.tierId as any;
        const freeTowRequestsLimit = tier?.freeTowRequests || 0;

        if (towRequestCount >= freeTowRequestsLimit) {
          try {
            await createSystemLog({
              user: loggedInUser,
              event: 'One-time link creation denied - limit reached',
              customMetadata: {
                reason: 'Tow request limit reached',
                userType: loggedInUser.userType,
                companyId: companyId.toString(),
                currentCount: towRequestCount,
                limit: freeTowRequestsLimit,
                periodStart: periodStart.toISOString(),
                periodEnd: periodEnd.toISOString(),
              },
            });
          } catch (logError) {
            console.error('Failed to log limit reached:', logError);
          }
          throw new ApiError(
            httpStatus.FORBIDDEN,
            `You have reached your monthly limit of ${freeTowRequestsLimit} tow requests. Please upgrade your plan or wait for the next billing cycle.`,
            true,
            '',
            'LIMIT_REACHED'
          );
        }
      }
    }
    
    const contactInfo: { email?: string; phoneNumber?: string } = {};
    if (email) contactInfo.email = email;
    if (phoneNumber) contactInfo.phoneNumber = phoneNumber;
    const token = await towRequestService.createOneTimeLink(contactInfo, loggedInUser, req.body['otherInfo'], passkey, contactMethod);

    const notificationMethod = contactMethod === 'email' ? 'email' : 'SMS';
    res.send({
      token,
      message: `A ${notificationMethod} has been dispatched to the user with the link to proceed with the request`,
      code: 200,
    });
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, '' + e);
  }
});

export const handleInviteLink = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    if (!token) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No token found');
    }
    const handling = await towRequestService.handleOneTimeLink(token);
    res.send(handling);
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
});

export const validateReferer = catchAsync(async (req: Request, res: Response) => {
  const { refererId } = req.params;
  
  if (!refererId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Referer ID is required');
  }

  const result = await towRequestService.validateReferer(refererId);
  
  if (!result.isValid) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid referer: Only tow company owners and managers can be used as referers');
  }

  res.send({
    isValid: true,
    referer: {
      id: result.referer?.id || result.referer?._id,
      userType: result.referer?.userType,
      fullName: result.referer?.fullName,
      email: result.referer?.email,
    },
  });
});

export const checkGraceTime = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    if (!token) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No token found');
    }
    const handling = await towRequestService.checkGraceTime(token);
    res.send(handling);
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
});

export const checkPasskeyRequirement = catchAsync(async (req: Request, res: Response) => {
  const { pspId } = req.params;
  const { towCompanyId } = req.query;
  const loggedInUser = req.user;

  if (!pspId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'PSP ID is required');
  }

  // Get tow company ID from logged in user
  const userTowCompanyId = loggedInUser?.userType === 'tow-company-owner' 
    ? loggedInUser?.id || loggedInUser?._id 
    : loggedInUser.towCompanyId;

  const actualTowCompanyId = (towCompanyId as string) || userTowCompanyId;

  if (!actualTowCompanyId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company ID is required');
  }

  try {
    const requiresPasskey = await passkeyService.checkPasskeyRequirement(pspId, actualTowCompanyId);

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        requiresPasskey,
      },
    });
  } catch (error) {
    console.error('Error checking passkey requirement:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error checking passkey requirement');
  }
});

export const discardCrossCompanyTransfer = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };
  const manager = req.user as IUserDoc;

  if (!token) throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');

  await towRequestService.discardCrossCompanyTransfer(token, manager);

  res.send({
    code: 200,
    message: 'The cross-company transfer request has been discarded successfully',
  });
});


export const getTowRequestByIDs = catchAsync(async (req: Request, res: Response) => {
  let filter = pick(req.query, ['status']);
  const loggedInUser = req.user as IUserDoc;
  if (loggedInUser.userType === 'tow-company-manager' || loggedInUser.userType === 'tow-company-owner') {
    if (!filter.status) {
      filter.status = { $ne: 'PENDING_PSP_APPROVAL' };
    }
    if (loggedInUser.userType === 'tow-company-manager') {
      filter.towCompanyId = loggedInUser.towCompanyId;
    } else {
      filter.towCompanyId = loggedInUser.id;
    }
  }

  if (loggedInUser.userType === 'tow-company-employee') {
    if (!filter.status) {
      filter.status = { $ne: 'PENDING_PSP_APPROVAL' };
    }
    filter = {
      ...filter,
      $or: [{ assignedTo: new mongoose.Types.ObjectId(loggedInUser.id) }, { requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id) }, { towCompanyId: new mongoose.Types.ObjectId(loggedInUser.towCompanyId) }],
    };
  }

  if (loggedInUser.userType.includes('parking-spaces-provider')) {
    // For PSP owners, use their own ID as pspCompanyId
    // For PSP managers and employees, use their pspCompanyId field
    const pspCompanyId = loggedInUser.userType === 'parking-spaces-provider-owner' 
      ? loggedInUser.id 
      : loggedInUser.pspCompanyId;
    
    filter = {
      ...filter,
      $or: [
        { pspCompanyId: new mongoose.Types.ObjectId(pspCompanyId) }, 
        { requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id) }
      ],
    };
  }

  const result = await towRequestService.getTowRequestIDs(filter);

  res.send(result);
});

export const updateOperatorLocation = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;
  const { location } = req.body;

  if (!location || !location.lat || !location.lng) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Location with lat and lng is required');
  }

  const result = await towRequestService.updateOperatorLocation(
    new mongoose.Types.ObjectId(towRequestId),
    location,
    req.user
  );

  res.send({
    message: 'Operator location updated successfully',
    towRequest: result,
    code: 200,
  });
});

export const reassignTowRequest = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;
  const { newOperatorId } = req.body;

  // Log reassignment attempt
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request reassignment attempted',
    customMetadata: {
      towRequestId,
      newOperatorId,
      ipAddress: req.ip,
    },
  });

  if (!newOperatorId) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request reassignment failed - missing newOperatorId',
      customMetadata: {
        reason: 'Missing newOperatorId',
        towRequestId,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'New operator ID is required');
  }

  if (!req.user) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request reassignment failed - user not authenticated',
      customMetadata: {
        reason: 'User not authenticated',
        towRequestId,
        newOperatorId,
      },
    });
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const result = await towRequestService.reassignTowRequest(towRequestId!, newOperatorId, req.user);
  
  // Log successful reassignment
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request reassigned successfully',
    customMetadata: {
      towRequestId: result._id,
      newOperatorId: result.assignedTo,
      status: result.status,
      ipAddress: req.ip,
    },
  });
  
  res.send({
    message: 'Tow request reassigned successfully',
    towRequest: result,
    code: 200,
  });
});

export const markVehiclePickedUp = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;

  if (!towRequestId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request ID is required');
  }

  const towRequest = await towRequestService.markVehiclePickedUp(
    new mongoose.Types.ObjectId(towRequestId),
    req.user
  );

  res.send({
    message: 'Vehicle marked as picked up successfully',
    towRequest,
    code: 200,
  });
});

export const updateLiveLocation = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;
  const { liveLocation } = req.body;

  // Log location update attempt
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request live location update attempted',
    customMetadata: {
      towRequestId,
      liveLocation,
      ipAddress: req.ip,
    },
  });

  if (!liveLocation) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request live location update failed - missing location data',
      customMetadata: {
        reason: 'Missing liveLocation data',
        towRequestId,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Live location data is required');
  }

  // Validate location data structure
  if (!liveLocation.lat || !liveLocation.lng) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request live location update failed - invalid location data',
      customMetadata: {
        reason: 'Missing lat/lng in liveLocation data',
        towRequestId,
        liveLocation,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Live location must include latitude and longitude');
  }

  // Validate latitude and longitude are valid numbers
  const lat = parseFloat(liveLocation.lat);
  const lng = parseFloat(liveLocation.lng);
  
  if (isNaN(lat) || isNaN(lng)) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request live location update failed - invalid coordinates',
      customMetadata: {
        reason: 'Invalid lat/lng values',
        towRequestId,
        liveLocation,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Latitude and longitude must be valid numbers');
  }

  if (lat < -90 || lat > 90) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request live location update failed - invalid latitude',
      customMetadata: {
        reason: 'Latitude out of range',
        towRequestId,
        liveLocation,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Latitude must be between -90 and 90 degrees');
  }

  if (lng < -180 || lng > 180) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request live location update failed - invalid longitude',
      customMetadata: {
        reason: 'Longitude out of range',
        towRequestId,
        liveLocation,
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Longitude must be between -180 and 180 degrees');
  }

  if (!req.user) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request live location update failed - user not authenticated',
      customMetadata: {
        reason: 'User not authenticated',
        towRequestId,
      },
    });
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const result = await towRequestService.updateLiveLocation(towRequestId!, liveLocation, req.user);
  
  // Log successful location update
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request live location updated successfully',
    customMetadata: {
      towRequestId: result._id,
      liveLocation: result.liveLocation,
      ipAddress: req.ip,
    },
  });
  
  res.send({
    message: 'Live location updated successfully',
    towRequest: result,
    code: 200,
  });
});

export const getTowRequestStatusCounts = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const counts = await towRequestService.getTowRequestStatusCounts(req.user);
  
  res.send({
    message: 'Tow request status counts retrieved successfully',
    data: counts,
    code: 200,
  });
});

/**
 * Get tow request count and limit for current billing period (lightweight endpoint)
 */
export const getTowRequestCountAndLimit = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const loggedInUser = req.user as IUserDoc;

  // Only for users who need subscription check
  const needsSubscriptionCheck =
    loggedInUser.userType === 'tow-company-owner' ||
    loggedInUser.userType === 'tow-company-manager' ||
    loggedInUser.userType === 'tow-company-employee' ||
    loggedInUser.userType?.includes('parking-spaces-provider');

  if (!needsSubscriptionCheck) {
    return res.send({
      message: 'Tow request count retrieved successfully',
      data: {
        count: 0,
        limit: 0,
        remaining: 0,
        hasActiveSubscription: false,
      },
      code: 200,
    });
  }

  // Get company ID
  const companyIdRaw =
    loggedInUser.userType === 'tow-company-owner'
      ? loggedInUser.id || loggedInUser._id
      : loggedInUser.towCompanyId;

  if (!companyIdRaw) {
    return res.send({
      message: 'Tow request count retrieved successfully',
      data: {
        count: 0,
        limit: 0,
        remaining: 0,
        hasActiveSubscription: false,
      },
      code: 200,
    });
  }

  // Convert to ObjectId
  const companyId = new mongoose.Types.ObjectId(companyIdRaw);

  // Get subscription (lightweight - only what we need)
  const subscription = await subscriptionService.getCompanySubscription(companyId);

  if (!subscription || subscription.status !== 'active') {
    return res.send({
      message: 'Tow request count retrieved successfully',
      data: {
        count: 0,
        limit: 0,
        remaining: 0,
        hasActiveSubscription: false,
      },
      code: 200,
    });
  }

  // Get billing period
  const periodStart = subscription.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : subscription.startDate
    ? new Date(subscription.startDate)
    : new Date();
  
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : subscription.endDate
    ? new Date(subscription.endDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Count tow requests
  const count = await towRequestService.countTowRequestsInBillingPeriod(
    loggedInUser,
    periodStart,
    periodEnd
  );

  // Get tier limit
  const tier = subscription.tierId as any;
  const limit = tier?.freeTowRequests || 0;
  const remaining = Math.max(0, limit - count);

  return res.send({
    message: 'Tow request count retrieved successfully',
    data: {
      count,
      limit,
      remaining,
      hasActiveSubscription: true,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      tierName: tier?.name,
    },
    code: 200,
  });
});

// Test endpoint to verify logging is working
export const testLogging = catchAsync(async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing logging functionality...');
    
    // Test tow request log
    await createTowRequestLog({
      user: req.user,
      event: 'Test tow request log',
      customMetadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
    
    // Test system log
    await createSystemLog({
      user: req.user,
      event: 'Test system log',
      customMetadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log('✅ Logging test completed successfully');
    
    res.send({
      message: 'Logging test completed successfully',
      code: 200,
    });
  } catch (error) {
    console.error('❌ Logging test failed:', error);
    res.status(500).send({
      message: 'Logging test failed',
      error: (error as any)?.message,
      code: 500,
    });
  }
});

export const getPendingAssignment = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (!loggedInUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Only tow operators can have pending assignments
  if (loggedInUser.userType !== 'tow-company-employee' || !loggedInUser.isTowOperator) {
    return res.status(httpStatus.OK).json({
      success: true,
      message: 'No pending assignments for this user type',
      data: null
    });
  }

  const pendingAssignment = await towRequestService.getPendingAssignment(loggedInUser.id);
  
  return res.status(httpStatus.OK).json({
    success: true,
    message: pendingAssignment ? 'Pending assignment found' : 'No pending assignments',
    data: pendingAssignment
  });
});

export const getMostRecentActiveTowRequest = catchAsync(async (req: Request, res: Response) => {
  const activeTowRequest = await towRequestService.getMostRecentActiveTowRequest(req.user);
  
  res.status(httpStatus.OK).send({
    success: true,
    message: activeTowRequest ? 'Active tow request found' : 'No active tow requests',
    data: activeTowRequest,
  });
});

export const assignTowToSelf = catchAsync(async (req: Request, res: Response) => {
  const { towRequestId } = req.params;

  if (!towRequestId) {
    await createSystemLog({
      user: req.user,
      event: 'Tow request self-assignment failed - missing towRequestId',
      customMetadata: {
        reason: 'Missing towRequestId in params',
      },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request ID is required');
  }

  // Log self-assignment attempt
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request self-assignment attempted',
    customMetadata: {
      towRequestId,
      ipAddress: req.ip,
    },
  });

  const towRequest = await towRequestService.assignTowToSelf(
    new mongoose.Types.ObjectId(towRequestId),
    req.user
  );
  
  // Log successful self-assignment
  await createTowRequestLog({
    user: req.user,
    event: 'Tow request self-assigned successfully',
    customMetadata: {
      towRequestId: towRequest._id,
      status: towRequest.status,
      ipAddress: req.ip,
    },
  });

  res.status(httpStatus.CREATED).send({
    message: 'Tow request self-assigned successfully',
    towRequest,
    code: 200,
  });
});

/**
 * Get recent license plates from tow requests created by the logged-in user
 */
export const getRecentLicensePlates = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const limit = parseInt(req.query['limit'] as string) || 10;
  const recentPlates = await towRequestService.getRecentLicensePlates(req.user, limit);

  res.send({
    message: 'Recent license plates retrieved successfully',
    data: recentPlates,
    code: 200,
  });
});

/**
 * Get pending tow invites for the current user
 */
export const getPendingTowInvites = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const { tokenService } = await import('../token/index.js');
  const pendingInvites = await tokenService.getPendingTowInvites(
    req.user.email,
    req.user.phoneNumber
  );

  res.send({
    message: 'Pending tow invites retrieved successfully',
    data: pendingInvites,
    code: 200,
  });
});

/**
 * Get sent tow invites by the current user (for tow managers/owners)
 */
export const getSentTowInvites = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const { tokenService } = await import('../token/index.js');
  const sentInvites = await tokenService.getSentTowInvites(req.user.id);

  res.send({
    message: 'Sent tow invites retrieved successfully',
    data: sentInvites,
    code: 200,
  });
});

/**
 * Revoke/invalidate a tow invite
 */
export const revokeTowInvite = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const { token } = req.params;
  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  const { tokenService } = await import('../token/index.js');
  const { emailService } = await import('../email/index.js');
  const { userService } = await import('../user/index.js');
  
  const revokeResult = await tokenService.revokeTowInvite(token, req.user.id);

  if (!revokeResult.success) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invite not found or already revoked');
  }

  // Get tow company name from user
  const companyName = req.user.towCompany?.companyName;

  // Find the invitee user to send socket notification
  let inviteeUser: IUserDoc | null = null;
  try {
    if (revokeResult.inviteeEmail && !revokeResult.inviteeEmail.startsWith('dummyemail')) {
      inviteeUser = await userService.getUserByEmail(revokeResult.inviteeEmail);
    }
    if (!inviteeUser && revokeResult.inviteePhone) {
      inviteeUser = await userService.getUserByPhone(revokeResult.inviteePhone);
    }
  } catch (e) {
    console.error('Error finding invitee user for socket notification:', e);
  }

  // Send real-time socket notification to invitee so their banner updates immediately
  if (inviteeUser) {
    const inviteeUserId = inviteeUser._id?.toString() || inviteeUser.id?.toString();
    if (inviteeUserId) {
      emitToUser(inviteeUserId, 'tow-request-update', {
        updatedBy: req.user.id?.toString() || req.user._id?.toString(),
        type: 'invitationCancelled',
        message: `Your tow request invitation from ${req.user.fullName || 'the tow company'} has been cancelled`,
        token: token,
        inviterName: req.user.fullName,
        towCompanyName: companyName,
      });
    }
  }

  // Send email notification to invitee (non-blocking)
  if (revokeResult.inviteeEmail && !revokeResult.inviteeEmail.startsWith('dummyemail')) {
    emailService.sendTowInviteCancelledEmailToInvitee(
      revokeResult.inviteeEmail,
      revokeResult.inviteeName,
      req.user.fullName,
      companyName
    ).catch((e: any) => console.error('Failed to send cancellation email to invitee:', e));
  }

  // Send confirmation email to manager (non-blocking)
  const inviteeContact = revokeResult.contactMethod === 'phone' 
    ? revokeResult.inviteePhone 
    : revokeResult.inviteeEmail;
  
  if (inviteeContact) {
    emailService.sendTowInviteCancelledEmailToManager(
      req.user,
      inviteeContact,
      companyName,
      revokeResult.contactMethod
    ).catch((e: any) => console.error('Failed to send cancellation email to manager:', e));
  }

  res.send({
    message: 'Tow invite revoked successfully',
    code: 200,
  });
});

/**
 * Resend a tow invite link (email/SMS) without creating a new user
 */
export const resendTowInvite = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const { token } = req.params;
  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  const { tokenService } = await import('../token/index.js');
  const { emailService } = await import('../email/index.js');
  const { smsService } = await import('../sms/index.js');
  
  // Get the token details
  const tokenDoc = await tokenService.resendTowInvite(token);
  
  if (!tokenDoc || !tokenDoc.additionalInfo) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invite not found');
  }

  const { email, phoneNumber, contactMethod, firstName, lastName } = tokenDoc.additionalInfo;
  const inviteeName = firstName ? `${firstName} ${lastName || ''}`.trim() : undefined;
  const inviteLink = `${config.clientUrl}/tow-invite/${token}`;
  const companyName = req.user.towCompany?.companyName || 'the tow company';

  // Resend based on the original contact method
  if (contactMethod === 'phone' && phoneNumber) {
    await smsService.sendOneTimeLinkSMS(
      {
        phoneNumber: phoneNumber,
        link: inviteLink,
        linkTitle: 'Tow Request Invitation',
        ...(inviteeName && { receiverName: inviteeName }),
        purpose: 'tow-invite',
      },
      req.user as IUserDoc
    );
  } else if (email && !email.startsWith('dummyemail')) {
    await emailService.sendTowRequestInvite(
      token,
      email,
      req.user as IUserDoc,
      companyName
    );
  }

  res.send({
    message: `Invite resent successfully via ${contactMethod === 'phone' ? 'SMS' : 'email'}`,
    code: 200,
  });
});

/**
 * Reject/decline a tow invite as the invitee
 */
export const rejectTowInvite = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const { token } = req.params;
  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  const { tokenService } = await import('../token/index.js');
  const { emailService } = await import('../email/index.js');
  const { userService } = await import('../user/index.js');
  
  const rejectResult = await tokenService.rejectTowInviteAsInvitee(
    token, 
    req.user.email, 
    req.user.phoneNumber
  );

  if (!rejectResult.success) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invite not found or already processed');
  }

  // Send email notification to the inviter/manager (non-blocking)
  if (rejectResult.inviterUserId) {
    try {
      const inviter = await userService.getUserById(new mongoose.Types.ObjectId(rejectResult.inviterUserId));
      if (inviter?.email) {
        const inviteeContact = req.user.email || req.user.phoneNumber;
        emailService.sendTowInviteRejectedEmailToManager(
          inviter.email,
          rejectResult.inviterName || inviter.fullName,
          rejectResult.inviteeName || req.user.fullName,
          inviteeContact,
          rejectResult.towCompanyName
        ).catch((e: any) => console.error('Failed to send rejection email to manager:', e));
      }
    } catch (e) {
      console.error('Error fetching inviter for rejection email:', e);
    }
  }

  res.send({
    message: 'Tow invite declined successfully',
    code: 200,
  });
});
