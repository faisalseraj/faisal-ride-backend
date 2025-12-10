import * as apartmentComplexService from '../apartmentComplex/apartmentComplex.service';

import { ILocation, ITowRequest, ITowRequestDoc, NewCreatedTowRequest } from './tow-request.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
import { Token, tokenService } from '../token';
import { User, userService } from '../user';
import { generateInvoicePDF, getCompanyUserForInvoice } from './pdf-invoice.service';
import {
  sendAccountSetupLink,
  sendForceAssignmentEmailToManager,
  sendForceAssignmentEmailToPSP,
  sendForceAssignmentEmailToTowOperator,
  sendInviteStatusEmailToManager,
  sendTowRequestInviteReminder,
  sendTowingAssignmentEmailToManager,
  sendTowingNotification,
  sendTowingNotificationToTowOperator,
  towingRequestFollowUpEmailToLinkedUsers,
  towingRequestInviteAcceptedEmailToPSP,
  towingRequestStatusUpdateEmailToLinkedUsers,
  towingRequestUpdatesEmailToLinkedUsers,
} from '../email/email.service';

import { ApiError } from '../errors';
import { IUserDoc } from '../user/user.interfaces';
import { IoSocket } from '../../app';
import TowRequest from './tow-request.model';
import { chatService } from '../chat';
import config from '../../config/config';
import { emailService } from '../email';
import { emitRoomCreatedNotification } from '../chat/chat.service';
import { getFileFromS3 } from '../S3Bucket';
import { getPulse } from '../../lib/pulse';
import httpStatus from 'http-status';
import { jurisdictionService } from '../jurisdiction';
import moment from 'moment';
import mongoose from 'mongoose';
import { notificationService } from '../notifications';
import { passkeyService } from '../passkey';
import { pushSubscriptionService } from '../pushNotification';
import { smsService } from '../sms';

// Constants for dummy values
const DUMMY_PHONE_PREFIX = '+1000000';
const getDummyEmail = (phoneNumber: string) => `dummyemail${phoneNumber.replace(/\D/g, '')}@gmail.com`;

// Helper function to check if a phone number is a dummy phone
export const isDummyPhoneNumber = (phoneNumber?: string): boolean => {
  if (!phoneNumber) return false;
  return phoneNumber.startsWith(DUMMY_PHONE_PREFIX);
};

// Generate a unique dummy phone number
export const generateUniqueDummyPhone = async (): Promise<string> => {
  // Find the highest dummy phone number currently in use
  const latestUser = await User.findOne(
    { phoneNumber: { $regex: `^\\${DUMMY_PHONE_PREFIX}` } },
    { phoneNumber: 1 }
  ).sort({ phoneNumber: -1 });
  
  let nextNumber = 1;
  if (latestUser?.phoneNumber) {
    // Extract the number portion after the prefix
    const currentNumber = parseInt(latestUser.phoneNumber.replace(DUMMY_PHONE_PREFIX, ''), 10);
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1;
    }
  }
  
  // Generate new dummy phone with padded number (e.g., +10000001, +10000002, etc.)
  return `${DUMMY_PHONE_PREFIX}${String(nextNumber).padStart(4, '0')}`;
};

// Direct socket emission helpers
const emitToUser = (userId: string, event: string, data: any) => {
  console.log(`Emitting to user room: user-${userId}`, event, data);
  IoSocket.emit(`user-${userId}`, data);
};

export const emitToTowRequest = (towRequestId: string, event: string, data: any) => {
  console.log(`Emitting to tow request room: tow-request-${towRequestId}`, event, data);
  IoSocket.emit(`tow-request-${towRequestId}`, data);
};

/**
 * Calculate subtotal from charges object
 * Sums all charge items: (price * quantity) for each charge type
 */
export const calculateChargesSubtotal = (charges: ITowRequest['charges']): number => {
  if (!charges) return 0;

  let total = 0;

  // Unloaded mileage
  if (charges.unloadedEnrouteMileage?.price && charges.unloadedEnrouteMileage?.quantity) {
    total += charges.unloadedEnrouteMileage.price * charges.unloadedEnrouteMileage.quantity;
  }

  // Loaded mileage
  if (charges.loadedHookedMileage?.price && charges.loadedHookedMileage?.quantity) {
    total += charges.loadedHookedMileage.price * charges.loadedHookedMileage.quantity;
  }

  // Impound fee
  if (charges.impoundFee?.price) {
    total += charges.impoundFee.price * (charges.impoundFee.quantity || 1);
  }

  // Private property tow fee
  if (charges.privatePropertyTowFee?.price) {
    total += charges.privatePropertyTowFee.price * (charges.privatePropertyTowFee.quantity || 1);
  }

  // Notification fee
  if (charges.notificationFee?.price) {
    total += charges.notificationFee.price * (charges.notificationFee.quantity || 1);
  }

  // Daily impound rate
  if (charges.dailyImpoundRate?.price && charges.dailyImpoundRate?.quantity) {
    total += charges.dailyImpoundRate.price * charges.dailyImpoundRate.quantity;
  }

  return total;
};

// ---------- Chat Integration Functions ----------
/**
 * Create tow request chat room and send initial system message
 * @param {string} towRequestId - The ID of the tow request
 * @param {IUserDoc} requester - The user who created the request
 * @param {string} towCompanyId - The tow company ID
 */
export const createTowRequestChat = async (
  towRequestId: string,
  requester: IUserDoc,
  towCompanyId: string,
  assignedTo?: string
): Promise<void> => {
  try {
    // Get all relevant participants
    const towManagers = await userService.getTowManagersByTowCompanyId(towCompanyId);
    const participants = [requester._id.toString()];

    // Add tow managers (avoid duplicates)
    towManagers.forEach((manager) => {
      if (!participants.includes(manager._id.toString())) {
        participants.push(manager._id.toString());
      }
    });

    // Add assigned tow operator if provided (avoid duplicates)
    if (assignedTo) {
      if (!participants.includes(assignedTo)) {
        participants.push(assignedTo);
      }
    }

    // Create tow request chat room
    await chatService.createRoom(requester._id.toString(), {
      name: `Tow Request #${towRequestId}`,
      type: 'tow-request',
      participants,
      towRequestId,
      metadata: {
        description: `Chat for tow request ${towRequestId}`,
        towRequestId,
      },
    });

    // Send initial message from the requester instead of system
    const chatRoom = await chatService.getTowRequestChatRoom(towRequestId, requester._id.toString());
    if (chatRoom) {
      await chatService.sendMessage(requester._id.toString(), {
        roomId: chatRoom.id,
        content: `🚨 New tow request created by ${requester.fullName}. All updates will be shared here.`,
        messageType: 'text',
        metadata: {
          isSystemMessage: true,
          isInitialMessage: true,
          towRequestId: towRequestId,
        },
      });
    }

    await emitRoomCreatedNotification(chatRoom, participants);

    console.log(`Created chat room for tow request ${towRequestId}`);
  } catch (error) {
    console.error('Failed to create tow request chat:', error);
  }
};

/**
 * Send system message to tow request chat
 * @param {string} towRequestId - The ID of the tow request
 * @param {string} message - The system message content
 * @param {any} metadata - Optional metadata
 */
export const sendTowRequestChatMessage = async (towRequestId: string, message: string, metadata?: any): Promise<void> => {
  try {
    await chatService.emitMessageToTowRequestChat(towRequestId, message, metadata);
  } catch (error) {
    console.error('Failed to send tow request chat message:', error);
  }
};

/**
 * Remove user from tow request chat room
 * @param {string} towRequestId - The ID of the tow request
 * @param {string} userId - The ID of the user to remove
 * @param {string} removedByUserId - The ID of the user making the removal (system or admin)
 */
export const removeUserFromTowRequestChat = async (
  towRequestId: string,
  userId: string,
  removedByUserId?: string,
  skipAdminCheck?: boolean
): Promise<void> => {
  try {
    const chatRoom = await chatService.getTowRequestChatRoomById(towRequestId);
    if (chatRoom) {
      // Use the user being removed as the remover if no specific remover is provided (for system operations)
      const removerId = removedByUserId || userId;
      await chatService.removeParticipant(chatRoom._id.toString(), removerId, userId, skipAdminCheck);
      console.log(`Removed user ${userId} from tow request ${towRequestId} chat room`);
    } else {
      console.log(`Chat room not found for tow request ${towRequestId}`);
    }
  } catch (error) {
    console.error(`Failed to remove user ${userId} from tow request ${towRequestId} chat:`, error);
  }
};

/**
 * Add user to tow request chat room
 * @param {string} towRequestId - The ID of the tow request
 * @param {string} userId - The ID of the user to add
 * @param {string} role - The role of the user in the chat (default: 'member')
 */
export const addUserToTowRequestChat = async (
  towRequestId: string,
  userId: string,
  role: string = 'member'
): Promise<void> => {
  try {
    const chatRoom = await chatService.getTowRequestChatRoomById(towRequestId);
    if (chatRoom) {
      const bypassAdminCheck = true;
      await chatService.addParticipant(chatRoom._id.toString(), userId, userId, bypassAdminCheck);
      console.log(`Added user ${userId} to tow request ${towRequestId} chat room with role ${role}`);
    } else {
      console.log(`Chat room not found for tow request ${towRequestId}`);
    }
  } catch (error) {
    console.error(`Failed to add user ${userId} to tow request ${towRequestId} chat:`, error);
  }
};

// Notification message generator based on event type
export const getNotificationMessage = (type: string, data?: any): string => {
  const messages: Record<string, string> = {
    // Request creation and assignment
    requestCreated: 'A new tow request has been created',
    requestApprovalPending: 'A new tow request has been created and is waiting for your approval',
    requestAssigned: 'A tow request has been assigned to you and is waiting for your approval',
    requestAccepted: 'Tow request has been accepted and is now in progress',
    requestRejected: 'Tow request has been rejected',
    requestCancelled: 'Tow request has been cancelled',
    requestCompleted: 'Tow request has been completed successfully',
    requestReassigned: 'Tow request has been reassigned to another operator',

    // Status updates
    statusUpdated: 'Tow request status has been updated',
    updated: 'Tow request details have been updated',

    // Location updates
    liveLocationUpdated: data?.operator ? `Live location updated by ${data.operator}` : 'Live location has been updated',
    operatorLocationUpdate: 'Operator location has been updated',
    vehiclePickedUp: data?.operator ? `Vehicle has been picked up by ${data.operator}` : 'Vehicle has been picked up',

    // System events
    requestEscalated: 'Tow request has been escalated after 5 minutes',
    autoReassignFailed: 'Tow request auto-reassignment failed - no available operators',
    requestAutoRejected: 'Tow request has been automatically rejected after 5 minutes - operator did not respond',

    // Transfer events
    invitationReceived: data?.inviter
      ? `${data.inviter} has invited you to create tow requests`
      : 'You have received a new invitation to create tow requests',
    pending:
      data?.actor && data?.targetUser
        ? `${data.actor} wants to transfer ${data.targetUser} to their company`
        : 'Cross-company transfer is pending approval',
    accepted: 'Cross-company transfer has been accepted',
    discarded:
      data?.actor && data?.targetUser
        ? `Cross-company transfer between ${data.actor} and ${data.targetUser} has been discarded`
        : 'Cross-company transfer has been discarded',

    // Deletion
    deleted: 'Tow request has been deleted',

    // VIN and other updates
    vinUploaded: 'VIN information has been uploaded',
    new: 'A new tow request has been created',
  };

  // Return specific message if available, otherwise return a generic message
  return messages[type] || `Updates received on tow request `;
};

/**
 * Create a tow request
 * @param {NewCreatedTowRequest} towRequestToCreate
 * @returns {Promise<ITowRequestDoc>}
 */
