import { IUserDoc, IUserType } from '../user/user.interfaces';

import { GPTDetails } from '../logs/log.interfaces';

// Faisal Ride refactor - Archived module import removed
// import { IApartmentComplexDoc } from '../apartmentComplex/apartmentComplex.interfaces';
type IApartmentComplexDoc = any; // Placeholder for archived type

export const ALL_EVENTS = {
  UserEvents: {
    emailLoginIn: 'User successfully logged in using email.',
    emailLoginInAttempt: 'User attempted to log in using email.',
    validatedSetEmailToken: 'User successfully validated SET-EMAIL token.',
    phoneLogin: 'User successfully logged in using phone number.',
    passwordReset:
      'User successfully verified their account and changed their password and completed password reset journey.',
    profileChange: 'User updated their profile picture via the app.',
    requestedOtpForEmailChange: 'User requested OTPs for changing email address.',
    requestedOtpForEmailSetOnly: 'User <user> initiated the email setup process.',
    verfiedPhoneForEmailSet: 'User <user> verified their phone number during email setup process.',
    requestedOtpForEmailSet: 'User requested OTP to set a new email address.',
    requestedOtpForEmailSetOnlyEmail: 'User <user> requested OTP for email setup.',
    verificationLinkSentToUser: 'A verification link has been sent to user: <user>.',
    emailSetupSuccessful: 'User <user> successfully set up an email address. <email> has been linked to their account.',
    requestedOtpForPhoneChange: 'User requested OTP for updating their phone number.',
    userCreated: 'A new user account was created.',
    getAllUsers: 'Retrieved the list of all users.',
    getSingleUser: 'Retrieved details of a specific user.',
    updateUser: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User profile has been updated. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    deleteUser: 'User account has been deleted.',

    userProfileUpdated: 'User updated their profile information.',
    errorInIrregualrLogin: (phone?: string, email?: string, error?: any) =>
      `An error occurred while checking for irregular login activity. Attempt made with phone number: ${phone}, email: ${email}. Error: ${error}`,
    failedUnusualAlert: (phone?: string, email?: string, error?: any) =>
      `Failed to send unusual activity alert. Attempt made with phone number: ${phone}, email: ${email}. Error: ${error}`,
    userPhoneNumberUpdate: 'User successfully updated their phone number.',
    userEmailUpdate: ({ fromEmail, toEmail }: any) =>
      `User updated their email from ${fromEmail} to ${toEmail} and verified the new email address.`,
    userFetchedSelf: 'User retrieved their own account information.',
    userUpdateBusinessDetails: 'User updated their business-related details.',
    userUploadImage: 'User updated their business logo or cover image.',
    messageSend: 'A message was successfully sent to the user.',
    userLogout: 'User logged out of the system.',
    userLoginFailure: 'User login attempt failed.',
    PasswordResetRequest: 'User requested a password reset.',
    PasswordResetFailure: 'Password reset process failed.',
    roleChange: "User's role has been updated.",
    accountRecoveryCompleted: 'User successfully completed the account recovery process.',
    accountRecoveryFailed: 'Account recovery process failed.',
    unsubEmail: (email: string) => `User with email address ${email} unsubscribed from email notifications via EMAIL_API.`,
    unsubPhone: (phoneNumber: string) =>
      `User with phone number ${phoneNumber} unsubscribed from SMS campaigns via SMS_MENU_SHARING.`,
  },

  SystemSecurity: {
    // Reserved for future system-level security events
  },

  ManagementEvents: {
    SystemUserSuspend: (userName: string, reason: string) =>
      `System suspended the account of user ${userName}. Reason: ${reason}`,
    ErrorInIndexingCRONJob: (name: string, error: string) => `CRON job "${name}" failed to execute. Error: ${error}`,
    SystemAnomalyDetected: (userName: string, reason: string) =>
      `Security anomaly detected for user ${userName}. Reason: ${reason}`,
    adminSendMessageToUser: (userType: string = 'Admin', siteId: string) =>
      `${userType} sent a message to the user associated with siteId: ${siteId}`,
    impersonate: (adminName: string, userName: string, userType: IUserType, impersonatedByUserType: string = 'Admin') =>
      `${impersonatedByUserType} { Name: ${adminName} } impersonated user: ${userName}, User Type: ${userType}`,
    fetchUserDetails: (adminName: string, userName: string, userType: IUserType, impersonatedByUserType: string = 'Admin') =>
      `${impersonatedByUserType} { Name: ${adminName} } retrieved details of user: ${userName}, User Type: ${userType}`,
    updateProfile: (adminName: string, userName: string, userType: IUserType, impersonatedByUserType: string = 'Admin') =>
      `${impersonatedByUserType} { Name: ${adminName} } updated profile of ${userType}: ${userName}`,
    userDeleted: (userType: string = 'Admin') => `${userType} deleted a user account.`,
  },

  AI: {
    GPTQuery: ({ model, type, tokensUsage, charactersLength, prompt }: GPTDetails) =>
      `User accessed AI service "${type}" via CHATGPT using the ${model} model. Prompt: "${prompt}", Result: ${charactersLength} characters, ${tokensUsage} tokens.`,
  },

  attemptToUpdateAdminByAnAdmin: (user: IUserDoc, anotherUser: IUserDoc) =>
    `Action blocked: User ${user.fullName} (${user.email}) attempted to update details of another User ${anotherUser.fullName} (${anotherUser.email}).`,

  customer: {
    fetchBusinessDetails: 'Customer accessed the main page of a business.',
    customerContactSupport: 'Customer contacted support regarding an account issue.',
  },

  UserManagementEvents: {
    //   createUser: ({ fullName, email }: IUserDoc) =>
    // `New user registration. Name: ${fullName}, ${email ? `Email: ${email}` : ''}`,
    onboardCompany: ({ companyName, email, id }: { companyName: string; email: string; id: string }) =>
      `New company onboarded with company name: ${companyName}, email: ${email} and ID: ${id}`,
    onboardTowCompany: ({ companyName, email, id }: { companyName: string; email: string; id: string }) =>
      `New Tow Company onboarded with company name: ${companyName}, email: ${email} and ID: ${id}`,

    onboardRenter: ({
      apartmentComplex,
      email,
      id,
      apartmentId,
      isNewUser,
    }: {
      apartmentComplex: string;
      apartmentId: string;
      email: string;
      id: string;
      isNewUser: boolean;
    }) =>
      isNewUser
        ? `New Renter onboarded with  email: ${email} and ID: ${id} and assigned to the apartment ${apartmentId} of the Apartment Complex ${apartmentComplex}`
        : `Renter with email: ${email} and ID: ${id} is assigned to the apartment ${apartmentId} of the Apartment Complex ${apartmentComplex}`,
    offboardRenter: ({
      apartmentComplex,
      email,
      id,
      apartmentId,
    }: {
      apartmentComplex: string;
      apartmentId: string;
      email: string;
      id: string;
    }) =>
      `Renter with email: ${email} and ID: ${id} offboarded from the apartment ${apartmentId} of the Apartment Complex ${apartmentComplex}`,

    createCompanyEmployee: ({
      apartmentComplexName,
      email,
      apartmentComplexId,
      userId,
    }: {
      apartmentComplexName: string;
      email: string;
      apartmentComplexId: string;
      userId: string;
    }) =>
      `New Employee created for Apartment Complex: ${apartmentComplexName} (${apartmentComplexId}) with email: ${email} & ID: ${userId}`,
    createCompanyManager: ({
      apartmentComplexName,
      email,
      apartmentComplexId,
      userId,
    }: {
      apartmentComplexName: string;
      email: string;
      apartmentComplexId: string;
      userId: string;
    }) =>
      `New Manager created for Apartment Complex: ${apartmentComplexName} (${apartmentComplexId}) with email: ${email} & ID: ${userId}`,
    createTowCompanyEmployee: ({
      companyName,
      email,
      towCompanyId,
      userId,
    }: {
      companyName: string;
      email: string;
      towCompanyId: string;
      userId: string;
    }) => `Employee created for Tow Company: ${companyName} (${towCompanyId}) with email: ${email} & ID: ${userId} `,
    createTowCompanyManager: ({
      companyName,
      email,
      towCompanyId,
      userId,
    }: {
      companyName: string;
      email: string;
      towCompanyId: string;
      userId: string;
    }) => `Manager created for Tow Company: ${companyName} (${towCompanyId}) with email: ${email} & ID: ${userId} `,

    modifyUser: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account updated. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    deleteUser: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account deleted. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    assignRole: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `Role assigned. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${phoneNumber ? `Phone: ${phoneNumber}` : ''}`,
    modifyRole: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `Role modified. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${phoneNumber ? `Phone: ${phoneNumber}` : ''}`,
    deleteRole: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `Role deleted. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${phoneNumber ? `Phone: ${phoneNumber}` : ''}`,
    manageAccessPermissions: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `Access permissions updated. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    accountBlock: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account archived. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    accountUnblock: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account retrieved. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    accountSuspend: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account suspended. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    accountResumed: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account resumed. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    accountModification: (previousUser: any, req: any) => {
      return `User account updated. Modified fields: ${Object.keys(req)
        ?.map((userKey) => {
          if (userKey === 'company' || userKey === 'towCompany') {
            if (previousUser?.[userKey]?.companyName !== req?.[userKey].companyName) {
              return `company = {Old: ${previousUser?.[userKey].companyName}, New: ${req?.[userKey]?.companyName}}`;
            }
          } else {
            return req?.[userKey] === previousUser?.[userKey]
              ? null
              : `${userKey} = {Old: ${previousUser?.[userKey]}, New: ${req?.[userKey]}}`;
          }
          return null;
        })
        ?.filter((it) => it)
        .join(', ')}`;
    },
    requestPromoteDemote: (manager: IUserDoc, toPromoteuser: IUserDoc, status: 'Promote' | 'Demote') => {
      return `Manager Name: ${manager.fullName}, email: ${manager.fullName} ID: ${manager.id} requested to ${status} ${toPromoteuser.fullName}. User Details: Phone: ${toPromoteuser.phoneNumber}, Email: ${toPromoteuser.email} ID: ${toPromoteuser.id}`;
    },
    rejectRejectedPromoteDemote: (
      owner: IUserDoc,
      toPromoteuser: IUserDoc,
      status: 'Promote' | 'Demote',
      requestCreatedBy?: IUserDoc,
      isAccepted?: boolean
    ) => {
      return `${status} request ${isAccepted ? 'accepted' : 'rejected'} by Owner Name: ${owner.fullName}, Email: ${
        owner.email
      }, ID: ${owner.id} for ${toPromoteuser.fullName}. User Details: Phone: ${toPromoteuser.phoneNumber}, Email: ${
        toPromoteuser.email
      }, ID: ${toPromoteuser.id}. Request generated by: ${requestCreatedBy?.fullName || 'N/A'}, Email: ${
        requestCreatedBy?.email || 'N/A'
      }, ID: ${requestCreatedBy?.id || 'N/A'}.`;
    },

    promoteDemote: (user: IUserDoc) => {
      let actionLog = '';

      // Simplified for Faisal Ride - only admin and rider types
      switch (user.userType) {
        case 'admin':
          actionLog += `User promoted to Admin`;
          break;
        case 'rider':
          actionLog += `User set as Rider`;
          break;
        default:
          actionLog += `User role updated to ${user.userType}`;
          break;
      }
      actionLog += ` & User Id: ${user.id}`;

      return actionLog;
    },

    accountDeactivated: ({ fullName, phoneNumber, email }: IUserDoc) =>
      `User account deactivated due to email update (isVerified=false). Name: ${fullName}, ${
        email ? `Email: ${email}` : ''
      }, ${phoneNumber ? `Phone: ${phoneNumber}` : ''}`,
    emailChangesConfirmed: ({ email }: IUserDoc, { fullName, phoneNumber }: IUserDoc) =>
      `Email update successful. Account remains verified. Name: ${fullName}, ${email ? `Email: ${email}` : ''}, ${
        phoneNumber ? `Phone: ${phoneNumber}` : ''
      }`,
    accountRecovered: (user: IUserDoc) =>
      `User account successfully recovered. User Details: ${user.fullName}, Phone: ${user.phoneNumber}`,
    updateUserStatus: ({
      isSuspended,
      isArchived,
      userId,
    }: {
      isSuspended?: boolean;
      isArchived?: boolean;
      userId: string;
    }) => `User account ${isSuspended ? 'suspended' : isArchived ? 'archived' : 'updated'}. User ID: ${userId}`,
    bulkUpdateUserStatus: ({
      userIds,
      updatePayload,
    }: {
      userIds: string[];
      updatePayload: Pick<IUserDoc, 'isSuspended' | 'isArchived' | 'archiveReason' | 'suspendReason'>;
    }) => `Bulk update of user status. Users: ${userIds.join(', ')}, Update payload: ${JSON.stringify(updatePayload)}`,
  },

  AdminEvents: {
    addAdmin: (loggedInUser: IUserDoc, newAdmin: IUserDoc) =>
      `New admin added by ${loggedInUser.fullName}. New Admin Details: Name: ${newAdmin.fullName}, Email: ${newAdmin.email}, ID: ${newAdmin.id}.`,
    approvedParkingSpacesProviderUnpaid: (loggedInUser: IUserDoc, newUser: IUserDoc) =>
      `New Parking spaces provide (Unpaid) approved by ${loggedInUser.fullName}. Details: Name: ${newUser.fullName}, Email: ${newUser.email}, ID: ${newUser.id}.`,

    updateAdmin: (loggedInUser: IUserDoc, updatedAdmin: IUserDoc) =>
      `${loggedInUser.fullName} updated ${updatedAdmin.fullName} to ${
        updatedAdmin.isSuperAdmin ? 'Super Admin' : 'Normal Admin'
      }. Updated Admin Details: Email: ${updatedAdmin.email}, ID: ${updatedAdmin.id}.`,
  },

  userCommunication: {
    EmailSent: 'Email successfully sent to the user.',
    EmailSendingFailed: 'Email delivery failed.',
    SuccessAccountVerification: 'Account verification SMS sent successfully.',
    EmailSentViaKey: 'Email sent to user via API key.',
    ContactSupportEmail: (user: IUserDoc) => `Support email sent to ${user.userType} ${user.fullName}`,
    SMSSent: 'SMS successfully sent to the user.',
    SMSSentViaKey: 'SMS sent to user via API key.',
    generalMessage: 'User submitted a message.',
    failedMessage: 'SMS delivery to the user failed.',
  },

  clientEvents: {
    signUp: 'A new client has registered their account.',
    sentOtp: 'OTP sent to client’s phone number for verification.',
    verifiedAccount: 'Client verified phone number and account.',
    phoneAndPasswordLogin: 'Client successfully logged in via phone and password.',
    requestOtpForAccounVerification: 'Client requested OTP for account verification.',
    requestOtpForForPassword: 'Client requested OTP for password reset.',
    verifiedOtp: 'OTP verification successful. Password reset token sent to client.',
    resetPassword: 'Client successfully reset their password.',
    notVerifiedOtp: 'Client failed OTP verification for password reset.',
  },
  apartmentComplexCrud: {
    createApartmentComplex: ({
      apartmentComplexName,
      totalParkingSpaces,
      allowApartments,
      maxApartments,
      _id,
    }: IApartmentComplexDoc) =>
      `Created a new apartment complex. Name: ${apartmentComplexName}, Total Parking Spaces: ${totalParkingSpaces}, Allow Apartments: ${allowApartments}, Max Apartments: ${maxApartments}, Id: ${_id}`,
    deleteApartmentComplex: ({ apartmentComplexName, _id }: IApartmentComplexDoc) =>
      `Deleted an apartment complex. Name: ${apartmentComplexName}, Id: ${_id}`,
    updateApartmentComplex: ({
      apartmentComplexName,
      totalParkingSpaces,
      maxApartments,
      allowApartments,
      _id,
    }: IApartmentComplexDoc) =>
      `Updated an apartment complex. Name: ${apartmentComplexName}, Max Apartments: ${maxApartments}, Allow Apartments: ${allowApartments}, Total Parking Spaces: ${totalParkingSpaces}, Id: ${_id}`,
    addLicenseToApartmentComplex: ({ apartmentComplexName, _id }: IApartmentComplexDoc, licensePlate: { plate: string }[]) =>
      `Added a license plate to an apartment complex. Name: ${apartmentComplexName}, License Plate: ${licensePlate
        ?.map(({ plate }) => plate)
        .join(', ')} with Id: ${_id}`,
    removeLicenseFromApartmentComplex: ({ apartmentComplexName, _id }: IApartmentComplexDoc, licensePlate: string) =>
      `Removed a license plate from an apartment complex. Name: ${apartmentComplexName}, License Plate: ${licensePlate} with Id: ${_id}`,
    // ✅ NEW: Apartment Add/Remove Logs
    addApartmentToComplex: (apartmentComplexId: string, apartmentId: string, apartmentNumber: string | number) =>
      `Added a new apartment to Apartment Complex. Apartment Number: ${apartmentNumber}, Apartment Id: ${apartmentId}, Apartment Complex Id: ${apartmentComplexId}`,

    updateApartmentOfComplex: (
      apartmentComplexId: string,
      apartmentId: string,
      apartmentNumber: string | number,
      updatedBody: string
    ) =>
      `Updated an apartment in the Apartment Complex. Apartment Number: ${apartmentNumber}, Apartment Id: ${apartmentId}, Apartment Complex Id: ${apartmentComplexId}. Updates are ${JSON.stringify(
        updatedBody
      )}`,
    updateLicenseByRenter: (
      apartmentComplexId: string,
      apartmentId: string,
      apartmentNumber: string | number,
      licensePlate: string,
      updatedBy: string,
      status: 'new' | 'updated' | 'deleted' | 'attached'
    ) =>
      `Updated a license plate in the apartment. Apartment Number: ${apartmentNumber}, Apartment Id: ${apartmentId}, Apartment Complex Id: ${apartmentComplexId}. ${
        status === 'new' ? 'Added' : status === 'updated' ? 'Updated' : status === 'attached' ? 'Attached' : 'Deleted'
      } license plate: ${licensePlate} by ${updatedBy}`,

    removeApartmentFromComplex: (apartmentComplexId: string, apartmentId: string, apartmentNumber: string | number) =>
      `Removed an apartment from Apartment Complex. Apartment Number: ${apartmentNumber}, Apartment Id: ${apartmentId}, Apartment Complex Id: ${apartmentComplexId}`,

    // ✅ NEW: License Add/Remove to/from Apartment
    addLicenseToApartment: (
      apartmentComplexId: string,
      apartmentId: string,
      licensePlates: { plate: string; stateShort: string }[]
    ) =>
      `Added license plate(s) to apartment. Plates: ${licensePlates
        .map(({ plate, stateShort }) => `${plate} (${stateShort})`)
        .join(', ')}, Apartment Id: ${apartmentId}, Apartment Complex Id: ${apartmentComplexId}`,

    removeLicenseFromApartment: (apartmentComplexId: string, apartmentId: string, licensePlate: string) =>
      `Removed license plate from apartment. Plate: ${licensePlate}, Apartment Id: ${apartmentId}, Apartment Complex Id: ${apartmentComplexId}`,

    updateOccupant: (
      ownerId: string,
      occupantId: string,
      update: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
        relation?: string;
        apartmentComplex?: string;
        apartmentId?: string;
      }
    ) => `Updated an occupant. Occupant Id: ${occupantId}, Renter Id: ${ownerId}. Updates are ${JSON.stringify(update)}`,

    attachOccupant: (
      ownerId: string,
      occupantId: string,
      update: {
        apartmentComplex?: string;
        apartmentId?: string;
      }
    ) =>
      `Occupant attached to new apartment. Occupant Id: ${occupantId}, Renter Id: ${ownerId} is attached to new Apartment with Apartment Complex Id: ${update.apartmentComplex}, Apartment Id: ${update.apartmentId}.`,
    deleteOccupant: (ownerId: string, occupantId: string, apartmentComplex: string, apartmentId: string) =>
      `Delete an occupant from the apartment complex ID: ${apartmentComplex}, apartment ID: ${apartmentId}.. Occupant Id: ${occupantId}, Renter Id: ${ownerId}`,
    detachOccupant: (ownerId: string, occupantId: string, apartmentComplex: string, apartmentId: string) =>
      `Detached an occupant from the apartment complex ID: ${apartmentComplex}, apartment ID: ${apartmentId}.. Occupant Id: ${occupantId}, Renter Id: ${ownerId}`,
    createOccupant: (
      ownerId: string,
      occupant: {
        firstName: string;
        lastName: string;
        email?: string;
        phoneNumber?: string;
        relation?: string;
        apartmentComplex: string;
        apartmentId: string;
      }
    ) =>
      `Created a new occupant for the apartment complex ID: ${occupant.apartmentComplex}, apartment ID: ${
        occupant.apartmentId
      }. Occupant Details: ${JSON.stringify(occupant)}, Renter Id: ${ownerId}`,
  },
};