export const createTowRequest = async (
  towRequestToCreate: NewCreatedTowRequest,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  // Determine the correct towCompanyId based on user type
  let towCompanyId: mongoose.Types.ObjectId;
  let refererUser: IUserDoc | undefined;
  
  // Validate referer if user is tow-requester and get towCompanyId from referer
  if (loggedInUser.userType === 'tow-requester') {
    // Tow-requester must have a referer to create a tow request
    if (!towRequestToCreate.referer) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Referer is required for tow-requester users'
      );
    }
    
    const refererValidation = await validateReferer(towRequestToCreate.referer);
    if (!refererValidation.isValid || !refererValidation.referer) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Invalid referer: Only tow company owners and managers can be used as referers'
      );
    }
    
    refererUser = refererValidation.referer;
    
    // For tow-requester, use the referer's towCompanyId
    // If referer is tow-company-owner, use referer.id; otherwise use referer.towCompanyId
    if (refererUser.userType === 'tow-company-owner') {
      towCompanyId = new mongoose.Types.ObjectId(refererUser.id || refererUser._id);
    } else {
      if (!refererUser.towCompanyId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Referer tow company ID not found');
      }
      towCompanyId = new mongoose.Types.ObjectId(refererUser.towCompanyId);
    }
    
    // Note: tow-requester users don't have a towCompanyId, so we don't validate against it
  } else if (loggedInUser.userType === 'tow-company-owner') {
    // For tow-company-owner, use user.id
    towCompanyId = new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id);
  } else {
    // For PSP owner/manager/employee, tow-company-manager, tow-company-employee: use loggedInUser.towCompanyId
    if (!loggedInUser.towCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow company ID not found');
    }
    towCompanyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
  }
  
  const towManagers = await userService.getTowManagersByTowCompanyId(towCompanyId.toString());
  const sentTo = towManagers.map((manager) => manager._id);

  const towRequestBody: ITowRequest = {
    ...towRequestToCreate, // Spreading all new fields from the updated interface
    towCompanyId: towCompanyId,
    requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser._id),
    //  ...(loggedInUser.userType && ),
    pspCompanyId: loggedInUser.pspCompanyId || loggedInUser?.id || loggedInUser?._id,
    ...(loggedInUser?.userType.includes('parking-spaces-provider')
      ? {
          requesterPhoneNumber: loggedInUser?.userType.includes('parking-spaces-provider')
            ? towRequestToCreate?.requesterPhoneNumber !== loggedInUser.phoneNumber
              ? towRequestToCreate?.requesterPhoneNumber
              : loggedInUser.phoneNumber
            : loggedInUser.phoneNumber!,
          requesterName: loggedInUser?.userType.includes('parking-spaces-provider') ? loggedInUser?.fullName : '',
          requesterEmail: loggedInUser?.userType.includes('parking-spaces-provider') ? loggedInUser?.email : '',
        }
      : {}),

    sentTo,
    status: 'PENDING_ASSIGNMENT',
    ...(loggedInUser.userType === 'tow-company-employee'
      ? {
          assignedTo: loggedInUser._id,
          assignedBy: loggedInUser._id,
          assignedByName: loggedInUser.fullName,
          assignedByEmail: loggedInUser.email,
          assignedToEmail: loggedInUser.email,
          assignedToName: loggedInUser.fullName,
          status: 'ACCEPTED',
          // For tow operators, auto-populate requester info if not provided
          requesterPhoneNumber: towRequestToCreate?.requesterPhoneNumber || loggedInUser.phoneNumber,
          requesterName: towRequestToCreate?.requesterName || loggedInUser.fullName,
          requesterEmail: towRequestToCreate?.requesterEmail || loggedInUser.email,
        }
      : {}),
  };

  if (!towRequestBody.invoiceNumber) {
    const invoiceNumber = await getNextInvoiceNumber();
    towRequestBody.invoiceNumber = invoiceNumber;
  }
  
  // Handle referer field - remove it after validation since it's not in the schema
  // For tow-requester, we already validated and got the referer above
  if (loggedInUser.userType === 'tow-requester' && refererUser) {
    // Store referer info but remove the referer field (not in schema)
    towRequestBody.refererEmail = refererUser.email!;
    towRequestBody.refererName = refererUser.fullName!;
    delete towRequestBody.referer; // Remove referer field as it's not in the schema
  } else if (towRequestBody.referer) {
    // Legacy handling for other user types (if any)
    const referer = await userService.getUserById(new mongoose.Types.ObjectId(towRequestBody.referer));
    if (referer) {
      const refererTowCompanyId = referer.userType === 'tow-company-owner' 
        ? referer.id || referer._id 
        : referer.towCompanyId;
      
      if (refererTowCompanyId?.toString() !== towCompanyId.toString()) {
        towRequestBody.refererEmail = referer?.email!;
        towRequestBody.refererName = referer?.fullName!;
      }
    }
    delete towRequestBody.referer; // Remove referer field as it's not in the schema
  }
  
  // Store refererUser for later use in notifications (only for tow-requester)
  const referer = refererUser;

  // jurisdiction logic - skip auto-selection for Consent tow type
  if (towRequestBody.towType !== 'Consent') {
    const jurisdiction = await jurisdictionService.findJurisdictionByLocation(towRequestBody.location);
    if (jurisdiction?.name) {
      towRequestBody.jurisdiction = jurisdiction.name;
      towRequestBody.charges = {
        unloadedEnrouteMileage: { quantity: 0, price: jurisdiction.charges.unloadedEnrouteMileage },
        loadedHookedMileage: { quantity: 0, price: jurisdiction.charges.loadedHookedMileage },
        impoundFee: { quantity: 1, price: jurisdiction.charges.impoundFee },
        privatePropertyTowFee: { quantity: 1, price: jurisdiction.charges.privatePropertyTowFee },
        notificationFee: { quantity: 1, price: jurisdiction.charges.notificationFee },
        dailyImpoundRate: { quantity: 1, price: jurisdiction.charges.dailyImpoundRate },
      };
      // Calculate subtotal from all charges
      towRequestBody.charges.subTotal = calculateChargesSubtotal(towRequestBody.charges);
    }
  } else {
    // For Consent tow type, set mileage quantities to 0 and don't auto-select jurisdiction
    if (!towRequestBody.charges) {
      towRequestBody.charges = {
        unloadedEnrouteMileage: { quantity: 0, price: 0 },
        loadedHookedMileage: { quantity: 0, price: 0 },
        impoundFee: { quantity: 1, price: 0 },
        privatePropertyTowFee: { quantity: 1, price: 0 },
        notificationFee: { quantity: 1, price: 0 },
        dailyImpoundRate: { quantity: 1, price: 0 },
      };
    } else {
      // Ensure mileage quantities are 0 for Consent tow type
      if (towRequestBody.charges.unloadedEnrouteMileage) {
        towRequestBody.charges.unloadedEnrouteMileage.quantity = 0;
      }
      if (towRequestBody.charges.loadedHookedMileage) {
        towRequestBody.charges.loadedHookedMileage.quantity = 0;
      }
    }
    // Calculate subtotal from all charges
    if (towRequestBody.charges) {
      towRequestBody.charges.subTotal = calculateChargesSubtotal(towRequestBody.charges);
    }
  }
  
  // If charges are provided in the request body, recalculate subtotal
  if (towRequestBody.charges) {
    towRequestBody.charges.subTotal = calculateChargesSubtotal(towRequestBody.charges);
  }
  const towRequest = await TowRequest.create(towRequestBody);
  const populatedImages = await getSignedImagesForTowRequest(towRequest);

  // Create tow request chat room
  await createTowRequestChat(
    towRequest._id.toString(),
    loggedInUser,
    towCompanyId.toString(),
    towRequest.assignedTo?.toString()
  );

  if (towRequest.status === 'PENDING_ASSIGNMENT') {
    // Send notifications to tow managers (excluding the creator if they're a tow operator)
    const managersToNotify = towManagers.filter((manager) => manager._id.toString() !== loggedInUser._id.toString());

    managersToNotify.forEach((manager) => {
      sendTowingNotification(
        manager.fullName!,
        manager,
        manager.email!,
        towRequestBody.location,
        loggedInUser,
        populatedImages.licensePlates,
        towRequest.id || towRequest._id,
        !!loggedInUser.isTowOperator
      );

      emitToUser(manager.id?.toString() || manager._id?.toString(), 'tow-request-update', {
        updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
        id: towRequest.id?.toString() || towRequest._id?.toString(),
        message: getNotificationMessage('requestCreated', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
        status: towRequest.status,
        type: 'requestCreated',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });

      pushSubscriptionService.sendToUsers(
        [manager.id || manager._id],
        '🚨 New Tow Request',
        `Tow request ${towRequest.id || towRequest._id} created at ${towRequest.location.address}`,
        `/tow-requests/${towRequest.id || towRequest._id}`
      );
    });
    if (referer?.email) {
      emailService.sendTowingNotificationToReferer(
        referer.fullName!,
        referer,
        referer.email!,
        towRequestBody.location,
        loggedInUser,
        populatedImages.licensePlates
      );
      emitToUser(referer.id?.toString() || referer._id?.toString(), 'tow-request-update', {
        updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
        id: towRequest.id?.toString() || towRequest._id?.toString(),
        message: getNotificationMessage('new', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
        status: towRequest.status,
        type: 'new',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });
      pushSubscriptionService.sendToUsers(
        [referer?._id?.toString() || referer?.id?.toString()],
        '🚨 New Tow Request',
        `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} created at ${towRequest.location.address}`,
        `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
      );
    }
  }

  //approval not requires because of entering a passkey
  // else {
  //   const pspManagerAndOwner = await userService.getPSPManagerByPSPId(loggedInUser.pspCompanyId);
  //   pspManagerAndOwner.map((manager) => {
  //     sendTowingApprovalNotification(
  //       manager,
  //       manager.email!,
  //       towRequestBody.location,
  //       loggedInUser,
  //       populatedImages.licensePlates,
  //       towRequest.id || towRequest._id
  //     );

  //     emitToUser(manager.id?.toString() || manager._id?.toString(), 'tow-request-update', {
  //       updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
  //       id: towRequest.id?.toString() || towRequest._id?.toString(),
  //       message: getNotificationMessage('requestApprovalPending', {
  //         id: towRequest.id?.toString() || towRequest._id?.toString(),
  //       }),
  //       status: towRequest.status,
  //       type: 'requestApprovalPending',
  //       towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
  //     });

  //     pushSubscriptionService.sendToUsers(
  //       [manager.id || manager._id],
  //       '🚨 New Tow Request',
  //       `Tow request ${towRequest.id || towRequest._id} created at ${towRequest.location.address}`,
  //       `/tow-requests/${towRequest.id || towRequest._id}`
  //     );
  //   });

  //   // Send new tow request event for notification count updates
  //   const affectedUsers = towManagers.map((m) => m._id.toString());
  //   if (loggedInUser._id) {
  //     affectedUsers.push(loggedInUser._id.toString());
  //   }

  //   affectedUsers.forEach((userId) => {
  //     emitToUser(userId, 'newTowRequest', {
  //       towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
  //       affectedUsers: affectedUsers,
  //     });
  //   });

  //   const pulse = getPulse();

  //   (async () => {
  //     const autoApproveTime = new Date(new Date().getTime() + 5 * 60 * 1000);
  //     console.log(autoApproveTime, 'auto approve time');
  //     await pulse.start(); // start processing jobs
  //     await pulse.schedule(autoApproveTime, 'autoApproveTowRequest', {
  //       towRequestId: towRequest.id || towRequest._id,
  //     });
  //   })();
  // }

  return towRequest;
};

/**
 * Assign a tow request to an operator
 * @param {mongoose.Types.ObjectId} towId
 * @param {mongoose.Types.ObjectId} assignedTo
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc>}
 */
export const assignTowToOperator = async (
  towId: mongoose.Types.ObjectId,
  assignedTo: mongoose.Types.ObjectId,
  towOperatorLocation: ILocation,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  try {
    const assignedToUser = await User.findById(new mongoose.Types.ObjectId(assignedTo));

    if (loggedInUser.userType === 'tow-company-employee' && !loggedInUser.isTowOperator) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You are not authorized to assign a tow');
    }
    if (!assignedToUser) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const towRequest = await TowRequest.findById(new mongoose.Types.ObjectId(towId)).populate('requestCreatedBy');
    if (towRequest?.assignedTo) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is already assigned');
    }
    if (!towRequest) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
    }
    towRequest.assignedTo = assignedToUser._id;
    towRequest.assignedToEmail = assignedToUser.email!;
    towRequest.assignedToName = assignedToUser.fullName!;
    towRequest.driverBadgeNumber = assignedToUser.driverBadgeNumber ?? '';

    towRequest.assignedBy = loggedInUser?.id || loggedInUser?._id;
    towRequest.assignedByEmail = loggedInUser.email!;
    towRequest.assignedByName = loggedInUser.fullName!;
    towRequest.towAssignedAt = new Date(); // Set the assignment timestamp
    towRequest.towOperatorLocation = towOperatorLocation;
    if (towRequest.assignedBy.toString() === towRequest.assignedTo.toString()) {
      const towManagers = await userService.getTowManagersByTowCompanyId(loggedInUser.towCompanyId);
      // sendTowingAssignmentEmailToManager(
      //   assignedToUser.fullName!,
      //   assignedToUser,
      //   assignedToUser.email!,
      //   towRequest.location,
      //   towRequest.requestCreatedBy,
      //   loggedInUser,
      //   (await getSignedImagesForTowRequest(towRequest)).licensePlates,
      //   towRequest.id || towRequest._id
      // );

      towManagers.map(async (manager) => {
        sendTowingAssignmentEmailToManager(
          manager.fullName!,
          manager,
          manager.email!,
          towRequest.location,
          towRequest.requestCreatedBy,
          loggedInUser,
          (await getSignedImagesForTowRequest(towRequest)).licensePlates,
          towRequest.id || towRequest._id,
          towOperatorLocation
        );
      });
    } else {
      sendTowingNotificationToTowOperator(
        assignedToUser.fullName!,
        assignedToUser,
        assignedToUser.email!,
        towRequest.location,
        towRequest.requestCreatedBy,
        loggedInUser,
        (await getSignedImagesForTowRequest(towRequest)).licensePlates,
        towRequest.id || towRequest._id,
        towOperatorLocation
      );
    }

    towRequest.status = 'ASSIGNED';
    await towRequest.save();

    // Add assigned operator to chat room if not already a participant
    try {
      const chatRoom = await chatService.getTowRequestChatRoomById(towRequest._id.toString());
      if (chatRoom) {
        const bypassAdminCheck = true;
        await chatService.addParticipant(
          chatRoom._id.toString(),
          assignedToUser._id.toString(),
          assignedToUser._id.toString(),
          bypassAdminCheck
        );
        console.log(`Added assigned operator ${assignedToUser._id} to tow request ${towRequest._id} chat room`);
      } else {
        console.log(`Chat room not found for tow request ${towRequest._id}`);
      }
    } catch (error) {
      console.log('Could not add operator to chat room:', error);
    }

    emitToTowRequest(towRequest.id?.toString() || towRequest._id?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('updated', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      towRequest,
      type: 'updated',
    });

    emitToUser(assignedTo?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('requestAssigned', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      type: 'requestAssigned',
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
    });
    const towManagers = await userService.getTowManagersByTowCompanyId(loggedInUser.towCompanyId);
    pushSubscriptionService.sendToUsers(
      [assignedToUser._id?.toString()],
      '📌 Tow Assignment',
      `You've been assigned tow request ${towRequest.id?.toString() || towRequest._id?.toString()}`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );
    pushSubscriptionService.sendToUsers(
      towManagers.map((m) => m._id?.toString()),
      '📌 Tow Assignment Update',
      `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} assigned to ${assignedToUser.fullName}`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );

    // Send assignment event for notification count updates
    const affectedUsers = [assignedToUser._id.toString(), ...towManagers.map((m) => m._id.toString())];
    affectedUsers.forEach((userId) => {
      emitToUser(userId, 'towRequestAssigned', {
        towRequestId: towRequest._id.toString(),
        assignedTo: assignedToUser._id.toString(),
        previousAssignedTo: null, // No previous assignment
      });
    });

    // Schedule auto-rejection after 5 minutes if not accepted
    (async () => {
      const pulse = await getPulse();
      await pulse.start();
      await pulse.schedule(new Date(Date.now() + 5 * 60 * 1000), 'autoRejectTowRequest', {
        towRequestId: towRequest.id || towRequest._id,
      });
    })();

    // Send chat message for assignment
    await sendTowRequestChatMessage(
      towRequest._id.toString(),
      `📌 Tow request assigned to ${assignedToUser.fullName} by ${loggedInUser.fullName}`
    );
    return towRequest;
  } catch (e) {
    console.error(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

/**
 * Forcefully assign a tow request to an operator (bypasses acceptance, sets status to ACCEPTED)
 * @param {mongoose.Types.ObjectId} towId
 * @param {mongoose.Types.ObjectId} assignedTo
 * @param {ILocation} towOperatorLocation
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc>}
 */
export const forceAssignTowToOperator = async (
  towId: mongoose.Types.ObjectId,
  assignedTo: mongoose.Types.ObjectId,
  towOperatorLocation: ILocation,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  try {
    const assignedToUser = await User.findById(new mongoose.Types.ObjectId(assignedTo));

    // Only managers and owners can force assign
    if (loggedInUser.userType !== 'tow-company-manager' && loggedInUser.userType !== 'tow-company-owner' && loggedInUser.userType !== 'admin') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You are not authorized to force assign a tow');
    }
    if (!assignedToUser) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const towRequest = await TowRequest.findById(new mongoose.Types.ObjectId(towId)).populate('requestCreatedBy');
    if (towRequest?.assignedTo) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is already assigned');
    }
    if (!towRequest) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
    }

    // Assign the tow request
    towRequest.assignedTo = assignedToUser._id;
    towRequest.assignedToEmail = assignedToUser.email!;
    towRequest.assignedToName = assignedToUser.fullName!;
    towRequest.driverBadgeNumber = assignedToUser.driverBadgeNumber ?? '';

    towRequest.assignedBy = loggedInUser?.id || loggedInUser?._id;
    towRequest.assignedByEmail = loggedInUser.email!;
    towRequest.assignedByName = loggedInUser.fullName!;
    towRequest.towAssignedAt = new Date();
    towRequest.towOperatorLocation = towOperatorLocation;

    // Set status directly to ACCEPTED (force assignment)
    towRequest.status = 'ACCEPTED';
    await towRequest.save();

    // Get license plates for emails
    const licensePlates = (await getSignedImagesForTowRequest(towRequest)).licensePlates;

    // Send emails to all relevant parties
    // 1. Email to tow operator
    sendForceAssignmentEmailToTowOperator(
      assignedToUser.fullName!,
      assignedToUser,
      assignedToUser.email!,
      towRequest.location,
      towRequest.requestCreatedBy,
      loggedInUser,
      licensePlates,
      towRequest.id || towRequest._id,
      towOperatorLocation
    );

    // 2. Email to managers
    const towManagers = await userService.getTowManagersByTowCompanyId(loggedInUser.towCompanyId);
    towManagers.forEach(async (manager) => {
      sendForceAssignmentEmailToManager(
        manager.fullName!,
        manager,
        manager.email!,
        towRequest.location,
        towRequest.requestCreatedBy,
        loggedInUser,
        assignedToUser,
        licensePlates,
        towRequest.id || towRequest._id,
        towOperatorLocation
      );
    });

    // 3. Email to parking space provider (if exists)
    if (towRequest.requestCreatedBy && typeof towRequest.requestCreatedBy === 'object') {
      const pspUser = towRequest.requestCreatedBy as IUserDoc;
      if (pspUser.userType?.includes('parking-spaces-provider')) {
        sendForceAssignmentEmailToPSP(
          pspUser.fullName!,
          pspUser,
          pspUser.email!,
          towRequest.location,
          loggedInUser,
          assignedToUser,
          licensePlates,
          towRequest.id || towRequest._id,
          towOperatorLocation
        );
      }
    }

    // Add assigned operator to chat room if not already a participant
    try {
      const chatRoom = await chatService.getTowRequestChatRoomById(towRequest._id.toString());
      if (chatRoom) {
        const bypassAdminCheck = true;
        await chatService.addParticipant(
          chatRoom._id.toString(),
          assignedToUser._id.toString(),
          assignedToUser._id.toString(),
          bypassAdminCheck
        );
        console.log(`Added assigned operator ${assignedToUser._id} to tow request ${towRequest._id} chat room`);
      } else {
        console.log(`Chat room not found for tow request ${towRequest._id}`);
      }
    } catch (error) {
      console.log('Could not add operator to chat room:', error);
    }

    // Emit socket events
    emitToTowRequest(towRequest.id?.toString() || towRequest._id?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('updated', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      towRequest,
      type: 'updated',
    });

    emitToUser(assignedTo?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('requestAssigned', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      type: 'requestAssigned',
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
    });

    // Send push notifications
    pushSubscriptionService.sendToUsers(
      [assignedToUser._id?.toString()],
      '⚠️ Tow Request Forcefully Assigned',
      `A tow request ${towRequest.id?.toString() || towRequest._id?.toString()} has been forcefully assigned to you and is now in ACCEPTED status`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );
    pushSubscriptionService.sendToUsers(
      towManagers.map((m) => m._id?.toString()),
      '⚠️ Tow Request Forcefully Assigned',
      `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} forcefully assigned to ${assignedToUser.fullName} by ${loggedInUser.fullName}`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );

    // Send assignment event for notification count updates
    const affectedUsers = [assignedToUser._id.toString(), ...towManagers.map((m) => m._id.toString())];
    affectedUsers.forEach((userId) => {
      emitToUser(userId, 'towRequestAssigned', {
        towRequestId: towRequest._id.toString(),
        assignedTo: assignedToUser._id.toString(),
        previousAssignedTo: null,
        isForceAssignment: true,
      });
    });

    // Send chat message for force assignment
    await sendTowRequestChatMessage(
      towRequest._id.toString(),
      `⚠️ Tow request forcefully assigned to ${assignedToUser.fullName} by ${loggedInUser.fullName}. Status set to ACCEPTED.`
    );

    return towRequest;
  } catch (e) {
    console.error(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

export const updateTowRequestStatus = async (
  towId: mongoose.Types.ObjectId,
  status:
    | 'CANCELLED'
    | 'COMPLETED'
    | 'REJECTED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'PENDING_ASSIGNMENT'
    | 'PENDING_PSP_APPROVAL',
  loggedInUser?: IUserDoc,
  isAutomatic?: boolean
): Promise<ITowRequestDoc> => {
  try {
    const towRequest = await TowRequest.findById(towId).populate('requestCreatedBy');
    if (towRequest?.invoiceNumber === '') {
      towRequest.invoiceNumber = await getNextInvoiceNumber();
      await towRequest.save();
    }
    if (!towRequest) throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
    if (!isAutomatic) {
      if (status !== 'CANCELLED') {
        if (!towRequest.assignedTo) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is not assigned to any employee');
        }

        if (towRequest.assignedTo.toString() !== loggedInUser?.id?.toString()) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is not assigned to you');
        }
      }
    }

    if (['COMPLETED', 'CANCELLED'].includes(towRequest.status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Tow request is already marked as ${towRequest.status}`);
    }

    if (
      loggedInUser?.userType !== 'tow-company-owner' &&
      loggedInUser?.userType !== 'tow-company-manager' &&
      loggedInUser?.userType !== 'tow-company-employee' &&
      towRequest.status !== 'PENDING_ASSIGNMENT' &&
      towRequest.status !== 'PENDING_PSP_APPROVAL'
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is not pending assignment');
    }

    // Cancel auto-rejection job if operator accepts the request
    if (status === 'ACCEPTED') {
      await cancelAutoRejectionJob(towRequest._id.toString());

      // Trigger location tracking for the accepted tow request
      if (loggedInUser && towRequest.assignedTo) {
        // Emit socket event to start location tracking for the operator
        emitToUser(loggedInUser._id.toString(), 'startLocationTracking', {
          towRequestId: towRequest._id.toString(),
          operatorId: loggedInUser._id.toString(),
          message: 'Location tracking started for accepted tow request',
        });

        console.log(`Location tracking triggered for tow request ${towRequest._id} by operator ${loggedInUser.fullName}`);
      }
    }

    // Send chat message for status update
    const statusMessages = {
      ACCEPTED: `✅ Tow request accepted by ${loggedInUser?.fullName || 'operator'}`,
      IN_PROGRESS: `🚛 Tow request is now in progress`,
      COMPLETED: `✅ Tow request completed successfully`,
      CANCELLED: `❌ Tow request cancelled by ${loggedInUser?.fullName || 'system'}`,
      REJECTED: `❌ Tow request rejected by ${loggedInUser?.fullName || 'system'}`,
      PENDING_ASSIGNMENT: `⏳ Tow request is pending assignment`,
      PENDING_PSP_APPROVAL: `⏳ Tow request is pending PSP approval`,
    };

    const filter = { _id: towRequest._id };
    let recipients: { name: string; email: string; role: 'MANAGER' | 'OPERATOR' | 'REQUESTER' }[] = [];
    let recipientsIds: string[] = [];

    if (status === 'PENDING_PSP_APPROVAL') {
      // reset to pending assignment
      const towManagers = await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId);

      await TowRequest.updateOne(filter, {
        $set: { status: 'PENDING_ASSIGNMENT' },
        $unset: {
          assignedTo: 1,
          assignedToEmail: 1,
          assignedToName: 1,
          assignedBy: 1,
          assignedByEmail: 1,
          assignedByName: 1,
        },
      });
      userService.approveParkingSpacesProviderEmployee(towRequest.requestCreatedBy);
      recipients = towManagers.map((manager) => ({ name: manager.fullName!, email: manager.email!, role: 'MANAGER' }));
      recipientsIds.push(...towManagers.map((manager) => manager._id));
    } else if (status === 'REJECTED') {
      // reset to pending assignment
      await TowRequest.updateOne(filter, {
        $set: { status: 'PENDING_ASSIGNMENT' },
        $unset: {
          assignedTo: 1,
          assignedToEmail: 1,
          assignedToName: 1,
          assignedBy: 1,
          assignedByEmail: 1,
          assignedByName: 1,
        },
      });

      recipients = [{ name: towRequest.assignedByName!, email: towRequest.assignedByEmail!, role: 'MANAGER' }];
      recipientsIds.push(towRequest.assignedBy!);
    } else {
      // Set completedAt timestamp when status is COMPLETED
      const updateData: any = { status };
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
      await TowRequest.updateOne(filter, { $set: updateData });

      if (status === 'CANCELLED') {
        // cancelled goes only to assigner + requester
        recipientsIds.push(towRequest.requestCreatedBy?.id?.toString() || towRequest.requestCreatedBy?._id?.toString());

        recipients = [
          { name: towRequest.assignedByName!, email: towRequest.assignedByEmail!, role: 'MANAGER' },
          { name: towRequest.requesterName!, email: towRequest.requesterEmail!, role: 'REQUESTER' },
        ].filter(({ email }) => !!email) as any;
      } else {
        // normal flow: operator, requester, manager
        const recipientEmails = new Set(
          [towRequest.assignedToEmail!, towRequest.requesterEmail, towRequest.assignedByEmail!]?.filter((email) => !!email)
        );
        recipients = Array.from(recipientEmails).map((email) => ({
          name:
            email === towRequest?.assignedToEmail
              ? towRequest.assignedToName!
              : email === towRequest?.requesterEmail
              ? towRequest.requesterName!
              : towRequest?.assignedByName!,
          email,
          role:
            email === towRequest?.assignedToEmail
              ? 'OPERATOR'
              : email === towRequest?.requesterEmail
              ? 'REQUESTER'
              : 'MANAGER',
        }));
      }
    }

    // 🔹 Re-fetch updated request so return + emails have fresh state
    const updatedTowRequest = await TowRequest.findById(towRequest._id).lean();

    const populatedImages = await getSignedImagesForTowRequest(updatedTowRequest!);

    // 🔹 Generate PDF invoice if status is COMPLETED
    let pdfBuffer: Buffer | undefined;
      if (status === 'COMPLETED') {
        try {
          console.log('🔹 Generating invoice PDF for completed tow request:', updatedTowRequest?._id);
          // Get company user using shared helper (same logic as download controller)
          const companyUser = await getCompanyUserForInvoice(towRequest.towCompanyId);
          console.log('🔹 Got company user for invoice:', companyUser?.fullName || 'No user found');
          
          // Generate PDF using the same service function used for download
          pdfBuffer = await generateInvoicePDF(updatedTowRequest as ITowRequestDoc, companyUser);
          console.log('🔹 PDF generated successfully, buffer size:', pdfBuffer?.length || 0, 'bytes');
        } catch (pdfError) {
          console.error('❌ Error generating invoice PDF:', pdfError);
          // Continue without PDF if generation fails
        }

      // 🔹 Check if requester needs account setup link
      if (towRequest.requestCreatedBy && typeof towRequest.requestCreatedBy === 'object') {
        const requesterUser = towRequest.requestCreatedBy as IUserDoc;
        if (requesterUser.isDefaultPassword && requesterUser.userType === 'tow-requester') {
          try {
            // Create account setup token (expires only when used, not time-based)
            // Use a very long expiration (100 years) so it effectively doesn't expire until used
            let accountSetupToken: string;
            if (requesterUser.email && !requesterUser.email.startsWith('dummyemail')) {
              accountSetupToken = await tokenService.generateResetPasswordToken(
                requesterUser.email,
                100 * 365 * 24 * 60 // 100 years in minutes
              );
            } else if (requesterUser.phoneNumber && !isDummyPhoneNumber(requesterUser.phoneNumber)) {
              // Generate token with long expiration (100 years) - expires only when used
              const user = await userService.getUserByPhone(requesterUser.phoneNumber, requesterUser.userType);
              if (!user) {
                throw new Error('User not found for account setup');
              }
              const longExpires = moment().add(100 * 365 * 24 * 60, 'minutes');
              accountSetupToken = await tokenService.generateResetPasswordTokenByPhone(
                requesterUser.phoneNumber,
                requesterUser.userType
              );
              // Update expiration to be very long (100 years)
              await Token.findOneAndUpdate(
                { token: accountSetupToken },
                { expires: longExpires.toISOString() }
              );
            } else {
              throw new Error('No valid contact method for account setup');
            }

            const accountSetupLink = `${config.clientUrl}/auth/reset-password?token=${accountSetupToken}&isFirstLogin=true`;
            
            // Determine contact method: prefer email if available and not dummy, otherwise use phone
            const requesterEmail = requesterUser.email && !requesterUser.email.startsWith('dummyemail') 
              ? requesterUser.email 
              : null;
            const requesterPhone = requesterUser.phoneNumber && !isDummyPhoneNumber(requesterUser.phoneNumber)
              ? requesterUser.phoneNumber
              : null;

            if (requesterEmail) {
              // Send account setup link via email
              await sendAccountSetupLink(
                requesterEmail,
                accountSetupLink,
                requesterUser.fullName || requesterUser.firstName || 'User',
                requesterUser
              );
            } else if (requesterPhone) {
              // Send account setup link via SMS
              await smsService.sendAccountSetupLinkSMS(
                {
                  phoneNumber: requesterPhone,
                  link: accountSetupLink,
                  linkTitle: 'Complete Your Account Setup',
                  receiverName: requesterUser.fullName || requesterUser.firstName || 'User',
                  purpose: 'account-setup',
                },
                loggedInUser || requesterUser
              );
            }
          } catch (accountSetupError) {
            console.error('Error sending account setup link:', accountSetupError);
            // Continue without failing the entire completion process
          }
        }
      }
    }

    // 🔹 Log activity (audit trail)
    // 🔹 Send email notifications (filter out dummy emails and send SMS instead)
    Promise.all(
      recipients.map(async ({ name, email, role }) => {
        // Filter out dummy emails - if email is dummy, find phone number and send SMS instead
        if (email && email.startsWith('dummyemail')) {
          // Find the requester's phone number from the populated user
          let requesterPhone: string | null = null;
          if (role === 'REQUESTER' && towRequest.requestCreatedBy && typeof towRequest.requestCreatedBy === 'object') {
            const requesterUser = towRequest.requestCreatedBy as IUserDoc;
            requesterPhone = requesterUser.phoneNumber && !isDummyPhoneNumber(requesterUser.phoneNumber)
              ? requesterUser.phoneNumber
              : null;
          }
          if (requesterPhone) {
            // Send SMS instead of email for requester
            try {
              await smsService.sendTowRequestStatusUpdateSMS(
                {
                  phoneNumber: requesterPhone,
                  status: status === 'PENDING_PSP_APPROVAL' ? 'PENDING_ASSIGNMENT' : status,
                  towRequestId: updatedTowRequest?._id?.toString() || '',
                  receiverName: name,
                  location: updatedTowRequest?.location!,
                },
                loggedInUser?.fullName ? loggedInUser : ({ fullName: 'System' } as unknown as IUserDoc)
              );
            } catch (smsError) {
              console.error('Error sending SMS notification:', smsError);
            }
          }
          return; // Skip email for dummy addresses
        }

        // Send email for non-dummy addresses
        return towingRequestStatusUpdateEmailToLinkedUsers(
          name,
          status === 'PENDING_PSP_APPROVAL' ? 'PENDING_ASSIGNMENT' : status,
          updatedTowRequest?._id?.toString(),
          loggedInUser?.fullName ? loggedInUser : ({ fullName: 'System' } as unknown as IUserDoc),
          updatedTowRequest?.location!,
          populatedImages.licensePlates,
          role,
          email,
          pdfBuffer
        );
      })
    );

    const towRequestIdStr = updatedTowRequest?.id?.toString() || updatedTowRequest?._id?.toString();
    const statusSocketPayload = {
      updatedBy: loggedInUser?.id?.toString() || loggedInUser?._id?.toString(),
      id: towRequestIdStr,
      message: getNotificationMessage('statusUpdated', { id: towRequestIdStr }),
      status: updatedTowRequest?.status,
      towRequest: updatedTowRequest?.toObject ? updatedTowRequest.toObject() : updatedTowRequest,
      type: 'statusUpdated',
    };

    // Emit to tow request room so all subscribers get the update
    emitToTowRequest(towRequestIdStr, 'statusUpdated', statusSocketPayload);

    // Emit to all individual recipients
    const uniqueRecipientIds = Array.from(new Set(recipientsIds)).filter(id => id);
    uniqueRecipientIds.forEach((id) => {
      emitToUser(id?.toString(), 'tow-request-update', statusSocketPayload);
    });

    // Also emit to tow managers if not already in recipients
    if (updatedTowRequest?.towCompanyId) {
      const towManagers = await userService.getTowManagersByTowCompanyId(updatedTowRequest.towCompanyId);
      towManagers.forEach((manager: any) => {
        const managerId = manager.id?.toString() || manager._id?.toString();
        if (managerId && !uniqueRecipientIds.includes(managerId)) {
          emitToUser(managerId, 'tow-request-update', statusSocketPayload);
        }
      });
    }

    pushSubscriptionService.sendToUsers(
      uniqueRecipientIds.map((id) => id?.toString()),
      '🔄 Tow Request Status Update',
      `Tow request ${towRequestIdStr} is now ${updatedTowRequest?.status}`,
      `/tow-requests/${towRequestIdStr}`
    );

    if (statusMessages[status]) {
      await sendTowRequestChatMessage(towRequest._id.toString(), statusMessages[status]);
    }
    return updatedTowRequest as ITowRequestDoc;
  } catch (e) {
    console.error(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, String(e));
  }
};

/**
 * Update the status of a Tow Request
 * @param {mongoose.Types.ObjectId} towId
 * @param {'CANCELLED' | 'COMPLETED' | 'REJECTED' | 'ACCEPTED' | 'IN_PROGRESS'} status - Updated status enum
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc>}
 */
/**
 * Helper function to detect changed fields between original and updated data
 * @param {any} original - Original data
 * @param {any} updated - Updated data
 * @returns {any} Object containing only the changed fields
 */
const getChangedFields = (original: any, updated: any): any => {
  const changes: any = {};

  for (const key in updated) {
    if (updated.hasOwnProperty(key)) {
      const originalValue = original[key];
      const updatedValue = updated[key];

      // Handle different data types
      if (originalValue !== updatedValue) {
        // Handle null/undefined cases
        if ((originalValue == null && updatedValue != null) || (originalValue != null && updatedValue == null)) {
          changes[key] = {
            from: originalValue,
            to: updatedValue,
          };
        }
        // Handle objects (like charges)
        else if (typeof originalValue === 'object' && typeof updatedValue === 'object') {
          const objectChanges = getChangedFields(originalValue, updatedValue);
          if (Object.keys(objectChanges).length > 0) {
            changes[key] = objectChanges;
          }
        }
        // Handle arrays
        else if (Array.isArray(originalValue) && Array.isArray(updatedValue)) {
          if (JSON.stringify(originalValue) !== JSON.stringify(updatedValue)) {
            changes[key] = {
              from: originalValue,
              to: updatedValue,
            };
          }
        }
        // Handle primitive values
        else if (originalValue !== updatedValue) {
          changes[key] = {
            from: originalValue,
            to: updatedValue,
          };
        }
      }
    }
  }

  return changes;
};

/**
 * Helper function to format changed fields for chat message
 * @param {any} changes - Object containing changed fields
 * @returns {string} Formatted string of changes
 */
const formatChangedFields = (changes: any): string => {
  if (Object.keys(changes).length === 0) {
    return 'No changes detected';
  }

  const formattedChanges: string[] = [];

  // Field name mapping for better readability
  const fieldNameMap: { [key: string]: string } = {
    vin: 'VIN',
    vehicleYear: 'Vehicle Year',
    vehicleMake: 'Vehicle Make',
    vehicleModel: 'Vehicle Model',
    vehicleColor: 'Vehicle Color',
    vehicleType: 'Vehicle Type',
    driveType: 'Drive Type',
    odometer: 'Odometer',
    stockNumber: 'Stock Number',
    hasKeys: 'Has Keys',
    keysLocation: 'Keys Location',
    towType: 'Tow Type',
    driverBadgeNumber: 'Driver Badge Number',
    truckNumber: 'Truck Number',
    eta: 'ETA',
    impoundDate: 'Impound Date',
    inventoryDate: 'Inventory Date',
    vehicleSecuredDate: 'Vehicle Secured Date',
    accountNotes: 'Account Notes',
    impoundNotes: 'Impound Notes',
    gateCode: 'Gate Code',
    destination: 'Destination',
    charges: 'Charges',
    jurisdiction: 'Jurisdiction',
  };

  for (const [key, value] of Object.entries(changes)) {
    if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
      const { from, to } = value as { from: any; to: any };
      const fieldName = fieldNameMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

      // Format values for better readability
      const formatValue = (val: any): string => {
        if (val == null) return 'None';
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      };

      const fromFormatted = formatValue(from);
      const toFormatted = formatValue(to);

      if (from == null && to != null) {
        formattedChanges.push(`${fieldName}: Added "${toFormatted}"`);
      } else if (from != null && to == null) {
        formattedChanges.push(`${fieldName}: Removed "${fromFormatted}"`);
      } else {
        formattedChanges.push(`${fieldName}: "${fromFormatted}" → "${toFormatted}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects
      const nestedChanges = formatChangedFields(value);
      if (nestedChanges !== 'No changes detected') {
        const fieldName = fieldNameMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
        formattedChanges.push(`${fieldName}: ${nestedChanges}`);
      }
    }
  }

  return formattedChanges.join(', ');
};

export const updateTowRequest = async (
  towId: mongoose.Types.ObjectId,
  towRequestBody: ITowRequest,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  try {
    let updateBody = towRequestBody;
    // if (loggedInUser.userType === 'tow-company-employee') {
    //   updateBody = pick(updateBody, [
    //     'vin',
    //     'vehicleYear',
    //     'vehicleMake',
    //     'vehicleModel',
    //     'vehicleColor',
    //     'vehicleType',
    //     'driveType',
    //     'odometer',
    //     'stockNumber',
    //     'hasKeys',
    //     'keysLocation',
    //     'towType',
    //     'driverBadgeNumber',
    //     'truckNumber',
    //     'eta',
    //     'impoundDate',
    //     'inventoryDate',
    //     'vehicleSecuredDate',
    //     'accountNotes',
    //     'impoundNotes',
    //     'gateCode',
    //     'destination',
    //     'charges',
    //     'towType',
    //   ]);
    // } else {
    //   updateBody = pick(towRequestBody, [

    //     'charges',
    //     'towType',
    //     'jurisdiction',
    //     'driverBadgeNumber',
    //     'truckNumber',
    //     'eta', // ISO string
    //     'impoundDate',
    //     'inventoryDate',
    //     'vehicleSecuredDate',
    //     'accountNotes',
    //     'impoundNotes',
    //     'gateCode',
    //   ]);
    // }

    // Get original tow request before updating
    const originalTowRequest = await TowRequest.findById(towId).populate('requestCreatedBy');
    if (!originalTowRequest) throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');

    // Detect changed fields
    const changedFields = getChangedFields(originalTowRequest.toObject(), updateBody);
    const formattedChanges = formatChangedFields(changedFields);

    console.log('🔍 Tow request update detected changes:', {
      towRequestId: towId.toString(),
      changedFields,
      formattedChanges,
      updatedBy: loggedInUser.fullName,
    });

    // If no changes detected, return the original tow request without any updates
    if (formattedChanges === 'No changes detected') {
      console.log('ℹ️ No changes detected, returning original tow request without updates');
      return originalTowRequest as ITowRequestDoc;
    }

    // Recalculate subtotal if charges are being updated
    if (updateBody.charges) {
      updateBody.charges.subTotal = calculateChargesSubtotal(updateBody.charges);
    }

    const filter = { _id: originalTowRequest._id };

    console.dir(updateBody, { depth: null });
    console.log('updateBody');
    await TowRequest.updateOne(filter, updateBody);

    // Get updated tow request
    const towRequest = await TowRequest.findById(towId).populate('requestCreatedBy');
    if (!towRequest) throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');

    const recipients: { name: string; email: string; id: string }[] = [
      {
        name: towRequest.requesterName!,
        email: towRequest.requesterEmail!,
        id: towRequest.requestCreatedBy?.id?.toString() || towRequest.requestCreatedBy?._id?.toString(),
      },
      {
        name: towRequest.assignedToName!,
        email: towRequest.assignedToEmail!,
        id: towRequest.assignedTo,
      },
      {
        name: towRequest.assignedByName!,
        email: towRequest.assignedByEmail!,
        id: towRequest.assignedBy,
      },
      {
        name: towRequest.refererName!,
        email: towRequest.refererEmail!,
        id: towRequest.referer,
      },
    ].filter(({ email }) => email && email !== loggedInUser.email);

    //assigned to
    const populatedImages = await getSignedImagesForTowRequest(towRequest);

    // Send status update to all linked users
    recipients.forEach(({ name, email }) => {
      towingRequestUpdatesEmailToLinkedUsers(
        name,
        towRequest.id || towRequest._id,
        loggedInUser,
        towRequest.location,
        populatedImages.licensePlates,
        loggedInUser,
        email
      );
    });

    const towRequestIdStr = towRequest?.id?.toString() || towRequest?._id?.toString();
    const socketPayload = {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequestIdStr,
      message: getNotificationMessage('updated', { id: towRequestIdStr }),
      status: towRequest?.status,
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      type: 'updated',
      changedFields: formattedChanges,
    };

    // Emit to tow request room so all subscribers get the update
    emitToTowRequest(towRequestIdStr, 'tow-request-update', socketPayload);

    // Emit to all individual recipients
    recipients.forEach(({ id }) => {
      if (id) {
        emitToUser(id.toString(), 'tow-request-update', socketPayload);
      }
    });

    // Also emit to tow managers if they're not already in recipients
    if (towRequest.towCompanyId) {
      const towManagers = await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId);
      towManagers.forEach((manager: any) => {
        const managerId = manager.id?.toString() || manager._id?.toString();
        // Only emit if manager is not already a recipient
        if (managerId && !recipients.some(r => r.id?.toString() === managerId)) {
          emitToUser(managerId, 'tow-request-update', socketPayload);
        }
      });
    }

    pushSubscriptionService.sendToUsers(
      recipients.map((r) => r.id?.toString()),
      '✏️ Tow Request Updated',
      `Tow request ${towRequestIdStr} details were updated`,
      `/tow-requests/${towRequestIdStr}`
    );

    // Send chat message with only the changed fields
    const chatMessage = `✏️ Tow request updated by ${loggedInUser.fullName}. Changes: ${formattedChanges}`;
    await sendTowRequestChatMessage(towId.toString(), chatMessage);
    return towRequest;
  } catch (e) {
    console.error(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

/**
 * Update the status of a Tow Request
 * @param {mongoose.Types.ObjectId} towId
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc>}
 */
export const followUpTowRequest = async (
  towId: mongoose.Types.ObjectId,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  try {
    const towRequest = await TowRequest.findById(towId).populate('assignedTo');
    if (!towRequest) throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');

    if (
      towRequest.requestCreatedBy.toString() !== loggedInUser?.id?.toString() &&
      towRequest.requestCreatedBy.toString() !== loggedInUser?._id.toString()
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is not requested by you. You cannot follow up on it');
    }

    if (['COMPLETED', 'CANCELLED'].includes(towRequest.status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Tow request is already marked as ${towRequest.status}`);
    }

    const filter = { _id: towRequest._id };

    {
      const update = {
        $set: {
          reminders: [new Date().toISOString(), ...(towRequest?.reminders || [])],
        },
      };
      await TowRequest.updateOne(filter, update);
      const towManagers = await userService.getTowManagersByTowCompanyId(loggedInUser.towCompanyId);

      const populatedImages = await getSignedImagesForTowRequest(towRequest);
      // Send status update to all linked users
      towingRequestFollowUpEmailToLinkedUsers(
        towRequest.id || towRequest._id,
        towRequest.status,
        towManagers,
        towRequest.assignedTo,

        towRequest.location,
        populatedImages.licensePlates
      );
      const towRequestIdStr = towRequest?.id?.toString() || towRequest?._id?.toString();
      const followUpPayload = {
        updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
        id: towRequestIdStr,
        message: getNotificationMessage('updated', { id: towRequestIdStr }),
        status: towRequest?.status,
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
        type: 'followUp',
      };

      // Emit to tow request room
      emitToTowRequest(towRequestIdStr, 'tow-request-update', followUpPayload);

      // Emit to tow managers individually
      towManagers.forEach((manager: any) => {
        emitToUser(manager.id?.toString() || manager._id?.toString(), 'tow-request-update', followUpPayload);
      });

      // Emit to assigned operator if any
      if (towRequest.assignedTo) {
        const assignedToId = typeof towRequest.assignedTo === 'object' 
          ? (towRequest.assignedTo as any).id?.toString() || (towRequest.assignedTo as any)._id?.toString()
          : towRequest.assignedTo?.toString();
        if (assignedToId) {
          emitToUser(assignedToId, 'tow-request-update', followUpPayload);
        }
      }

      pushSubscriptionService.sendToUsers(
        towManagers.map((m) => m._id?.toString()),
        '⏰ Tow Request Follow-up',
        `Tow request ${towRequestIdStr} has a follow-up reminder`,
        `/tow-requests/${towRequestIdStr}`
      );
    }

    // Prepare recipients

    return towRequest;
  } catch (e) {
    console.error(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryTowRequests = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  const towRequests = await TowRequest.paginate(
    { ...filter, userType: filter['userType'] ?? { $ne: 'admin' }, isDeleted: { $ne: true } },
    {
      ...options,
    }
  );

  towRequests.results = await Promise.all(
    towRequests.results.map(async (towRequest) => {
      const populatedImages = await getSignedImagesForTowRequest(
        towRequest.toObject ? towRequest.toObject() : (towRequest as any)
      );
      towRequest.set('licensePlates', populatedImages.licensePlates);
      return towRequest;
    })
  );

  return {
    ...towRequests,
  };
};

/**
 * Get tow request by id with access control
 * @param {ObjectId} id
 * @param {IUserDoc} user
 * @returns {Promise<ITowRequestDoc>}
 */
export const getTowRequestById = async (id: mongoose.Types.ObjectId, user: IUserDoc): Promise<ITowRequestDoc> => {
  const towRequest = await TowRequest.findById(new mongoose.Types.ObjectId(id));
  if (!towRequest) {
    throw new ApiError(httpStatus.NO_CONTENT, 'The towRequest is not found.');
  }

  // Access control based on user type
  let hasAccess = false;

  // Admin can access any tow request
  if (user.userType === 'admin') {
    hasAccess = true;
  } else if (user.userType === 'tow-company-employee' && user.isTowOperator) {
    // Tow operators can see requests assigned to them
    hasAccess = towRequest.assignedTo?.toString() === user.id?.toString();
  } else if (user.userType === 'tow-company-manager' || user.userType === 'tow-company-employee') {
    // Tow managers and employees can see requests from their tow company
    hasAccess = towRequest.towCompanyId?.toString() === user.towCompanyId?.toString();
  } else if (user.userType === 'tow-company-owner') {
    // Tow owners can see requests from their company
    hasAccess = towRequest.towCompanyId?.toString() === user.id?.toString();
  } else if (user.userType === 'parking-spaces-provider-employee') {
    // Parking space employees can see requests they created
    hasAccess = towRequest.requestCreatedBy?.toString() === user.id?.toString();
  } else if (user.userType === 'parking-spaces-provider-manager' || user.userType === 'parking-spaces-provider-owner') {
    // For PSP owners, use their own ID as pspCompanyId
    // For PSP managers, use their pspCompanyId field
    const pspCompanyId = user.userType === 'parking-spaces-provider-owner' ? user.id : user.pspCompanyId;

    // Parking space managers and owners can see requests from their PSP company and requests they created
    hasAccess =
      towRequest.pspCompanyId?.toString() === pspCompanyId?.toString() ||
      towRequest.requestCreatedBy?.toString() === user.id?.toString();
  } else if (user.userType === 'tow-requester') {
    // Tow requesters can only see requests they created
    // Check both id and _id for user ID comparison
    const userId = user.id?.toString() || user._id?.toString();
    const createdById = towRequest.requestCreatedBy?.toString();
    
    hasAccess = createdById === userId;
  }

  if (!hasAccess) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to access this tow request.');
  }

  const populatedImages = await getSignedImagesForTowRequest(
    towRequest.toObject ? towRequest.toObject() : (towRequest as any)
  );
  towRequest.set('licensePlates', populatedImages.licensePlates);
  return towRequest;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<ITowRequestDoc>}
 */
export const getTowRequestEmail = async (email: string): Promise<ITowRequestDoc | null> => {
  const user = await TowRequest.findOne({ email });

  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} id
 * @returns {Promise<void>}
 */
export const deleteTowRequestById = async (id: mongoose.Types.ObjectId): Promise<void> => {
  const towRequest = await TowRequest.findById(id);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }

  // Get all relevant users for notifications
  const recipients: string[] = [];

  // Add requester
  if (towRequest.requestCreatedBy) {
    recipients.push(towRequest.requestCreatedBy.toString());
  }

  // Add assigned user
  if (towRequest.assignedTo) {
    recipients.push(towRequest.assignedTo.toString());
  }

  // Add assigned by user
  if (towRequest.assignedBy) {
    recipients.push(towRequest.assignedBy.toString());
  }

  // Add referer
  if (towRequest.referer) {
    recipients.push(towRequest.referer.toString());
  }

  // Get tow managers for notifications
  const towManagers = await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId);
  const managerIds = towManagers.map((manager) => manager._id.toString());
  recipients.push(...managerIds);

  // Remove duplicates
  const uniqueRecipients = [...new Set(recipients)];

  // Send socket notification
  emitToTowRequest(towRequest.id?.toString() || towRequest._id?.toString(), 'tow-request-update', {
    id: towRequest.id?.toString() || towRequest._id?.toString(),
    message: getNotificationMessage('deleted', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
    status: 'DELETED',
    type: 'deleted',
  });

  // Send individual socket notifications to all relevant users
  uniqueRecipients.forEach((userId) => {
    emitToUser(userId?.toString(), 'tow-request-update', {
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('deleted', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: 'DELETED',
      type: 'deleted',
    });
  });

  // Send chat message for deletion
  await sendTowRequestChatMessage(towRequest._id.toString(), `🗑️ Tow request has been deleted by the system`);

  // Send push notifications
  pushSubscriptionService.sendToUsers(
    uniqueRecipients.map((id) => id?.toString()),
    '🗑️ Tow Request Deleted',
    `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} has been deleted`,
    '/tow-requests'
  );

  // Delete the tow request
  await TowRequest.findByIdAndDelete(id);
};

export const getTowRequestStatusCounts = async (loggedInUser: IUserDoc) => {
  const filter: any = {};

  // Admin can see all tow requests
  if (loggedInUser.userType === 'admin') {
    // No filter - get all tow requests
  }
  // Tow company owner can see requests assigned to their company
  else if (loggedInUser.userType === 'tow-company-owner') {
    filter.towCompanyId = loggedInUser.id;
  }
  // Tow company manager can see requests assigned to their company
  else if (loggedInUser.userType === 'tow-company-manager') {
    filter.towCompanyId = loggedInUser.towCompanyId;
  }
  // Tow company employee can see requests assigned to them
  else if (loggedInUser.userType === 'tow-company-employee') {
    filter.assignedTo = loggedInUser.id;
  }
  // Parking space provider owner can see requests for their company
  else if (loggedInUser.userType === 'parking-spaces-provider-owner') {
    filter.pspCompanyId = loggedInUser.id;
  }
  // Parking space provider manager can see requests for their company
  else if (loggedInUser.userType === 'parking-spaces-provider-manager') {
    filter.pspCompanyId = loggedInUser.pspCompanyId;
  }
  // Parking space provider employee can see requests for their company
  else if (loggedInUser.userType === 'parking-spaces-provider-employee') {
    filter.pspCompanyId = loggedInUser.pspCompanyId;
  }
  // Apartment complex owner can see requests from their complexes
  else if (loggedInUser.userType === 'apartment-complex-owner') {
    // Get apartment complexes owned by this user
    const apartmentComplexes = await apartmentComplexService.getMyApartmentComplexes(loggedInUser.id);
    if (apartmentComplexes.length > 0) {
      // This would need to be implemented based on how tow requests are linked to apartment complexes
      // For now, we'll use a placeholder - this might need to be adjusted based on your data model
      filter.apartmentComplex = { $in: apartmentComplexes.map((ac) => ac._id) };
    }
  }
  // Apartment complex manager can see requests from their complex
  else if (loggedInUser.userType === 'apartment-complex-manager') {
    filter.apartmentComplex = loggedInUser.apartmentComplex;
  }
  // Apartment complex employee can see requests from their complex
  else if (loggedInUser.userType === 'apartment-complex-employee') {
    filter.apartmentComplex = loggedInUser.apartmentComplex;
  }
  // Renter can see requests they created
  else if (loggedInUser.userType === 'renter') {
    filter.requestCreatedBy = loggedInUser.id;
  }

  const result = await TowRequest.aggregate([
    {
      $match: filter,
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1,
      },
    },
  ]);

  // Updated to include new statuses
  const allStatuses: ITowRequest['status'][] = [
    'PENDING_ASSIGNMENT',
    'PENDING_PSP_APPROVAL',
    'ASSIGNED',
    'ACCEPTED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ];

  const counts = allStatuses.reduce((acc, status) => {
    const found = result.find((r) => r.status === status);
    return { ...acc, [status]: found ? found.count : 0 };
  }, {} as Record<string, number>);

  const total = result.reduce((sum, { count }) => sum + count, 0);

  // Calculate meaningful counts for notifications
  const pendingCount = (counts['PENDING_ASSIGNMENT'] || 0) + (counts['PENDING_PSP_APPROVAL'] || 0);
  const urgentCount = (counts['ASSIGNED'] || 0) + (counts['ACCEPTED'] || 0);
  const inProgressCount = counts['IN_PROGRESS'] || 0;

  // Determine what count to show based on user role and priority
  let notificationCount = 0;

  if (loggedInUser.userType === 'admin') {
    // Admin sees all pending requests
    notificationCount = pendingCount + urgentCount;
  } else if (loggedInUser.userType.includes('tow-company')) {
    // Tow company users see assigned/accepted requests (their responsibility)
    notificationCount = urgentCount + inProgressCount;
  } else if (loggedInUser.userType.includes('parking-spaces-provider')) {
    // PSP users see requests pending their approval
    notificationCount = counts['PENDING_PSP_APPROVAL'] || 0;
  } else if (loggedInUser.userType.includes('apartment-complex')) {
    // Apartment complex users see requests from their complexes
    notificationCount = pendingCount;
  } else if (loggedInUser.userType === 'renter') {
    // Renters see their pending requests
    notificationCount = pendingCount + urgentCount;
  }

  return {
    ...counts,
    total,
    pendingCount,
    urgentCount,
    inProgressCount,
    notificationCount, // This is what will be shown in the menu
  };
};
/**
 * Count tow requests for a company/user within the current billing period
 * @param {IUserDoc} loggedInUser - The logged in user
 * @param {Date} periodStart - Start of billing period
 * @param {Date} periodEnd - End of billing period
 * @returns {Promise<number>} Count of tow requests
 */
export const countTowRequestsInBillingPeriod = async (
  loggedInUser: IUserDoc,
  periodStart: Date,
  periodEnd: Date
): Promise<number> => {
  const filter: any = {
    createdAt: {
      $gte: periodStart,
      $lte: periodEnd,
    },
  };

  // Determine company ID based on user type
  if (loggedInUser.userType === 'tow-company-owner') {
    filter.towCompanyId = loggedInUser.id || loggedInUser._id;
  } else if (loggedInUser.userType === 'tow-company-manager' || loggedInUser.userType === 'tow-company-employee') {
    filter.towCompanyId = loggedInUser.towCompanyId;
  } else if (loggedInUser.userType.includes('parking-spaces-provider')) {
    // PSP users are associated with a tow company
    // The tow company has the subscription, so we count all tow requests for that tow company
    // All PSPs under the same tow company share the subscription limit
    if (loggedInUser.towCompanyId) {
      filter.towCompanyId = loggedInUser.towCompanyId;
    }
  } else {
    // For other user types, count by requestCreatedBy
    filter.requestCreatedBy = loggedInUser.id || loggedInUser._id;
  }

  return TowRequest.countDocuments(filter);
};

export const getSignedImagesForTowRequest = async (towRequest: ITowRequestDoc) => {
  const newLicensePlates = await Promise.all(
    towRequest.licensePlates.map(async (licensePlate) => {
      const completeImage = await getFileFromS3(licensePlate.completeImage);
      const croppedImage = await getFileFromS3(licensePlate.croppedImage);
      return { plateText: licensePlate.plateText, croppedImage, completeImage };
    })
  );

  return { ...towRequest, licensePlates: newLicensePlates };
};

export const getNextInvoiceNumber = async () => {
  const lastInvoiceNumber = await TowRequest.findOne().sort('-invoiceNumber').select('invoiceNumber').lean();
  const lastNumber = lastInvoiceNumber?.invoiceNumber ? parseInt(lastInvoiceNumber.invoiceNumber.slice(4), 10) : 0;
  const nextNumber = (lastNumber + 1).toString().padStart(6, '0');
  return `INV_${nextNumber}`;
};

/**
 * Get recent license plates from tow requests created by the logged-in user
 * Returns unique plates with their images, most recent first
 */
export const getRecentLicensePlates = async (loggedInUser: IUserDoc, limit: number = 10) => {
  // Build filter based on user type - get tow requests created by this user
  const filter: any = {
    requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id),
  };

  // Find recent tow requests created by this user, sorted by creation date descending
  const towRequests = await TowRequest.find(filter)
    .select('licensePlates createdAt vehicleMake vehicleModel vehicleColor')
    .sort({ createdAt: -1 })
    .limit(50) // Get more than we need to allow for deduplication
    .lean();

  // Extract unique license plates (by plateText) with their images
  const seenPlates = new Set<string>();
  const recentPlates: Array<{
    plateText: string;
    croppedImage: string; // unsigned S3 key
    completeImage: string; // unsigned S3 key
    signedCroppedImage?: string;
    signedCompleteImage?: string;
    vehicleInfo?: string;
    createdAt?: string;
  }> = [];

  for (const towRequest of towRequests) {
    if (recentPlates.length >= limit) break;

    for (const plate of towRequest.licensePlates) {
      if (seenPlates.has(plate.plateText)) continue;
      if (recentPlates.length >= limit) break;

      seenPlates.add(plate.plateText);

      // Generate signed URLs for display
      let signedCroppedImage: string | undefined;
      let signedCompleteImage: string | undefined;

      try {
        if (plate.croppedImage) {
          signedCroppedImage = await getFileFromS3(plate.croppedImage);
        }
        if (plate.completeImage) {
          signedCompleteImage = await getFileFromS3(plate.completeImage);
        }
      } catch (error) {
        console.error('Error generating signed URLs for recent plate:', error);
      }

      // Build vehicle info string
      const vehicleInfo = [towRequest.vehicleMake, towRequest.vehicleModel, towRequest.vehicleColor]
        .filter(Boolean)
        .join(' ');

      recentPlates.push({
        plateText: plate.plateText,
        croppedImage: plate.croppedImage, // Keep unsigned key for storage
        completeImage: plate.completeImage, // Keep unsigned key for storage
        ...(signedCroppedImage && { signedCroppedImage }),
        ...(signedCompleteImage && { signedCompleteImage }),
        ...(vehicleInfo && { vehicleInfo }),
        ...(towRequest.createdAt && { createdAt: towRequest.createdAt.toString() }),
      });
    }
  }

  return recentPlates;
};

export const checkIfTowRequestExists = async (licensePlate: string) => {
  const towRequest = await TowRequest.findOne({
    'licensePlates.plateText': licensePlate,
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  });
  if (towRequest?.id) {
    throw new ApiError(httpStatus.CONFLICT, 'We already have a Tow Request exists for the same license plate');
  }
};

export const createOneTimeLink = async (
  contactInfo: { email?: string; phoneNumber?: string },
  loggedInUser: IUserDoc,
  otherInfo: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    companyName?: string;
    userType: string;
    pspCompanyId?: string;
    email?: string;
  },
  passkey?: string,
  contactMethod: 'email' | 'phone' = 'email'
) => {
  let { email, phoneNumber } = contactInfo;

  // Require at least one contact method
  if (!email && !phoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Either email or phone number is required');
  }

  // If only email, generate a unique dummy phone
  if (email && !phoneNumber) {
    phoneNumber = await generateUniqueDummyPhone();
  }

  // If only phone, use dummy email
  if (phoneNumber && !email) {
    email = getDummyEmail(phoneNumber);
  }

  // Now both are guaranteed to be set
  email = email!;
  phoneNumber = phoneNumber!;

  // Update otherInfo with the generated/validated email and phone number
  // (Frontend may send undefined for phone when only email is provided, 
  // and backend generates a unique dummy phone)
  otherInfo.email = email;
  otherInfo.phoneNumber = phoneNumber;

  // Check for existing user by email or phone number (skip dummy values)
  const checkIfUserExistsByEmail = email && !email.startsWith('dummyemail') 
    ? await userService.getUserByEmail(email) 
    : null;
  const checkIfUserExistsByPhone = phoneNumber && !isDummyPhoneNumber(phoneNumber)
    ? await userService.getUserByPhone(phoneNumber)
    : null;

  // If user exists by either email or phone, use that user
  const checkIfUserExists = checkIfUserExistsByEmail || checkIfUserExistsByPhone;

  // if (checkIfUserExistsByEmail?._id || checkIfUserExistsByPhone?._id) {
  //   throw new ApiError(
  //     httpStatus.CONFLICT,
  //     'A user with this email or phone number already exists. Please use a different email or phone number.'
  //   );
  // }
  // If user exists by both email and phone but they're different users, that's an error
  // Only check if both are non-dummy values
  if (
    checkIfUserExistsByEmail && 
    checkIfUserExistsByPhone &&
    checkIfUserExistsByEmail?._id?.toString() !== checkIfUserExistsByPhone?._id?.toString()
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Email and phone number belong to different users. Please use consistent contact information.'
    );
  }

    if (!checkIfUserExists) {
    if (!otherInfo.firstName || !otherInfo.lastName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'First Name and Last Name are required');
    }
    // Email and phone are now guaranteed to be set (with dummy values if needed)
    if (otherInfo.userType === 'parking-spaces-provider-owner' && !otherInfo.companyName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Company name is required for parking spaces owner');
    }
    if (otherInfo.userType === 'parking-spaces-provider-employee' && !otherInfo.pspCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'An employee must be attached to a parking spaces company');
    }
    // Tow-requester doesn't need company name

    // Additional validation: Check if email or phone number already exists in the system
    // (This is a double-check since we already checked above, but ensures data integrity)
    // Skip validation for dummy values
    if (otherInfo.email && !otherInfo.email.startsWith('dummyemail')) {
      const existingEmailUser = await userService.getUserByEmail(otherInfo.email);
      if (existingEmailUser) {
        throw new ApiError(httpStatus.CONFLICT, `A user with email ${otherInfo.email} already exists`);
      }
    }
    if (otherInfo.phoneNumber && !isDummyPhoneNumber(otherInfo.phoneNumber)) {
      const existingPhoneUser = await userService.getUserByPhone(otherInfo.phoneNumber);
      if (existingPhoneUser) {
        throw new ApiError(httpStatus.CONFLICT, `A user with phone number ${otherInfo.phoneNumber} already exists`);
      }
    }
  }

  const towCompanyId: string =
    loggedInUser?.userType === 'tow-company-owner' ? loggedInUser?.id || loggedInUser?._id : loggedInUser.towCompanyId;

  // Validate passkey if provided and user exists
  if (checkIfUserExists && checkIfUserExists.userType === 'parking-spaces-provider-owner') {
    try {
      const requiresPasskey = await passkeyService.checkPasskeyRequirement(
        checkIfUserExists.id || checkIfUserExists._id,
        towCompanyId
      );

      if (requiresPasskey) {
        if (!passkey) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Passkey is required for this PSP');
        }

        const isValidPasskey = await passkeyService.validatePasskey({
          pspId: checkIfUserExists.id || checkIfUserExists._id,
          towCompanyId,
          passkey,
        });

        if (!isValidPasskey) {
          throw new ApiError(httpStatus.FORBIDDEN, 'Incorrect passkey');
        }
      }
    } catch (error) {
      console.error('Error validating passkey:', error);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error validating passkey');
    }
  }

  const companyName =
    loggedInUser?.userType === 'tow-company-owner'
      ? loggedInUser.towCompany?.companyName
      : await userService.getTowCompanyNameById(loggedInUser.towCompanyId);

  // Create token with both email and phone number, including inviter details
  const inviterName = loggedInUser?.fullName || loggedInUser?.firstName + ' ' + loggedInUser?.lastName;
  const token = await tokenService.inviteUser(
    email,
    towCompanyId,
    loggedInUser?.id || loggedInUser?._id,
    otherInfo,
    phoneNumber,
    contactMethod,
    {
      ...(inviterName && { inviterName }),
      ...(companyName && { towCompanyName: companyName }),
    }
  );
  if (checkIfUserExists && checkIfUserExists?.userType !== 'tow-requester' && checkIfUserExists?.towCompanyId.toString() !== towCompanyId.toString()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You are not allowed to invite this user to your company');
  }
  // 🚨 New cross-company transfer check
  // this functionality has been disabled for now
  // if (
  //   checkIfUserExists &&
  //   loggedInUser.towCompanyId.toString() !== checkIfUserExists.towCompanyId.toString() &&
  //   checkIfUserExists?.userType === 'parking-spaces-provider-owner'
  // ) {
  //   const towManagers = await userService.getTowManagersByTowCompanyId(checkIfUserExists.towCompanyId);
  //   // Send notifications
  //   emailService.notifyActorOnCrossCompanyTransfer(loggedInUser, checkIfUserExists, towManagers);
  //   emailService.notifyManagersOnCrossCompanyTransfer(towManagers, checkIfUserExists, loggedInUser, token.token);
  //   emailService.notifyUserOnCrossCompanyTransfer(checkIfUserExists, loggedInUser, token.token);

  //   // Send socket events for cross-company transfer
  //   emitToUser(checkIfUserExists._id || checkIfUserExists.id, 'tow-request-update', {
  //     updatedBy: loggedInUser.id,
  //     id: token.token,
  //     message: getNotificationMessage('pending', { actor: loggedInUser.fullName, targetUser: checkIfUserExists.fullName }),
  //     status: 'PENDING',
  //     type: 'pending',
  //     towRequest: null, // No tow request for transfers
  //     data: {
  //       token: token.token,
  //       actor: loggedInUser.fullName,
  //       targetUser: checkIfUserExists.fullName,
  //     },
  //   });

  //   // Notify managers
  //   towManagers.forEach((manager) => {
  //     emitToUser(manager._id || manager.id, 'tow-request-update', {
  //       updatedBy: loggedInUser.id,
  //       id: token.token,
  //       message: getNotificationMessage('pending', { actor: loggedInUser.fullName, targetUser: checkIfUserExists.fullName }),
  //       status: 'PENDING',
  //       type: 'pending',
  //       towRequest: null, // No tow request for transfers
  //       data: {
  //         token: token.token,
  //         actor: loggedInUser.fullName,
  //         targetUser: checkIfUserExists.fullName,
  //       },
  //     });
  //   });
  //   await pushSubscriptionService.sendToUsers(
  //     towManagers.map((m) => m._id || m.id),
  //     '🔄 Cross-company Transfer Pending',
  //     `${checkIfUserExists.fullName} requires transfer approval`,
  //     `/tow-invite/${token.token}`
  //   );

  //   await pushSubscriptionService.sendToUsers(
  //     [checkIfUserExists._id || checkIfUserExists.id],
  //     '🔄 Cross-company Transfer Pending',
  //     `${loggedInUser.fullName} wants to transfer you to their company`,
  //     `/tow-invite/${token.token}`
  //   );
  //   // 🕒 Auto-approve after 5 minutes if not rejected
  //   const autoApprovalTime = new Date(new Date().getTime() + 5 * 60 * 1000);
  //   const pulse = getPulse();

  //   (async () => {
  //     await pulse.start();
  //     try {
  //       await pulse.schedule(autoApprovalTime, 'autoApproveCrossCompanyTransfer', {
  //         actorId: loggedInUser?.id || loggedInUser?._id,
  //         targetUserId: checkIfUserExists.id,
  //         fromCompanyId: checkIfUserExists.towCompanyId.toString(),
  //         toCompanyId: loggedInUser.towCompanyId.toString(),
  //         token: token.token,
  //       });
  //     } catch (e) {
  //       console.log(e, 'erro ris here');
  //     }
  //   })();

  //   return token.token; // return early
  // } else {
  // ✅ Normal flow if same company or new user
  // Send notification based on selected contact method
  const inviteLink = `${config.clientUrl}/tow-invite/${token.token}`;

  // Only send via the specified method if the contact info is not dummy
  if (contactMethod === 'email' && email && !email.startsWith('dummyemail')) {
    // Send email notification only
    emailService.sendTowRequestInvite(token.token, email, loggedInUser, companyName!);
  } else if (contactMethod === 'phone' && phoneNumber && !isDummyPhoneNumber(phoneNumber)) {
    // Send SMS notification only
    await smsService.sendOneTimeLinkSMS(
      {
        phoneNumber: phoneNumber,
        link: inviteLink,
        linkTitle: 'Tow Request Invitation',
        ...(checkIfUserExists?.fullName
          ? { receiverName: checkIfUserExists?.fullName }
          : otherInfo?.firstName && { receiverName: `${otherInfo.firstName} ${otherInfo.lastName}` }),
        expirationTime: token.expires,
        purpose: 'tow-invite',
      },
      loggedInUser
    );
  } else {
    // If dummy values are used, we can't send the notification
    // This shouldn't happen if the frontend validates properly, but handle gracefully
    console.warn(`Cannot send ${contactMethod} notification: dummy value detected`);
  }

  // Send push notification and socket event to existing user if they have subscribed
  if (checkIfUserExists) {
    // Send socket event
    emitToUser(checkIfUserExists._id?.toString() || checkIfUserExists.id?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: token.token,
      message: getNotificationMessage('invitationReceived', { inviter: loggedInUser.fullName }),
      status: 'INVITED',
      type: 'invitationReceived',
      towRequest: null, // No tow request for invitations
      token: token.token, // Send token at root level for frontend
      buttonText: 'View Invitation',
      link: `/tow-invite/${token.token}`,
      data: {
        token: token.token,
        inviter: loggedInUser.fullName,
        companyName: companyName,
      },
    });

    await pushSubscriptionService.sendToUsers(
      [checkIfUserExists._id?.toString() || checkIfUserExists.id?.toString()],
      '📧 New Invitation',
      `${loggedInUser.fullName} has invited you to create tow requests`,
      `/tow-invite/${token.token}`
    );
  }
  // }

  // Note: Push notifications for existing users are now handled in the normal flow above
  // and cross-company transfer notifications are handled in the cross-company transfer block above

  const expiryReminderTime = new Date(new Date(token.expires).getTime() + 1 * 60 * 1000);
  const inviteeReminder = new Date(new Date(token.expires).getTime() - 15 * 60 * 1000);
  const pulse = getPulse();

  (async () => {
    await pulse.start(); // start processing jobs
    await pulse.schedule(expiryReminderTime, 'sendTokenExpiryNotificationToManager', { token: token.token });
    await pulse.schedule(inviteeReminder, 'sendTokenExpiryNotificationToInvitee', { token: token.token });
  })();

  return token.token;
};

/**
 * Validate that a referer is a legitimate tow company owner or manager
 * @param {string} refererId - The ID of the referer to validate
 * @returns {Promise<{ isValid: boolean; referer?: IUserDoc }>}
 */
export const validateReferer = async (refererId: string): Promise<{ isValid: boolean; referer?: IUserDoc }> => {
  if (!refererId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Referer ID is required');
  }

  try {
    const referer = await userService.getUserById(new mongoose.Types.ObjectId(refererId));
    
    if (!referer) {
      return { isValid: false };
    }

    // Check if referer is a tow company owner or manager
    const isValid = referer.userType === 'tow-company-owner' || referer.userType === 'tow-company-manager';
    
    return { isValid, referer };
  } catch (error) {
    console.error('Error validating referer:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error validating referer');
  }
};

export const handleOneTimeLink = async (token: string) => {
  const tokenDoc = await tokenService.fetchAndInvalidateInviteUserToken(token!);

  if (!tokenDoc) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired link');
  }

  const email = tokenDoc.additionalInfo?.email;
  const phoneNumber = tokenDoc.additionalInfo?.phoneNumber;
  const referer = await userService.getUserById(new mongoose.Types.ObjectId(tokenDoc.additionalInfo?.userId));
  
  // Validate referer is a legitimate tow company owner or manager
  if (!referer) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Referer not found');
  }
  
  // Validate that both email and phone number are present in token
  if (!email || !phoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Both email and phone number are required in token');
  }

  // Look up user by both email and phone number for consistency
  const userByEmail = await userService.getUserByEmail(email);
  const userByPhone = await userService.getUserByPhone(phoneNumber);

  // If user exists by both email and phone, they should be the same user
  if (userByEmail && userByPhone && userByEmail._id?.toString() !== userByPhone._id?.toString()) {
    throw new ApiError(httpStatus.CONFLICT, 'Email and phone number belong to different users. Please contact support.');
  }

  // Use whichever user exists (they should be the same if both exist)
  const user = userByEmail || userByPhone;

  // Build redirect link with referer parameter for tow-requester users or when user type is tow-requester
  const userType = user?.userType || tokenDoc.additionalInfo?.userType;
  const refererId = referer?.id || referer?._id;
  let towLink = `${config.clientUrl}/tow-requests/new`;
  
  // Add referer parameter for tow-requester users or when creating a new tow-requester
  if (userType === 'tow-requester' && refererId) {
    towLink = `${towLink}?referer=${refererId}`;
  }

  if (user) {
    // if (
    //   referer?.towCompanyId?.toString() !== user.towCompanyId?.toString() &&
    //   user.userType === 'parking-spaces-provider-employee'
    // ) {
    //   towLink = towLink + `?referer=${referer?.id}`;
    // }
    // if (
    //   referer?.towCompanyId?.toString() !== user.towCompanyId?.toString() &&
    //   user.userType === 'parking-spaces-provider-owner'
    // ) {
    //   user.towCompanyId === referer?.towCompanyId;
    //   postTransferPSPAccount(user, referer!);
    // }

    // Determine contact method from token or based on dummy values
    const storedContactMethod = tokenDoc.additionalInfo?.contactMethod as 'email' | 'phone' | undefined;
    const contactMethod: 'email' | 'phone' = storedContactMethod || 
      (email && !email.startsWith('dummyemail') ? 'email' : 'phone');
    const contactInfo = contactMethod === 'email' ? email : phoneNumber;
    
    await pushSubscriptionService.sendToUsers(
      [referer?._id],
      '✅ Invite Accepted',
      `${contactInfo} accepted your invitation and can now create tow requests`,
      `/tow-requests/new`
    );
    user.isVerified = true;
    await user.save();
    const tokens = await tokenService.generateAuthTokens(user!);
    // ✅ User exists → redirect
    sendInviteStatusEmailToManager(referer!, contactInfo!, 'accepted', undefined, contactMethod);
    // if (user.userType !== 'parking-spaces-provider-owner') {
    //   towingRequestInviteAcceptedEmailToPSP(user!);
    // }
    return { tokens, redirectLink: towLink, user };
  } else {
    const towCompanyId = tokenDoc.additionalInfo?.towCompanyId;
    if (towCompanyId && referer?.id) {
      await userService.createUserWithType(
        {
          userType: tokenDoc.additionalInfo.userType,
          firstName: tokenDoc.additionalInfo.firstName,
          lastName: tokenDoc.additionalInfo.lastName,
          email: email || '', // Use email if available, empty string if not
          phoneNumber: phoneNumber || tokenDoc.additionalInfo.phoneNumber,
          towCompanyId: towCompanyId,
          isPaidParkingSpaceProvider: false,

          isVerified: true,
          isDefaultPassword: true,
          accountApproval: {
            //is approved = true because of entering a passkey
            isApproved: true,
          },
          ...(tokenDoc.additionalInfo.userType === 'parking-spaces-provider-owner'
            ? {
                companyName: tokenDoc.additionalInfo.companyName,
              }
            : tokenDoc.additionalInfo.userType === 'tow-requester'
            ? {}
            : {
                pspCompanyId: tokenDoc.additionalInfo.pspCompanyId,
              }),
          passkey: tokenDoc.additionalInfo.passkey ?? '',
        },
        referer!,
        referer.id,
        true
      );

      // Look up the newly created user by email (should be consistent)
      const user = await userService.getUserByEmail(email);
      const tokens = await tokenService.generateAuthTokens(user!);

      // Determine contact method from token or based on dummy values
      const newUserContactMethod: 'email' | 'phone' = tokenDoc.additionalInfo?.contactMethod || 
        (email && !email.startsWith('dummyemail') ? 'email' : 'phone');
      const contactInfo = newUserContactMethod === 'email' ? email : phoneNumber;
      sendInviteStatusEmailToManager(referer, contactInfo!, 'accepted', undefined, newUserContactMethod);
      
      // Generate account setup token and send email with setup link
      const setupToken = await tokenService.generateAccountSetupToken(user!);
      towingRequestInviteAcceptedEmailToPSP(user!, setupToken);
      
      // Update towLink with referer if this is a tow-requester
      if (tokenDoc.additionalInfo.userType === 'tow-requester' && refererId) {
        towLink = `${config.clientUrl}/tow-requests/new?referer=${refererId}`;
      }
      
      // ✅ User exists → redirect
      return { tokens, redirectLink: towLink, user };
    } else {
      throw new ApiError(httpStatus.NOT_FOUND, 'No tow company id and or user id found');
    }
  }
};
export const checkGraceTime = async (token: string) => {
  const tokenDoc = await tokenService.fetchInviteUserTokenDetails(token!);

  if (!tokenDoc) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired link');
  }

  const email = tokenDoc.additionalInfo?.email;
  const user = await userService.getUserByEmail(email);
  const referer = await userService.getUserById(new mongoose.Types.ObjectId(tokenDoc.additionalInfo?.userId));

  if (user) {
    if (
      referer?.towCompanyId?.toString() !== user.towCompanyId?.toString() &&
      user?.userType === 'parking-spaces-provider-owner'
    ) {
      const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
      const createdAt = new Date(tokenDoc?.createdAt!).getTime();
      const now = Date.now();
      const elapsed = now - createdAt;
      const remaining = Math.max(gracePeriodMs - elapsed, 0);

      if (remaining <= 0) {
        return {
          status: 'expired',
          message: 'The 5-minute grace period has expired. The transfer is auto-approved.',
          expiredAt: new Date(createdAt + gracePeriodMs),
          autoRedirect: true,
        };
      }

      return {
        status: 'pending',
        message: 'Request is still within grace period, awaiting manager response.',
        remainingMs: remaining,
        expiresAt: new Date(createdAt + gracePeriodMs),
      };
    } else {
      return {
        status: 'wait',
        message: 'Please wait while we auto redirect you to the tow request page.',
        autoRedirect: true,
      };
    }
  } else {
    return {
      status: 'new-user',
      message: 'Proceed to create a new user',
      autoRedirect: true,
    };
  }
};

export const sendTokenExpiryNotificationToManager = async (token: string) => {
  const tokenDoc = await tokenService.fetchInviteUserTokenDetails(token);
  if (tokenDoc && !tokenDoc.blacklisted) {
    const email = tokenDoc.additionalInfo?.email;
    const phoneNumber = tokenDoc.additionalInfo?.phoneNumber;
    
    // Determine contact method from token or based on dummy values
    const storedContactMethod = tokenDoc.additionalInfo?.contactMethod as 'email' | 'phone' | undefined;
    const contactMethod: 'email' | 'phone' = storedContactMethod || 
      (email && !email.startsWith('dummyemail') ? 'email' : 'phone');
    const contactInfo = contactMethod === 'email' ? email : phoneNumber;

    const inviter = await userService.getUserById(new mongoose.Types.ObjectId(tokenDoc.additionalInfo?.userId));
    if (inviter) {
      const companyName =
        inviter?.userType === 'tow-company-owner'
          ? inviter.towCompany?.companyName
          : await userService.getTowCompanyNameById(inviter.towCompanyId);
      await sendInviteStatusEmailToManager(inviter, contactInfo, 'expired', companyName, contactMethod);

      // Send push notification to manager about token expiry
      await pushSubscriptionService.sendToUsers(
        [inviter._id || inviter.id],
        '⏰ Invitation Expired',
        `Invitation for ${contactInfo} has expired`,
        '/tow-invite'
      );
    }
  }
};

export const sendTokenExpiryNotificationToInvitee = async (token: string) => {
  const tokenDoc = await tokenService.fetchInviteUserTokenDetails(token);
  if (tokenDoc && !tokenDoc.blacklisted) {
    const email = tokenDoc.additionalInfo?.email;

    const inviter = await userService.getUserById(new mongoose.Types.ObjectId(tokenDoc.additionalInfo?.userId));
    if (inviter) {
      const companyName =
        inviter?.userType === 'tow-company-owner'
          ? inviter.towCompany?.companyName
          : await userService.getTowCompanyNameById(inviter.towCompanyId);
      await sendTowRequestInviteReminder(email, inviter, companyName, token);

      // Send push notification to invitee about token expiry reminder
      const invitee = await userService.getUserByEmail(email);
      if (invitee) {
        await pushSubscriptionService.sendToUsers(
          [invitee._id || invitee.id],
          '⏰ Invitation Expiring Soon',
          `Your invitation from ${inviter.fullName} will expire in 15 minutes`,
          `/tow-invite/${token}`
        );
      }
    }
  }
};

export const autoApproveTowRequest = async (towRequestId: string) => {
  console.log('autoApproveTowRequest pulse job is running');
  const towRequest = await TowRequest.findById(towRequestId);
  if (towRequest) {
    // Notify tow managers about escalation
    const towManagers = await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId);
    towManagers.forEach((manager) => {
      emitToUser(manager.id?.toString() || manager._id?.toString(), 'tow-request-update', {
        updatedBy: 'system',
        id: towRequest.id?.toString() || towRequest._id?.toString(),
        message: getNotificationMessage('requestEscalated', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
        status: 'PENDING_PSP_APPROVAL',
        type: 'requestEscalated',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });

      pushSubscriptionService.sendToUsers(
        [manager.id?.toString() || manager._id?.toString()],
        '⏰ Request Escalated',
        `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} escalated after 5 minutes`,
        `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
      );
    });
  }

  await updateTowRequestStatus(new mongoose.Types.ObjectId(towRequestId), 'PENDING_PSP_APPROVAL', undefined, true);
};

export const autoApproveCrossCompanyTransfer = async (
  actorId: string,
  targetUserId: string,
  fromCompanyId: string,
  toCompanyId: string,
  token: string
) => {
  console.log('Auto Approve Cross Company Transfer pulse job is running');
  const actor = await userService.getUserById(new mongoose.Types.ObjectId(actorId));
  const targetUser = await userService.getUserById(new mongoose.Types.ObjectId(targetUserId));

  if (!actor || !targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Actor or Target User not found');
  }

  // Check if transfer already rejected (add a field/flag in DB to track rejection)
  const tokenDetails = await tokenService.fetchInviteUserTokenDetails(token);
  const hasBeenRejected = !tokenDetails?.id || tokenDetails?.blacklisted || tokenDetails?.expires < new Date().toISOString();
  if (hasBeenRejected) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'The user has been rejected');
  }

  // Perform transfer: update user’s towCompanyId
  // await userService.updateUserById(new mongoose.Types.ObjectId(targetUserId), { towCompanyId: toCompanyId });
  const fromCompany = await userService.getTowCompanyNameById(fromCompanyId);
  const toCompany = await userService.getTowCompanyNameById(toCompanyId);
  // Notify both sides
  const towManagers = await userService.getTowManagersByTowCompanyId(fromCompanyId);

  await emailService.sendCrossCompanyAutoApproveActor(actor, targetUser, fromCompany!, toCompany!);
  await emailService.sendCrossCompanyAutoApproveManagers(towManagers, targetUser);
  await emailService.sendCrossCompanyAutoApproveUser(targetUser, toCompany!, token);
};

export const discardCrossCompanyTransfer = async (token: string, manager: IUserDoc) => {
  const tokenDoc = await tokenService.fetchInviteUserTokenDetails(token);
  manager;
  if (!tokenDoc) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired link');
  }
  const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
  const createdAt = new Date(tokenDoc?.createdAt!).getTime();
  const now = Date.now();

  if (now - createdAt > gracePeriodMs) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'The 5-minute grace period has expired. The transfer was already auto-approved.'
    );
  }
  const actorId = tokenDoc.additionalInfo?.userId;
  const targetEmail = tokenDoc.additionalInfo?.email;

  if (!actorId || !targetEmail) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Missing transfer details');
  }

  const actor = await userService.getUserById(new mongoose.Types.ObjectId(actorId));
  const targetUser = await userService.getUserByEmail(targetEmail);

  if (!actor || !targetUser) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Actor or Target User not found');
  }

  // Mark token as discarded
  await tokenService.markTokenAsDiscarded(token);

  // Get tow managers from both companies for notifications
  const fromCompanyId = targetUser.towCompanyId?.toString();
  const toCompanyId = actor.towCompanyId?.toString();

  const fromCompanyManagers = fromCompanyId ? await userService.getTowManagersByTowCompanyId(fromCompanyId) : [];
  const toCompanyManagers = toCompanyId ? await userService.getTowManagersByTowCompanyId(toCompanyId) : [];

  // Prepare recipients for notifications
  const recipients = [
    actor._id.toString(),
    targetUser._id.toString(),
    ...fromCompanyManagers.map((m) => m._id.toString()),
    ...toCompanyManagers.map((m) => m._id.toString()),
  ];
  const uniqueRecipients = [...new Set(recipients)];

  // Send socket notifications
  emitToUser(actor._id, 'tow-request-update', {
    id: token,
    message: getNotificationMessage('discarded', { actor: actor.fullName, targetUser: targetUser.fullName }),
    status: 'DISCARDED',
    type: 'discarded',
    actor: actor.fullName,
    targetUser: targetUser.fullName,
  });

  emitToUser(targetUser._id, 'tow-request-update', {
    id: token,
    message: getNotificationMessage('discarded', { actor: actor.fullName, targetUser: targetUser.fullName }),
    status: 'DISCARDED',
    type: 'discarded',
    actor: actor.fullName,
    targetUser: targetUser.fullName,
  });

  // Send individual socket notifications to managers
  uniqueRecipients.forEach((userId) => {
    emitToUser(userId, 'tow-request-update', {
      id: token,
      message: getNotificationMessage('discarded', { actor: actor.fullName, targetUser: targetUser.fullName }),
      status: 'DISCARDED',
      type: 'discarded',
      actor: actor.fullName,
      targetUser: targetUser.fullName,
    });
  });

  // Send push notifications
  pushSubscriptionService.sendToUsers(
    [actor._id.toString()],
    '❌ Transfer Discarded',
    `Cross-company transfer for ${targetUser.fullName} has been discarded`,
    '/tow-invite'
  );

  pushSubscriptionService.sendToUsers(
    [targetUser._id.toString()],
    '❌ Transfer Discarded',
    `Your transfer request has been discarded by ${actor.fullName}`,
    '/tow-invite'
  );

  pushSubscriptionService.sendToUsers(
    [...fromCompanyManagers.map((m) => m._id.toString()), ...toCompanyManagers.map((m) => m._id.toString())],
    '❌ Transfer Discarded',
    `Cross-company transfer between ${actor.fullName} and ${targetUser.fullName} has been discarded`,
    '/tow-invite'
  );

  userService.postDiscardTransferPSPAccount(targetUser, actor);
  return true;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const getTowRequestIDs = async (filter: Record<string, any>) => {
  const towRequests = await TowRequest.aggregate([
    {
      $match: {
        ...filter,
        isDeleted: { $ne: true },
      },
    },
    {
      $project: {
        _id: 1,
        status: 1,
      },
    },
  ]);

  return towRequests.map(({ _id, status }) => ({ _id, status }));
};

/**
 * Update operator location for live tracking
 * @param {mongoose.Types.ObjectId} towRequestId
 * @param {ILocation} location
 * @param {IUserDoc} operator
 * @returns {Promise<ITowRequestDoc>}
 */
export const updateOperatorLocation = async (
  towRequestId: mongoose.Types.ObjectId,
  location: ILocation,
  operator: IUserDoc
): Promise<ITowRequestDoc> => {
  const towRequest = await TowRequest.findById(towRequestId);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }

  if (towRequest.assignedTo?.toString() !== operator._id.toString()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You are not assigned to this tow request');
  }

  await TowRequest.updateOne({ _id: towRequestId }, { towOperatorLocation: location });

  const updatedTowRequest = await TowRequest.findById(towRequestId);

  // Broadcast location update to requester and managers
  const stakeholders = [
    towRequest.requestCreatedBy,
    ...(await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId)).map((m) => m._id),
  ];

  stakeholders.forEach((stakeholderId) => {
    emitToUser(stakeholderId?.toString(), 'tow-request-update', {
      updatedBy: operator.id?.toString() || operator._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('operatorLocationUpdate', {
        id: towRequest.id?.toString() || towRequest._id?.toString(),
      }),
      status: towRequest.status,
      type: 'operatorLocationUpdate',
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      location,
    });
  });

  return updatedTowRequest as ITowRequestDoc;
};

/**
 * Reassign a tow request to a different tow operator
 * @param {string} towRequestId - The ID of the tow request to reassign
 * @param {string} newOperatorId - The ID of the new tow operator
 * @param {IUserDoc} loggedInUser - The user making the reassignment
 * @returns {Promise<ITowRequestDoc>}
 */
export const reassignTowRequest = async (
  towRequestId: string,
  newOperatorId: string,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  const towRequest = await TowRequest.findById(towRequestId);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow request not found');
  }

  // Check if the tow request is in a state that allows reassignment
  if (towRequest.status !== 'ASSIGNED') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request must be in ASSIGNED status to be reassigned');
  }

  // Get the old operator info for notifications
  const oldOperator = await userService.getUserById(new mongoose.Types.ObjectId(towRequest.assignedTo!));
  const newOperator = await userService.getUserById(new mongoose.Types.ObjectId(newOperatorId));

  if (!newOperator) {
    throw new ApiError(httpStatus.NOT_FOUND, 'New tow operator not found');
  }

  // Check if the new operator is available (not already assigned to another active request)
  const existingAssignment = await TowRequest.findOne({
    assignedTo: newOperatorId,
    status: { $in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
  });

  if (existingAssignment) {
    throw new ApiError(httpStatus.CONFLICT, 'Selected tow operator is already assigned to another active request');
  }

  // Update the tow request
  const oldAssignedTo = towRequest.assignedTo;
  towRequest.assignedTo = newOperatorId;
  towRequest.assignedToEmail = newOperator.email || '';
  towRequest.assignedToName = newOperator.fullName || '';
  towRequest.assignedBy = loggedInUser._id;
  towRequest.assignedByEmail = loggedInUser.email || '';
  towRequest.assignedByName = loggedInUser.fullName || '';
  towRequest.towAssignedAt = new Date(); // Update the assignment timestamp
  await towRequest.save();

  // Send chat message for reassignment

  // Remove old operator from chat room and add new operator
  if (oldOperator) {
    await removeUserFromTowRequestChat(towRequestId, oldOperator._id.toString(), undefined, true);
  }
  await addUserToTowRequestChat(towRequestId, newOperator._id.toString(), 'member');
  await sendTowRequestChatMessage(
    towRequestId,
    `🔄 Tow request reassigned from ${oldOperator?.fullName || 'previous operator'} to ${newOperator.fullName} by ${
      loggedInUser.fullName
    }`
  );
  // Get populated images for notifications
  const populatedImages = await getSignedImagesForTowRequest(towRequest?.toObject ? towRequest.toObject() : towRequest);

  // Send notifications to old operator
  if (oldOperator) {
    console.log('Sending notification to old operator', oldAssignedTo);
    emitToUser(oldAssignedTo?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('requestReassigned', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      type: 'requestReassigned',
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
    });

    pushSubscriptionService.sendToUsers(
      [oldAssignedTo?.toString()!],
      '🔄 Request Reassigned',
      `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} has been reassigned to another operator`,
      `/tow-requests`
    );
  }
  console.log('Sending notification to new operator', newOperatorId);

  // Send notifications to new operator
  emitToUser(newOperatorId?.toString(), 'tow-request-update', {
    updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
    id: towRequest.id?.toString() || towRequest._id?.toString(),
    message: getNotificationMessage('requestAssigned', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
    status: towRequest.status,
    type: 'requestAssigned',
    towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
  });

  pushSubscriptionService.sendToUsers(
    [newOperatorId?.toString()],
    '📌 Tow Assignment',
    `You've been assigned tow request ${towRequest.id?.toString() || towRequest._id?.toString()}`,
    `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
  );

  // Send notifications to tow managers
  const towManagers = await userService.getTowManagersByTowCompanyId(loggedInUser.towCompanyId);
  towManagers.forEach((manager) => {
    console.log('Sending notification to manager', manager.id || manager._id);
    emitToUser(manager.id || manager._id, 'tow-request-update', {
      updatedBy: loggedInUser.id,
      id: towRequest.id || towRequest._id,
      message: getNotificationMessage('requestReassigned', {
        id: towRequest.id || towRequest._id,
        oldOperator: oldOperator?.fullName || 'Previous Operator',
        newOperator: newOperator.fullName,
      }),
      status: towRequest.status,
      type: 'requestReassigned',
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
    });
  });

  pushSubscriptionService.sendToUsers(
    towManagers.map((m) => m._id),
    '🔄 Tow Request Reassigned',
    `Tow request ${towRequest.id || towRequest._id} reassigned to ${newOperator.fullName}`,
    `/tow-requests/${towRequest.id || towRequest._id}`
  );

  // Send email notifications
  if (oldOperator) {
    // Send reassignment notification to old operator
    emailService.towingRequestStatusUpdateEmailToLinkedUsers(
      oldOperator.fullName!,
      'REASSIGNED',
      towRequest.id || towRequest._id,
      loggedInUser,
      towRequest.location,
      populatedImages.licensePlates,
      'OPERATOR',
      oldOperator.email!
    );
  }

  // Send assignment notification to new operator
  emailService.sendTowingNotificationToTowOperator(
    newOperator.fullName!,
    newOperator,
    newOperator.email!,
    towRequest.location,
    towRequest.requestCreatedBy,
    loggedInUser,
    populatedImages.licensePlates,
    towRequest.id || towRequest._id,
    towRequest.towOperatorLocation || towRequest.location
  );

  return towRequest as ITowRequestDoc;
};

/**
 * Cancel auto-rejection job when operator accepts the request
 * @param {string} towRequestId - The ID of the tow request
 */
export const cancelAutoRejectionJob = async (towRequestId: string): Promise<void> => {
  try {
    const pulse = getPulse();
    await pulse.start();

    // Find and cancel the auto-rejection job for this tow request
    const jobs = await pulse.jobs({ name: 'autoRejectTowRequest' });
    const jobToCancel = jobs.find(
      (job) => job.attrs.data && job.attrs.data['towRequestId'] === towRequestId && job.attrs.nextRunAt // Only cancel if it hasn't run yet
    );

    if (jobToCancel) {
      await jobToCancel.remove();
      console.log(`Cancelled auto-rejection job for tow request: ${towRequestId}`);
    }
  } catch (error) {
    console.error('Failed to cancel auto-rejection job:', error);
  }
};

/**
 * Auto-reject tow request after 5 minutes if not accepted by operator
 * @param {string} towRequestId - The ID of the tow request to auto-reject
 */
export const autoRejectTowRequest = async (towRequestId: string): Promise<void> => {
  try {
    const towRequest = await TowRequest.findById(towRequestId).populate('requestCreatedBy');
    if (!towRequest || towRequest.status !== 'ASSIGNED') {
      console.log(`Auto-rejection skipped: Tow request ${towRequestId} not found or not in ASSIGNED status`);
      return; // Request no longer exists or not in correct status
    }

    console.log(`Auto-rejecting tow request ${towRequestId} after 5 minutes timeout`);

    // Get all stakeholders for notifications
    const [assignedOperator, towManagers, requester] = await Promise.all([
      userService.getUserById(new mongoose.Types.ObjectId(towRequest.assignedTo!)),
      userService.getTowManagersByTowCompanyId(towRequest.towCompanyId),
      towRequest.requestCreatedBy,
    ]);

    // Send chat message for auto-rejection
    await sendTowRequestChatMessage(
      towRequestId,
      `⏰ Tow request auto-rejected after 5 minutes - operator did not respond. Status reset to pending assignment.`
    );

    // Remove the auto-rejected operator from the chat room
    if (assignedOperator) {
      await removeUserFromTowRequestChat(towRequestId, assignedOperator._id.toString());
    }

    // Get populated images for email notifications
    const populatedImages = await getSignedImagesForTowRequest(towRequest);

    // Send notifications to assigned operator
    if (assignedOperator) {
      emitToUser(assignedOperator.id?.toString() || assignedOperator._id?.toString(), 'tow-request-update', {
        updatedBy: 'system',
        id: towRequest.id?.toString() || towRequest._id?.toString(),
        message: getNotificationMessage('requestAutoRejected', {
          id: towRequest.id?.toString() || towRequest._id?.toString(),
        }),
        status: towRequest.status,
        type: 'requestAutoRejected',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });

      // Send push notification to operator
      pushSubscriptionService.sendToUsers(
        [assignedOperator._id?.toString()],
        '❌ Request Auto-Rejected',
        `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} was auto-rejected due to no response`,
        `/tow-requests`
      );

      // Send email to operator
      if (assignedOperator.email) {
        const isPreviousUser = true;
        await emailService.sendTowingRequestStatusUpdateEmail(
          assignedOperator.fullName!,
          assignedOperator,
          assignedOperator.email,
          'REJECTED',
          towRequest.id?.toString() || towRequest._id?.toString(),
          isPreviousUser
        );
      }
    }

    // Send notifications to tow managers
    towManagers.forEach((manager) => {
      emitToUser(manager.id?.toString() || manager._id?.toString(), 'tow-request-update', {
        updatedBy: 'system',
        id: towRequest.id?.toString() || towRequest._id?.toString(),
        message: getNotificationMessage('requestAutoRejected', {
          id: towRequest.id?.toString() || towRequest._id?.toString(),
        }),
        status: towRequest.status,
        type: 'requestAutoRejected',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });
    });

    // Send push notifications to managers
    pushSubscriptionService.sendToUsers(
      towManagers.map((m) => m._id?.toString()),
      '❌ Request Auto-Rejected',
      `Tow request ${towRequest.id?.toString() || towRequest._id?.toString()} was auto-rejected - operator did not respond`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );

    // Send email to managers
    await emailService.towingRequestFollowUpEmailToLinkedUsers(
      towRequest.id?.toString() || towRequest._id?.toString(),
      'REJECTED',
      towManagers,
      assignedOperator,
      towRequest.location,
      populatedImages.licensePlates
    );

    // Send notifications to requester
    if (requester) {
      emitToUser(requester.id?.toString() || requester._id?.toString(), 'tow-request-update', {
        updatedBy: 'system',
        id: towRequest.id?.toString() || towRequest._id?.toString(),
        message: getNotificationMessage('requestAutoRejected', {
          id: towRequest.id?.toString() || towRequest._id?.toString(),
        }),
        status: towRequest.status,
        type: 'requestAutoRejected',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });

      // Send push notification to requester
      pushSubscriptionService.sendToUsers(
        [requester._id?.toString()],
        '❌ Request Auto-Rejected',
        `Your tow request ${
          towRequest.id?.toString() || towRequest._id?.toString()
        } was auto-rejected - operator did not respond`,
        `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
      );

      // Send email to requester
      if (requester.email) {
        await emailService.sendTowingRequestStatusUpdateEmail(
          requester.fullName!,
          requester,
          requester.email,
          'REJECTED',
          towRequest.id?.toString() || towRequest._id?.toString(),
          false
        );
      }
    }

    // Create database notification for all stakeholders
    const allStakeholders = [
      ...towManagers.map((m) => m._id?.toString()).filter(Boolean),
      assignedOperator?._id?.toString(),
      requester?._id?.toString(),
    ].filter(Boolean);

    if (allStakeholders.length > 0) {
      await notificationService.bulkCreateNotifications(allStakeholders as string[], {
        type: 'tow_request_rejected',
        category: 'tow_request',
        title: 'Tow Request Auto-Rejected',
        message: `Tow request ${
          towRequest.id?.toString() || towRequest._id?.toString()
        } was automatically rejected after 5 minutes due to no operator response`,
        priority: 'high',
        sourceId: towRequest.id?.toString() || towRequest._id?.toString(),
        metadata: {
          towRequestId: towRequest.id?.toString() || towRequest._id?.toString(),
          rejectionReason: 'Auto-rejected: Operator did not respond within 5 minutes',
          rejectedAt: new Date(),
        },
      });
    }

    const updatedTowRequest = await TowRequest.updateOne(
      { _id: towRequestId },
      {
        $set: { status: 'PENDING_ASSIGNMENT' },
        $unset: {
          assignedTo: 1,
          assignedToEmail: 1,
          assignedToName: 1,
          assignedBy: 1,
          assignedByEmail: 1,
          assignedByName: 1,
        },
      }
    );

    emitToTowRequest(towRequest.id?.toString() || towRequest._id?.toString(), 'tow-request-update', {
      updatedBy: 'system',
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('updated', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      towRequest: updatedTowRequest,
      type: 'updated',
    });
    console.log(`Successfully auto-rejected tow request ${towRequestId}`);
  } catch (error) {
    console.error('Auto-rejection failed:', error);
  }
};

/**
 * Update live location for a tow request (when accepted by operator)
 * @param {string} towRequestId - The ID of the tow request
 * @param {ILocation} liveLocation - The live location data
 * @param {IUserDoc} loggedInUser - The user updating the location
 * @returns {Promise<ITowRequestDoc>}
 */
export const updateLiveLocation = async (
  towRequestId: string,
  liveLocation: ILocation,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  // Validate input parameters
  if (!towRequestId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request ID is required');
  }

  if (!liveLocation) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Live location data is required');
  }

  // Validate location data structure
  if (!liveLocation.lat || !liveLocation.lng) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Live location must include latitude and longitude');
  }

  // Validate latitude and longitude are valid numbers
  const lat = parseFloat(liveLocation.lat);
  const lng = parseFloat(liveLocation.lng);

  if (isNaN(lat) || isNaN(lng)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Latitude and longitude must be valid numbers');
  }

  if (lat < -90 || lat > 90) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Latitude must be between -90 and 90 degrees');
  }

  if (lng < -180 || lng > 180) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Longitude must be between -180 and 180 degrees');
  }

  const towRequest = await TowRequest.findById(towRequestId);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow request not found');
  }

  // Check if the tow request is in a state that allows live location updates
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(towRequest.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Live location can only be updated for accepted or in-progress requests');
  }

  // Check if the user is the assigned operator
  if (towRequest.assignedTo?.toString() !== loggedInUser._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only the assigned operator can update live location');
  }

  try {
    // Update the live location
    towRequest.liveLocation = liveLocation;
    await towRequest.save();

    console.log(`Live location updated for tow request ${towRequestId} by ${loggedInUser.fullName}:`, {
      lat: liveLocation.lat,
      lng: liveLocation.lng,
      address: liveLocation.address || 'No address provided',
    });

    // Send socket notification to managers and requesters
    const towManagers = await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId);

    // Get PSP managers if available
    let pspManagers: any[] = [];
    if (towRequest.pspCompanyId) {
      try {
        pspManagers = await userService.getPSPManagerByPSPId(towRequest.pspCompanyId.toString());
      } catch (error) {
        console.log('PSP managers not found:', error);
      }
    }

    // Notify tow managers
    towManagers.forEach((manager: any) => {
      emitToUser(manager.id || manager._id, 'tow-request-update', {
        updatedBy: loggedInUser.id,
        id: towRequest.id || towRequest._id,
        message: getNotificationMessage('liveLocationUpdated', { operator: loggedInUser.fullName }),
        status: towRequest.status,
        type: 'liveLocationUpdated',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });
    });

    // Notify PSP managers if available (without location details)
    pspManagers.forEach((manager: any) => {
      emitToUser(manager.id || manager._id, 'tow-request-update', {
        updatedBy: loggedInUser.id,
        id: towRequest.id || towRequest._id,
        message: getNotificationMessage('liveLocationUpdated', { operator: loggedInUser.fullName }),
        status: towRequest.status,
        type: 'liveLocationUpdated',
        towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
      });
    });

    // Emit specific location update event for real-time tracking (tow company entities only)
    emitToTowRequest(towRequest.id?.toString() || towRequest._id?.toString(), 'towOperatorLocationUpdated', {
      towRequestId: towRequest.id?.toString() || towRequest._id?.toString(),
      location: {
        lat: liveLocation.lat,
        lng: liveLocation.lng,
      },
      updatedAt: new Date().toISOString(),
      towOperatorId: loggedInUser.id,
      isLocationUpdate: true,
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
    });

    return towRequest as ITowRequestDoc;
  } catch (error) {
    console.error('Error updating live location:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update live location');
  }
};

/**
 * Mark vehicle as picked up
 * @param {mongoose.Types.ObjectId} towRequestId
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc>}
 */
export const markVehiclePickedUp = async (
  towRequestId: mongoose.Types.ObjectId,
  loggedInUser: IUserDoc
): Promise<ITowRequestDoc> => {
  const towRequest = await TowRequest.findById(towRequestId);
  if (!towRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow request not found');
  }

  // Check if the user is the assigned operator
  if (towRequest.assignedTo?.toString() !== loggedInUser._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only the assigned operator can mark vehicle as picked up');
  }

  // Check if the tow request is in a state that allows pickup
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(towRequest.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Vehicle can only be marked as picked up for accepted or in-progress requests');
  }

  // Update the pickup status
  (towRequest as any).isVehiclePickedUp = true;
  await towRequest.save();

  console.log(`Vehicle marked as picked up for tow request ${towRequestId} by ${loggedInUser.fullName}`);

  const towRequestData = towRequest?.toObject ? towRequest.toObject() : towRequest;
  const towRequestIdStr = towRequest.id?.toString() || towRequest._id?.toString();

  // Emit to tow request room so all subscribers get the update
  emitToTowRequest(towRequestIdStr, 'tow-request-update', {
    updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
    id: towRequestIdStr,
    message: getNotificationMessage('vehiclePickedUp', { operator: loggedInUser.fullName }),
    status: towRequest.status,
    type: 'vehiclePickedUp',
    towRequest: towRequestData,
  });

  // Send socket notification to tow managers
  const towManagers = await userService.getTowManagersByTowCompanyId(towRequest.towCompanyId);
  towManagers.forEach((manager: any) => {
    emitToUser(manager.id?.toString() || manager._id?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequestIdStr,
      message: getNotificationMessage('vehiclePickedUp', { operator: loggedInUser.fullName }),
      status: towRequest.status,
      type: 'vehiclePickedUp',
      towRequest: towRequestData,
    });
  });

  // Also notify the requester if they exist
  if (towRequest.requestCreatedBy) {
    emitToUser(towRequest.requestCreatedBy.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequestIdStr,
      message: getNotificationMessage('vehiclePickedUp', { operator: loggedInUser.fullName }),
      status: towRequest.status,
      type: 'vehiclePickedUp',
      towRequest: towRequestData,
    });
  }

  return towRequest as ITowRequestDoc;
};

/**
 * Get pending assignment for a tow operator
 * @param {string} userId - The user ID to check for pending assignments
 * @returns {Promise<ITowRequestDoc | null>} - The pending tow request or null
 */
export const getPendingAssignment = async (userId: string): Promise<ITowRequestDoc | null> => {
  try {
    console.log(`🔍 Checking for pending assignments for user: ${userId}`);

    // Find tow requests assigned to the user with status 'ASSIGNED' (pending acceptance)
    const pendingAssignment = await TowRequest.findOne({
      assignedTo: new mongoose.Types.ObjectId(userId),
      status: 'ASSIGNED',
      isDeleted: { $ne: true },
    })
      .populate('assignedBy', 'fullName email')
      .populate('requestCreatedBy', 'fullName email phoneNumber')
      .populate('towCompanyId', 'companyName')
      .lean();

    if (pendingAssignment) {
      console.log(`✅ Found pending assignment: ${pendingAssignment._id}`);
    } else {
      console.log(`ℹ️ No pending assignments found for user: ${userId}`);
    }

    return pendingAssignment as ITowRequestDoc | null;
  } catch (error) {
    console.error('Error getting pending assignment:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get pending assignment');
  }
};

/**
 * Get the most recent active tow request for the logged-in user
 * For tow operators: returns the most recent request assigned to them with active status
 * For parking space providers: returns the most recent request they created with active status
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc | null>}
 */
export const getMostRecentActiveTowRequest = async (loggedInUser: IUserDoc): Promise<ITowRequestDoc | null> => {
  try {
    const activeStatuses = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];
    const filter: any = {
      status: { $in: activeStatuses },
      isDeleted: { $ne: true },
    };

    // For tow operators, find requests assigned to them
    if (loggedInUser.userType === 'tow-company-employee' || loggedInUser.isTowOperator) {
      filter.assignedTo = new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id);
    }
    // For parking space providers, find requests they created
    else if (loggedInUser.userType?.includes('parking-spaces-provider')) {
      const pspCompanyId = loggedInUser.userType === 'parking-spaces-provider-owner' 
        ? loggedInUser.id || loggedInUser._id
        : loggedInUser.pspCompanyId;
      
      filter.$or = [
        { requestCreatedBy: new mongoose.Types.ObjectId(loggedInUser.id || loggedInUser._id) },
        { pspCompanyId: new mongoose.Types.ObjectId(pspCompanyId) }
      ];
    }
    // For other user types, return null
    else {
      return null;
    }

    const activeTowRequest = await TowRequest.findOne(filter)
      .populate('assignedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('requestCreatedBy', 'fullName email phoneNumber')
      .populate('towCompanyId', 'companyName')
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    return activeTowRequest as ITowRequestDoc | null;
  } catch (error) {
    console.error('Error getting most recent active tow request:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get most recent active tow request');
  }
};

/**
 * Assign a tow request to the logged-in manager themselves
 * @param {mongoose.Types.ObjectId} towId
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<ITowRequestDoc>}
 */
export const assignTowToSelf = async (towId: mongoose.Types.ObjectId, loggedInUser: IUserDoc): Promise<ITowRequestDoc> => {
  try {
    // Check if user is authorized to self-assign
    if (
      loggedInUser.userType !== 'tow-company-manager' &&
      loggedInUser.userType !== 'tow-company-owner' &&
      loggedInUser.userType !== 'admin'
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You are not authorized to assign tows to yourself');
    }

    const towRequest = await TowRequest.findById(new mongoose.Types.ObjectId(towId)).populate('requestCreatedBy');
    if (!towRequest) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
    }

    if (towRequest?.assignedTo) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow request is already assigned');
    }

    // Check if the tow request belongs to the manager's company
    if (loggedInUser.userType === 'tow-company-manager') {
      if (towRequest.towCompanyId?.toString() !== loggedInUser.towCompanyId?.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You can only assign tow requests from your own company');
      }
    } else if (loggedInUser.userType === 'tow-company-owner') {
      if (towRequest.towCompanyId?.toString() !== loggedInUser.id?.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You can only assign tow requests from your own company');
      }
    }

    // Assign to self
    towRequest.assignedTo = loggedInUser._id;
    towRequest.assignedToEmail = loggedInUser.email!;
    towRequest.assignedToName = loggedInUser.fullName!;
    towRequest.driverBadgeNumber = loggedInUser.driverBadgeNumber ?? '';

    towRequest.assignedBy = loggedInUser?.id || loggedInUser?._id;
    towRequest.assignedByEmail = loggedInUser.email!;
    towRequest.assignedByName = loggedInUser.fullName!;
    towRequest.towAssignedAt = new Date();
    towRequest.towOperatorLocation = towRequest.location; // Use request location as initial operator location

    // Set status to ACCEPTED since they're assigning to themselves
    towRequest.status = 'ACCEPTED';

    await towRequest.save();

    // Add self to chat room if not already a participant
    try {
      const chatRoom = await chatService.getTowRequestChatRoomById(towRequest._id.toString());
      if (chatRoom) {
        const bypassAdminCheck = true;
        await chatService.addParticipant(
          chatRoom._id.toString(),
          loggedInUser._id.toString(),
          loggedInUser._id.toString(),
          bypassAdminCheck
        );
        console.log(`Added self-assigned manager ${loggedInUser._id} to tow request ${towRequest._id} chat room`);
      } else {
        console.log(`Chat room not found for tow request ${towRequest._id}`);
      }
    } catch (error) {
      console.log('Could not add self-assigned manager to chat room:', error);
    }

    // Notify other managers about the self-assignment
    const towManagers = await userService.getTowManagersByTowCompanyId(loggedInUser.towCompanyId);
    const otherManagers = towManagers.filter((manager) => manager._id.toString() !== loggedInUser._id.toString());

    otherManagers.forEach(async (manager) => {
      sendTowingAssignmentEmailToManager(
        manager.fullName!,
        manager,
        manager.email!,
        towRequest.location,
        towRequest.requestCreatedBy,
        loggedInUser,
        (await getSignedImagesForTowRequest(towRequest)).licensePlates,
        towRequest.id || towRequest._id,
        towRequest.towOperatorLocation || towRequest.location
      );
    });

    // Emit socket events
    emitToTowRequest(towRequest.id?.toString() || towRequest._id?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('updated', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      towRequest,
      type: 'updated',
    });

    emitToUser(loggedInUser._id?.toString(), 'tow-request-update', {
      updatedBy: loggedInUser.id?.toString() || loggedInUser._id?.toString(),
      id: towRequest.id?.toString() || towRequest._id?.toString(),
      message: getNotificationMessage('requestAssigned', { id: towRequest.id?.toString() || towRequest._id?.toString() }),
      status: towRequest.status,
      type: 'requestAssigned',
      towRequest: towRequest?.toObject ? towRequest.toObject() : towRequest,
    });

    // Send push notifications
    pushSubscriptionService.sendToUsers(
      [loggedInUser._id?.toString()],
      '📌 Tow Self-Assignment',
      `You've assigned tow request ${towRequest.id?.toString() || towRequest._id?.toString()} to yourself`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );

    pushSubscriptionService.sendToUsers(
      otherManagers.map((m) => m._id?.toString()),
      '📌 Tow Self-Assignment',
      `${loggedInUser.fullName} assigned tow request ${
        towRequest.id?.toString() || towRequest._id?.toString()
      } to themselves`,
      `/tow-requests/${towRequest.id?.toString() || towRequest._id?.toString()}`
    );

    // Send assignment event for notification count updates
    const affectedUsers = [loggedInUser._id.toString(), ...otherManagers.map((m) => m._id.toString())];
    affectedUsers.forEach((userId) => {
      emitToUser(userId, 'towRequestAssigned', {
        towRequestId: towRequest._id.toString(),
        assignedTo: loggedInUser._id.toString(),
        previousAssignedTo: null,
      });
    });

    // Send chat message for self-assignment
    await sendTowRequestChatMessage(
      towRequest._id.toString(),
      `📌 Tow request self-assigned to ${loggedInUser.fullName} (Status: ACCEPTED - Ready to start)`
    );

    return towRequest;
  } catch (e) {
    console.error(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

