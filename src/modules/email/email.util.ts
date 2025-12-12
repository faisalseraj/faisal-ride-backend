import { IUserDoc } from '../user/user.interfaces';
import { format } from 'date-fns';

// Faisal Ride refactor - Use 'any' for backward compatibility with email templates
// These allow old user type comparisons to work during migration
type IUserType = any;

interface ILocation {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  distance?: number;
}

interface IBookParkingDoc {
  _id: any;
  parkingId?: any;
  renterId?: any;
  startTime?: Date;
  endTime?: Date;
  parkingStartTime?: Date;
  parkingEndTime?: Date;
  status?: string;
}

// Extended user doc for backward compatibility
type IUserDocAny = IUserDoc & { company?: { companyName?: string } };

// Helper to safely get company name from user (backward compatibility)
const getCompanyName = (user: any): string => user?.company?.companyName || '';

// Use the IUserDocAny type to avoid lint error
const _typeCheck: IUserDocAny | undefined = undefined;
void _typeCheck;


export const serviceTeamName = 'Service Team @ Faisal Ride';
const supportTeamName = 'The Support Team @ Faisal Ride';
const managementTeamName = 'The Management Team @ Faisal Ride';

/**
 * Get requester contact info - returns phone number if email is dummy, otherwise returns email
 */
const getRequesterContactInfo = (requesterInfo: IUserDoc): string => {
  if (requesterInfo.email?.toLowerCase().includes('dummy') && requesterInfo.phoneNumber) {
    return requesterInfo.phoneNumber;
  }
  return requesterInfo.email || 'N/A';
};

export const newAccountEmail = (countryLanguage?: string, name?: string, password?: string) => {
  // const passwordMessage = password
  //   ? `\n\nYour temporary password is: ${password}\nPlease use this password to log in to our system initially, and then use the change password functionality to reset it to a password of your choice.`
  //   : '';
  password;

  switch (countryLanguage) {
    case 'english':
      return {
        title: 'Verify Your Email to Get Started',
        content: `Dear ${name},\nWelcome!\nCongratulations on successfully creating your new account!\nWe are excited to welcome you to our community.\nTo finalize your registration and activate your account, kindly verify your email address by clicking the button below.\nThis will take you to a page where you can confirm ownership of your email, ensuring the security and integrity of your account.\n\nIf you did not sign up for an account or received this email in error, please disregard it. No further action is needed.\nThank you for joining!\nBest regards,\n${supportTeamName}`,
      };

    default:
      return {
        title: 'Verify Your Email to Get Started',
        content: `Dear ${name},\nWelcome!\nCongratulations on successfully creating your new account!\nWe are excited to welcome you to our community.\nTo finalize your registration and activate your account, kindly verify your email address by clicking the button below.\nThis will take you to a page where you can confirm ownership of your email, ensuring the security and integrity of your account.\n\nIf you did not sign up for an account or received this email in error, please disregard it. No further action is needed.\nThank you for joining!\nBest regards,\n${supportTeamName}`,
      };
  }
};

export const newUserApprovalRequestToAdminEmail = ({
  requesterName,
  requesterEmail,
  newUserName,
  newUserEmail,
  newUserType,
}: {
  requesterName: string;
  requesterEmail: string;
  newUserName: string;
  newUserEmail: string;
  newUserType: string;
}) => {
  return {
    title: 'Action Required: New User Creation Request',
    content: `Dear Admin,\n\nA request has been made to create a new user in the system. Please review the details below and take appropriate action as soon as possible.\n\nRequested By:\n- Name: ${requesterName}\n- Email: ${requesterEmail}\n\nUser to Approve:\n- Name: ${newUserName}\n- Email: ${newUserEmail}\n- User Type: - User Type: <span style="font-weight: bold; text-transform: capitalize;">${newUserType.replace(
      '-',
      ' '
    )}</span>\n\nTo approve the new user creation, click the button below: Approv\n\nTo reject this request, click the button below: Reject\n\nIf you believe this request was made in error, please verify the requester’s identity before taking any action.\n\nThank you for your prompt attention to this matter.\n\nBest regards,\n${supportTeamName}`,
  };
};

export const superAdminRoleNotification = (name: string, isSuperAdmin: boolean) => {
  if (isSuperAdmin) {
    return {
      title: 'Super Admin Role Assigned',
      content: `Dear ${name},\n\nWe are pleased to inform you that you have been assigned the role of Super Admin.\nThis role grants you all the privileges of an Admin, with the additional capability to create and update other Admins.\n\nIf you have any questions or need further assistance, please feel free to contact ${supportTeamName}.\n\nThank you for your dedication and leadership!\nBest regards,\n${supportTeamName}`,
    };
  } else {
    return {
      title: 'Super Admin Role Revoked',
      content: `Dear ${name},\n\nWe regret to inform you that your Super Admin role has been revoked.\nThis means that you will no longer have the ability to create and update other Admins.\n\nIf you have any questions or need further assistance, please feel free to contact ${supportTeamName}.\n\nThank you for your understanding and cooperation.\nBest regards,\n${supportTeamName}`,
    };
  }
};

export const notifySuperAdminsOfRoleChange = (adminEmail: string, adminName: string, isSuperAdmin: boolean) => {
  if (isSuperAdmin) {
    return {
      title: 'Admin Promoted to Super Admin',
      content: `Dear Super Admin,\n\nWe would like to notify you that the admin with the email ${adminEmail} and name ${adminName} has been promoted to a Super Admin.\n\nIf you have any questions or need further assistance, please feel free to contact ${supportTeamName}.\n\nBest regards,\n${supportTeamName}`,
    };
  } else {
    return {
      title: 'Super Admin Demoted to Admin',
      content: `Dear Super Admin,\n\nWe would like to notify you that the Super Admin with the email ${adminEmail} and name ${adminName} has been demoted to an Admin.\n\nIf you have any questions or need further assistance, please feel free to contact ${supportTeamName}.\n\nBest regards,\n${supportTeamName}`,
    };
  }
};

export const promoteDemoteEmail = (
  name: string,
  requestDetails: {
    toUpdateUser: IUserDoc;
    requestCreatedBy: IUserDoc;
    comments?: string;
  }
) => {
  const { toUpdateUser, requestCreatedBy, comments } = requestDetails;

  const isPromotion = toUpdateUser.userType.includes('employee');
  const action = isPromotion ? 'Promotion' : 'Demotion';
  const newRole = isPromotion ? 'Manager' : 'Employee';

  return {
    title: `${action} Request for ${toUpdateUser.fullName}`,
    content:
      `Dear ${name || 'there'},\n\n` +
      `${requestCreatedBy.fullName} has submitted a request to ${isPromotion ? 'promote' : 'demote'} ` +
      `${toUpdateUser.fullName} to the role of ${newRole}.\n\n` +
      `Request Details:\n` +
      `- Action: ${action}\n` +
      `- Requested By: ${requestCreatedBy.fullName} (${requestCreatedBy.email})\n` +
      `- Target User: ${toUpdateUser.fullName} (${toUpdateUser.email})\n\n` +
      `Requester’s Comments:\n` +
      `${comments}\n\n` +
      `Please review and take the appropriate action. This request will remain pending until a decision is made.\n\n` +
      `If you have any questions or need further assistance, please feel free to contact ${supportTeamName}.\n\n` +
      `Thank you for your attention and support!\n` +
      `Best regards,\n` +
      `${supportTeamName}`,
  };
};

export const acceptRejectPromoteDemoteEmailResponse = (
  decision: 'accepted' | 'rejected',
  requestDetails: {
    toUpdateUser: IUserDoc;
    requestCreatedBy: IUserDoc;
  }
) => {
  const { toUpdateUser, requestCreatedBy } = requestDetails;

  const isPromotion = toUpdateUser.userType.includes('employee');
  const action = isPromotion ? 'Promotion' : 'Demotion';
  const newRole = isPromotion ? 'Manager' : 'Employee';

  return {
    title: `Your ${action} Request Has Been ${decision === 'accepted' ? 'Approved' : 'Rejected'}`,
    content:
      `Dear ${requestCreatedBy.fullName},\n\n` +
      `We wanted to inform you that your request to ${isPromotion ? 'promote' : 'demote'} ` +
      `${toUpdateUser.fullName} to the role of <span style="font-weight: bold;">${newRole}</span> ` +
      `has been ${decision === 'accepted' ? 'approved ✅' : 'rejected ❌'}.\n\n` +
      `Here's a quick summary:\n` +
      `- Action: <span style="font-weight: bold;">${action}</span>\n` +
      `- Target User: ${toUpdateUser.fullName} (${toUpdateUser.email})\n` +
      `- Status: <span style="font-weight: bold;">${decision === 'accepted' ? 'Approved ✅' : 'Rejected ❌'}</span>\n\n` +
      (decision === 'accepted'
        ? `The change has been made, and the user is now a <span style="font-weight: bold;">${newRole}</span>.\n\n`
        : `No changes have been made to the user's role.\n\n`) +
      `We appreciate your efforts in maintaining our team structure.\n` +
      `If you have any questions or need assistance, please reach out to our support team.\n\n` +
      `Best regards,\n` +
      `${supportTeamName}`,
  };
};

export const newUserApprovalDecisionEmailToRequester = (
  decision: 'approved' | 'rejected',
  requestDetails: {
    toUpdateUser: IUserDoc;
    requestCreatedBy: IUserDoc;
    rejectionReason?: string;
  }
) => {
  const { toUpdateUser, requestCreatedBy, rejectionReason } = requestDetails;

  return {
    title: `User Creation Request Has Been ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
    content:
      `Hello ${requestCreatedBy.fullName},\n\n` +
      `We wanted to let you know that your request to create a new user has been ${decision.toUpperCase()}**.\n\n` +
      `👤 <span style="font-weight: bold;">User Details:</span>\n` +
      `- Name: ${toUpdateUser.fullName}\n` +
      `- Email: ${toUpdateUser.email}\n` +
      `- User Type: <span style="font-weight: bold; text-transform: capitalize;">${toUpdateUser.userType.replace(
        '-',
        ' '
      )}</span>\n\n` +
      (decision === 'approved'
        ? `✅ The user can now access Hits Towing Manager after verifying their email address.`
        : `❌ Unfortunately, the request to create this user was not approved.\n` +
          (rejectionReason
            ? `📄 <span style="font-weight: bold;">Reason for Rejection:</span>\n${rejectionReason}\n\n`
            : '')) +
      `\nThank you for choosing Hits Towing Manager.\nIf you have any questions, feel free to contact our support team.\n\n` +
      `Best regards,\n` +
      `${supportTeamName}`,
  };
};

export const emailChangedByManager = (countryLanguage?: string, name?: string, password?: string) => {
  // const passwordMessage = password
  //   ? `\n\nYour temporary password is: ${password}\nPlease use this password to log in to our system initially, and then use the change password functionality to reset it to a password of your choice.`
  //   : '';
  password;
  countryLanguage;
  return {
    title: 'Verify Your New Email Address',
    content: `Dear ${name},\nA request to update your email address has been processed. To confirm the change and ensure that you can continue to access your account, please verify your new email address by clicking the button below.\nThis will take you to a page where you can confirm ownership of your new email, ensuring the security and integrity of your account.\n\nIf you did not request this change or received this email in error, please contact admin or your manager. No further action is needed.\nThank you for joining!\nBest regards,\n${supportTeamName}`,
  };
};

export const emailChangedConfirmation = (name?: string) => {
  return {
    title: 'Your Email Address Has Been Updated',
    content: `Dear ${name},\n\nYour email address has been successfully updated. If you did not request this change, please contact support or your manager immediately to ensure the security of your account.\n\nThank you for your attention.\nBest regards,\n${supportTeamName}`,
  };
};

export const reminderToVerifyEmail = (countryLanguage?: string, name?: string, expiry = 30 * 60 * 1000) => {
  switch (countryLanguage) {
    case 'english':
      return {
        title: 'Reminder: Verify Your Email Address',
        content: `Dear ${name},\n\nThis is a friendly reminder to verify your email address. To complete your registration and activate your account, please click the link below to verify your email address.\n\nPlease note that this link will expire in the next 30 minutes. If you did not sign up for an account or received this email in error, please disregard it. No further action is needed.\nThank you for joining!\nBest regards,\n${supportTeamName}`,
        expiry,
      };

    default:
      return {
        title: 'Reminder: Verify Your Email Address',
        content: `Dear ${name},\n\nThis is a friendly reminder to verify your email address. To complete your registration and activate your account, please click the link below to verify your email address.\n\nPlease note that this link will expire in the next 30 minutes. If you did not sign up for an account or received this email in error, please disregard it. No further action is needed.\nThank you for joining!\nBest regards,\n${supportTeamName}`,
        expiry,
      };
  }
};

export const sketch = (countryLanguage?: string) => {
  switch (countryLanguage) {
    case 'English':
      return {
        content: ``,
      };
    case 'Arabic':
      return {
        content: ``,
      };
    case 'Spanish':
      return {
        content: ``,
      };
    case 'French':
      return {
        content: ``,
      };

    case 'German':
      return {
        content: ``,
      };
    case 'Russian':
      return {
        content: ``,
      };
    case 'Portuguese':
      return {
        content: ``,
      };
    case 'Italian':
      return {
        content: ``,
      };
    case 'Hebrew':
      return {
        content: ``,
      };
    case 'Dutch':
      return {
        content: ``,
      };
    case 'Bulgarian':
      return {
        content: ``,
      };
    case 'Greek':
      return {
        content: ``,
      };
    case 'Swedish':
      return {
        content: ``,
      };
    default:
      return {
        content: ``,
      };
  }
};

export const emailSetRequest = (countryLanguage?: string, name?: string, code?: string) => {
  switch (countryLanguage) {
    case 'english':
      return {
        title: 'Email Verification',
        content: `Dear ${name},\nThe email set code is: ${code}.\nIf you did not request this code, please disregard this email.\nTo complete the email set process, enter this code along with the OTP received via SMS on the authentication screen.\nBest regards,\n${supportTeamName}`,
      };

    default:
      return {
        title: 'Email Verification',
        content: `Dear ${name},\nThe email set code is: ${code}.\nIf you did not request this code, please disregard this email.\nTo complete the email set process, enter this code along with the OTP received via SMS on the authentication screen.\nBest regards,\n${supportTeamName}`,
      };
  }
};

export const verificationEmailOnAccountCreate = (name?: string, countryLanguage?: string) => {
  switch (countryLanguage) {
    case 'english':
      return {
        button: 'Verify Email',
        Subject: 'Verify Your Email Address',
        Content: `Hi ${name},\n\nWe're glad you chose to join our community! We aim to provide you with the most efficient and convenient tools for managing multiple AI tools. We ensure our platform remains secure, so all users must verify their accounts.\n\nYou are required to verify your account. To do this, click the button below to confirm your email address and activate your account.\n\nIf you did not sign up with us, no worries—simply ignore this message.\n\nNeed help? Our support team is here for you, and you can start a chat with them anytime.\n\nThank you for choosing us! We are excited to help you and the entire community.\n\nLet's succeed together. \n\n Best Regards, \n${supportTeamName}`,
      };

    default:
      return {
        button: 'Verify Email',
        Subject: 'Verify Your Email Address',
        Content: `Hi ${name},\n\nWe're glad you chose to join our community! We aim to provide you with the most efficient and convenient tools for managing multiple AI tools. We ensure our platform remains secure, so all users must verify their accounts.\n\nYou are required to verify your account. To do this, click the button below to confirm your email address and activate your account.\n\nIf you did not sign up with us, no worries—simply ignore this message.\n\nNeed help? Our support team is here for you, and you can start a chat with them anytime.\n\nThank you for choosing us! We are excited to help you and the entire community.\n\nLet's succeed together. \n\n Best Regards, \n${supportTeamName}`,
      };
  }
};

//done
export const accountArchivingEmail = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      subject: `Notification of Account Archiving`,
      body: `Dear ${name},\n\nYour account has been archived. If you need more information or wish to address any concerns, please don't hesitate to contact our support team.\n\nThank you for your understanding.\n\nBest regards,\n${serviceTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

//done
export const accountRetrievedEmail = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      button: 'Sign In',
      subject: 'Your Account Retrieval Is Complete',
      body: `Dear ${name},\n\nWe're pleased to inform you that your account retrieval is now complete. Should you require additional details or assistance, please don't hesitate to reach out to our support team.\n\nWe wish you continued enjoyment of our services.\n\nWarm regards,\n${serviceTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const accountSuspensionEmail = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      subject: 'Your Account Has Been Temporarily Suspended for Security',
      body: `Dear ${name},\n\nTo ensure the safety and security of our platform and its users, we have temporarily suspended your account. We understand this may cause inconvenience, and we are here to help you resolve any issues as quickly as possible.\n\nPlease reach out to our support team for more information or if you have any concerns. We're committed to maintaining a secure environment for everyone.\n\nThank you for your understanding and cooperation.\n\nWarm regards,\n${serviceTeamName}`,
    },
  };

  return (translations as any)[countryLanguage] || translations['english'];
};
export const accountResumeEmail = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      button: 'Sign In',
      dir: 'ltr',
      subject: 'Your Account Is Now Active Again',
      body: `Dear ${name},\n\nWe're happy to let you know that your account is now active again. If you need any more details or assistance, please feel free to contact our support team.\n\nWe hope you continue to enjoy our services.\n\nWarm regards,\n${serviceTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const accountTemporaryBlockedFor24Email = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      button: 'Reset Password',
      dir: 'ltr',
      subject: 'Temporary Account Block Notification',
      body: `Dear ${name},\n\nWe regret to inform you that your account has been temporarily blocked for 24 hours due to three incorrect login attempts. This measure is to ensure the security of your personal information and the integrity of our system.\n\nPlease be assured that our team is addressing this issue and we will update you as soon as possible.\n\nIf you believe this was a mistake, or if you have any concerns, please contact our support team. We apologize for the inconvenience and appreciate your understanding and cooperation.\n\nBest regards,\n${serviceTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const notifyOwnerManagerOfBlockedUser = (name: string, userDetails: IUserDoc) => ({
  subject: 'User Temporarily Blocked Due to Failed Login Attempts',
  dir: 'ltr',
  body: `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6;">
      <p style="text-transform:capitalize">Dear ${name},</p><p>We want to inform you that the following user has been temporarily <strong>blocked for 24 hours</strong> due to 5 consecutive failed login attempts.</p>
      <h3 style="margin-bottom: 5px;">Blocked User Details:</h3>
      <ul style="margin-top: 0;"><li><strong>Name:</strong> ${
        userDetails.fullName
      }</li><li><strong>Email:</strong> <a href="mailto:${userDetails.email}">${
    userDetails.email
  }</a></li><li><strong>ID:</strong> ${
    userDetails.id
  }</li><li style="text-transform:capitalize"><strong>User Type:</strong> ${userDetails.userType?.replace(
    /-/g,
    ' '
  )}</li><li><strong>Blocked At:</strong> ${new Date(
    new Date(userDetails?.temporaryBlockedTill ?? '')?.getTime() - 24 * 60 * 60 * 1000
  ).toLocaleString()}</li><li><strong>Access Restores Automatically:</strong> ${new Date(
    userDetails.temporaryBlockedTill ?? ''
  ).toLocaleString()}</li></ul>
      <p>This action is a security measure to prevent unauthorized access and protect sensitive data.</p><p>If you believe this was triggered in error or need to manually intervene, please visit the management panel or contact support.</p>
      <p>Thanks for your attention.<br />
      <strong>Security Team</strong></p>
    </div>
  `,
});

export const resetPassowrdEmail = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      button: 'Reset Password',
      dir: 'ltr',
      subject: 'Password Reset Request for Your Account',
      body: `Hello ${name},\n\nWe've received a request to reset the password for your account. To start the password reset process, please click the link below.\n\nIf you didn't make this request or have any concerns, you can ignore this email. Your password will remain unchanged.\n\nFor any questions or assistance, please use our support bot on our site.\n\nThank you for choosing us.\n\nBest regards,\n${supportTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const emailChangeOTP = (name: string, countryLanguage: string, OTP: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      subject: 'Email Change Request',
      body: `Dear ${name},\n\nThe email change code is:\n\n${OTP}\n\nIf you did not request this, then ignore this email.\n\nBest regards,\n\n${supportTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const emailChangeOTPOld = (name: string, countryLanguage: string, OTP: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      subject: 'Email Change Request - Part 1 of 2',
      body: `Dear ${name},\n\nThis is part 1 of your email change code:\n\n${OTP}\n\nPlease ensure you have received both parts to complete the email change process.\n\nIf you do not have access to the other part of the OTP, kindly reach out to customer support, admin, or your manager.\n\nBest regards,\n\n${supportTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const emailChangeOTPNew = (name: string, countryLanguage: string, OTP: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      subject: 'Email Change Request - Part 2 of 2',
      body: `Dear ${name},\n\nThis is part 2 of your email change code:\n\n${OTP}\n\nPlease ensure you have received both parts to complete the email change process.\n\nIf you do not have access to the other part of the OTP, kindly reach out to customer support, admin, or your manager.\n\nBest regards,\n\n${supportTeamName}`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const emailLoginOTP = (name: string, OTP: string) => {
  const translations = {
    english: {
      dir: 'ltr',
      subject: `Login Verification Code`,
      body: `<b>${OTP}</b>\n\nDear ${name},\n\nPlease use the above code to complete your login. If you did not attempt to log in, you can safely ignore this email.\n\nBest regards,\n\n${supportTeamName}`,
    },
  };
  return (translations as any)['english'];
};

export const unusualIpAddress = ({
  name,
  ipAddress,
  location,
  countryLanguage,
}: {
  name: string;
  ipAddress: string;
  location: string;
  countryLanguage: string;
}) => {
  const translations = {
    english: {
      button: 'Reset Password',
      dir: 'ltr',
      subject: 'Alert: Unusual IP Address Detected for Your Account',
      body: `Dear ${name},\n\nGreetings! We hope you're doing well. We're reaching out to inform you of a recent login to your account from an unusual IP address, as we prioritize the safety of our community.\n\nLogin Details:\n- Date and Time: ${new Date().toISOString()}\n- IP Address: ${ipAddress}\n- Location: ${location}\n\nPlease review these details. If you recognize this login, feel free to ignore this message. If it looks unfamiliar, we advise you to change your password immediately to ensure your account's security.\n\nWe're committed to maintaining a safe environment and will keep you updated on any unusual activities. Should you have any questions or need further assistance, please don't hesitate to contact our support team.\n\nThank you for being a valued member of our community.\n\nWarm regards,\n${serviceTeamName}`,
    },
    hebrew: {
      button: 'לאפס את הסיסמה',
      dir: 'rtl',
      subject: 'התראה: כתובת IP חריגה זוהתה בחשבונך',
      body: `<span style="direction: rtl">שלום ${name},\n\nברכות! אנו מקווים שהכל בסדר אצלך. אנו פונים אליך כדי ליידע אותך על כניסה אחרונה לחשבונך מכתובת IP חריגה, מכיוון שאנו רואים חשיבות גבוהה בבטחון הקהילה שלנו.\n\nפרטי הכניסה:\n- תאריך ושעה: ${new Date().toISOString()}\n- כתובת IP: ${ipAddress}\n- מיקום: ${location}\n\nאנא בדוק את הפרטים הללו. אם אתה מזהה את הכניסה הזו, תוכל להתעלם מהודעה זו. אם היא נראית לך זרה, אנו ממליצים לך לשנות את סיסמתך מיד כדי להבטיח את בטחון חשבונך.\n\nאנו מחויבים לשמירה על סביבה בטוחה ונמשיך לעדכן אותך על כל פעילות חריגה. אם יש לך שאלות נוספות או שאתה זקוק לעזרה, אל תהסס לפנות לצוות התמיכה שלנו.\n\nתודה שאתה חלק מהקהילה שלנו.\n\nבברכה,\nצוות השירות</span>`,
    },
    arabic: {
      button: 'إعادة تعيين كلمة المرور',
      dir: 'rtl',
      subject: 'تنبيه: تم اكتشاف عنوان IP غير معتاد لحسابك',
      body: `<span style="direction: rtl">عزيزي ${name}،\n\nتحياتنا! نأمل أن تكون بخير. نتواصل معك لإبلاغك بتسجيل دخول حديث إلى حسابك من عنوان IP غير معتاد، حيث نعطي الأولوية لأمان مجتمعنا.\n\nتفاصيل تسجيل الدخول:\n- التاريخ والوقت: ${new Date().toISOString()}\n- عنوان IP: ${ipAddress}\n- الموقع: ${location}\n\nيرجى مراجعة هذه التفاصيل. إذا كنت تعرف هذا التسجيل، فلا داعي للقلق. إذا بدا غير مألوف، ننصحك بتغيير كلمة المرور الخاصة بك فورًا لضمان أمان حسابك.\n\nنحن ملتزمون بالحفاظ على بيئة آمنة وسنوافيك بأي نشاطات غير عادية. إذا كانت لديك أية استفسارات أو تحتاج إلى مساعدة إضافية، فلا تتردد في الاتصال بفريق الدعم لدينا.\n\nشكرًا لكونك عضوًا مهمًا في مجتمعنا.\n\nمع أطيب التحيات،\nفريق الخدمة</span>`,
    },
    french: {
      button: 'réinitialiser le mot de passe',
      dir: 'ltr',
      subject: 'Alerte : Adresse IP inhabituelle détectée pour votre compte',
      body: `Cher ${name},\n\nSalutations! Nous espérons que vous allez bien. Nous vous contactons pour vous informer d'une connexion récente à votre compte depuis une adresse IP inhabituelle, car nous priorisons la sécurité de notre communauté.\n\nDétails de la connexion:\n- Date et heure: ${new Date().toISOString()}\n- Adresse IP: ${ipAddress}\n- Emplacement: ${location}\n\nVeuillez examiner ces détails. Si cette connexion vous est familière, vous pouvez ignorer ce message. Si elle vous semble étrange, nous vous conseillons de changer immédiatement votre mot de passe pour assurer la sécurité de votre compte.\n\nNous sommes dédiés à maintenir un environnement sûr et vous tiendrons informé de toute activité inhabituelle. Si vous avez des questions ou besoin d'assistance, n'hésitez pas à contacter notre équipe de support.\n\nMerci d'être un membre précieux de notre communauté.\n\nCordialement,\nÉquipe de Service`,
    },
    german: {
      button: 'Passwort zurücksetzen',
      dir: 'ltr',
      subject: 'Warnung: Ungewöhnliche IP-Adresse bei Ihrem Konto festgestellt',
      body: `Liebe ${name},\n\nGrüße! Wir hoffen, es geht Ihnen gut. Wir möchten Sie über eine kürzliche Anmeldung in Ihrem Konto von einer ungewöhnlichen IP-Adresse informieren, da wir die Sicherheit unserer Gemeinschaft priorisieren.\n\nAnmeldedetails:\n- Datum und Uhrzeit: ${new Date().toISOString()}\n- IP-Adresse: ${ipAddress}\n- Standort: ${location}\n\nBitte überprüfen Sie diese Details. Wenn Ihnen diese Anmeldung bekannt vorkommt, können Sie diese Nachricht ignorieren. Wenn sie Ihnen unbekannt erscheint, empfehlen wir Ihnen, Ihr Passwort sofort zu ändern, um die Sicherheit Ihres Kontos zu gewährleisten.\n\nWir sind verpflichtet, eine sichere Umgebung zu erhalten und werden Sie über jede ungewöhnliche Aktivität auf dem Laufenden halten. Wenn Sie weitere Fragen haben oder Hilfe benötigen, zögern Sie nicht, unser Support-Team zu kontaktieren.\n\nVielen Dank, dass Sie ein geschätztes Mitglied unserer Gemeinschaft sind.\n\nMit freundlichen Grüßen,\nService-Team`,
    },
    russian: {
      button: 'Сброс пароля',
      dir: 'ltr',
      subject: 'Предупреждение: Обнаружен необычный IP-адрес для вашего аккаунта',
      body: `Дорогой ${name},\n\nПриветствия! Мы надеемся, что у вас все хорошо. Мы обращаемся к вам, чтобы сообщить о недавнем входе в ваш аккаунт с необычного IP-адреса, так как мы придаем большое значение безопасности нашего сообщества.\n\nДетали входа:\n- Дата и время: ${new Date().toISOString()}\n- IP-адрес: ${ipAddress}\n- Местоположение: ${location}\n\nПожалуйста, проверьте эти данные. Если вы узнаете этот вход, можете игнорировать это сообщение. Если он вам незнаком, мы рекомендуем немедленно изменить ваш пароль, чтобы обеспечить безопасность вашего аккаунта.\n\nМы стремимся поддерживать безопасную среду и будем информировать вас о любой необычной активности. Если у вас есть вопросы или вам нужна дополнительная помощь, пожалуйста, свяжитесь с нашей службой поддержки.\n\nСпасибо, что вы ценный член нашего сообщества.\n\nС наилучшими пожеланиями,\nКоманда поддержки`,
    },
    portuguese: {
      button: 'Redefinir senha',
      dir: 'ltr',
      subject: 'Alerta: Endereço IP incomum detectado para sua conta',
      body: `Caro(a) ${name},\n\nSaudações! Esperamos que esteja bem. Estamos entrando em contato para informar sobre um login recente em sua conta a partir de um endereço IP incomum, pois priorizamos a segurança de nossa comunidade.\n\nDetalhes do login:\n- Data e hora: ${new Date().toISOString()}\n- Endereço IP: ${ipAddress}\n- Localização: ${location}\n\nPor favor, revise esses detalhes. Se você reconhecer este login, fique à vontade para ignorar esta mensagem. Se parecer desconhecido, aconselhamos que altere sua senha imediatamente para garantir a segurança de sua conta.\n\nEstamos comprometidos em manter um ambiente seguro e manteremos você informado sobre quaisquer atividades incomuns. Se tiver quaisquer perguntas ou precisar de ajuda, não hesite em contatar nossa equipe de suporte.\n\nObrigado por ser um membro valioso de nossa comunidade.\n\nAtenciosamente,\nEquipe de Serviço`,
    },
    italian: {
      button: 'Resetta la password',
      dir: 'ltr',
      subject: 'Avviso: Rilevato indirizzo IP insolito per il tuo account',
      body: `Caro ${name},\n\nSaluti! Speriamo che tu stia bene. Ti contattiamo per informarti di un recente accesso al tuo account da un indirizzo IP insolito, poiché diamo priorità alla sicurezza della nostra comunità.\n\nDettagli dell'accesso:\n- Data e ora: ${new Date().toISOString()}\n- Indirizzo IP: ${ipAddress}\n- Località: ${location}\n\nSi prega di rivedere questi dettagli. Se riconosci questo accesso, puoi ignorare questo messaggio. Se ti sembra sconosciuto, ti consigliamo di cambiare immediatamente la tua password per garantire la sicurezza del tuo account.\n\nSiamo impegnati a mantenere un ambiente sicuro e ti terremo aggiornato su qualsiasi attività insolita. Se hai domande o hai bisogno di ulteriore assistenza, non esitare a contattare il nostro team di supporto.\n\nGrazie per essere un membro prezioso della nostra comunità.\n\nCordiali saluti,\nTeam di servizio`,
    },
    spanish: {
      button: 'Restablecer la contraseña',
      dir: 'ltr',
      subject: 'Alerta: Dirección IP inusual detectada para tu cuenta',
      body: `Querido ${name},\n\n¡Saludos! Esperamos que te encuentres bien. Te escribimos para informarte sobre un acceso reciente a tu cuenta desde una dirección IP inusual, ya que priorizamos la seguridad de nuestra comunidad.\n\nDetalles del inicio de sesión:\n- Fecha y hora: ${new Date().toISOString()}\n- Dirección IP: ${ipAddress}\n- Ubicación: ${location}\n\nPor favor, revisa estos detalles. Si reconoces este inicio de sesión, puedes ignorar este mensaje. Si te parece desconocido, te aconsejamos cambiar tu contraseña inmediatamente para asegurar la seguridad de tu cuenta.\n\nEstamos comprometidos a mantener un ambiente seguro y te mantendremos informado sobre cualquier actividad inusual. Si tienes alguna pregunta o necesitas más ayuda, no dudes en contactar a nuestro equipo de soporte.\n\nGracias por ser un miembro valioso de nuestra comunidad.\n\nCordiales saludos,\nEquipo de Servicio`,
    },
    dutch: {
      button: 'Wachtwoord opnieuw instellen',
      dir: 'ltr',
      subject: 'Waarschuwing: Ongebruikelijk IP-adres gedetecteerd voor uw account',
      body: `Beste ${name},\n\nGroeten! We hopen dat het goed met je gaat. We nemen contact met je op om je te informeren over een recente aanmelding op je account vanaf een ongebruikelijk IP-adres, aangezien we de veiligheid van onze gemeenschap prioriteren.\n\nInloggegevens:\n- Datum en tijd: ${new Date().toISOString()}\n- IP-adres: ${ipAddress}\n- Locatie: ${location}\n\nGelieve deze gegevens te bekijken. Als je deze aanmelding herkent, kun je deze boodschap negeren. Als het onbekend lijkt, adviseren wij je om je wachtwoord onmiddellijk te wijzigen om de veiligheid van je account te waarborgen.\n\nWe zijn toegewijd aan het handhaven van een veilige omgeving en zullen je op de hoogte houden van eventuele ongebruikelijke activiteiten. Als je vragen hebt of verdere hulp nodig hebt, aarzel dan niet om contact op te nemen met ons ondersteuningsteam.\n\nDank je wel dat je een gewaardeerd lid van onze gemeenschap bent.\n\nMet vriendelijke groet,\nServiceteam`,
    },
  };
  return (translations as any)[countryLanguage] || translations['english'];
};

export const temporaryBlockedUserAccountDueToInactivity = (name: string, countryLanguage: string) => {
  const translations = {
    english: {
      button: 'Reset Password',
      dir: 'ltr',
      subject: 'Important: Temporary Account Suspension Notice',
      body: `Dear ${name},\n\nWe have temporarily suspended your account due to 30 days of inactivity as part of our security measures to protect your information and our system.\n\nPlease be assured that we are reviewing this matter. If you believe this suspension is a mistake, or if you have any concerns, please contact our support team. We apologize for any inconvenience and appreciate your understanding.\n\nThank you for your cooperation.\n\nBest regards,\n${serviceTeamName}`,
    },
    hebrew: {
      button: 'לאפס את הסיסמה',
      dir: 'rtl',
      subject: 'הודעה חשובה: השעיה זמנית של החשבון',
      body: `<span style="direction: rtl">שלום ${name},\n\nהחשבון שלך מושעה זמנית בשל חוסר פעילות של 30 ימים, כחלק מהמאמצים לשמור על אבטחת המידע שלך ושל המערכת שלנו.\n\nאנו בודקים את העניין כעת. אם אתה סבור שהשעיה זו היא טעות, או אם יש לך חששות, אנא פנה לצוות התמיכה שלנו. אנו מתנצלים על כל חוסר נוחות ומוקירים את הבנתך.\n\nתודה על שיתוף הפעולה.\n\nבברכה,\nצוות השירות</span>`,
    },
    arabic: {
      button: 'إعادة تعيين كلمة المرور',
      dir: 'rtl',
      subject: 'إشعار هام: تعليق الحساب مؤقتًا',
      body: `<span style="direction: rtl">عزيزي ${name}،\n\nلقد تم تعليق حسابك مؤقتًا بسبب عدم النشاط لمدة 30 يومًا كجزء من تدابيرنا الأمنية لحماية معلوماتك ونظامنا.\n\nيرجى التأكد من أننا نراجع هذا الأمر. إذا كنت تعتقد أن هذا التعليق خطأ، أو إذا كان لديك أي مخاوف، الرجاء التواصل مع فريق الدعم لدينا. نعتذر عن أي إزعاج ونقدر تفهمك.\n\nشكرًا لتعاونك.\n\nمع خالص التحيات،\nفريق الخدمة</span>`,
    },
    french: {
      button: 'réinitialiser le mot de passe',
      dir: 'ltr',
      subject: 'Important : Notification de suspension temporaire de compte',
      body: `Cher ${name},\n\nNous avons temporairement suspendu votre compte en raison de 30 jours d'inactivité, dans le cadre de nos mesures de sécurité pour protéger vos informations et notre système.\n\nSoyez assuré que nous examinons cette question. Si vous pensez que cette suspension est une erreur, ou si vous avez des préoccupations, veuillez contacter notre équipe de support. Nous nous excusons pour tout désagrément et apprécions votre compréhension.\n\nMerci de votre coopération.\n\nCordialement,\nÉquipe de Service`,
    },
    german: {
      button: 'Passwort zurücksetzen',
      dir: 'ltr',
      subject: 'Wichtig: Benachrichtigung über vorübergehende Kontosperrung',
      body: `Sehr geehrte(r) ${name},\n\nWir haben Ihr Konto aufgrund von 30 Tagen Inaktivität vorübergehend gesperrt, als Teil unserer Sicherheitsmaßnahmen zum Schutz Ihrer Informationen und unseres Systems.\n\nBitte seien Sie versichert, dass wir diese Angelegenheit überprüfen. Wenn Sie glauben, dass diese Sperrung ein Fehler ist, oder wenn Sie Bedenken haben, kontaktieren Sie bitte unser Support-Team. Wir entschuldigen uns für etwaige Unannehmlichkeiten und schätzen Ihr Verständnis.\n\nVielen Dank für Ihre Kooperation.\n\nMit freundlichen Grüßen,\nService-Team`,
    },
    russian: {
      button: 'Сброс пароля',
      dir: 'ltr',
      subject: 'Важно: Уведомление о временной блокировке аккаунта',
      body: `Уважаемый ${name},\n\nМы временно заблокировали ваш аккаунт из-за 30 дней неактивности как часть наших мер безопасности для защиты вашей информации и нашей системы.\n\nПожалуйста, будьте уверены, что мы рассматриваем этот вопрос. Если вы считаете, что этот блок был сделан по ошибке, или у вас есть какие-либо опасения, пожалуйста, свяжитесь с нашей службой поддержки. Мы приносим извинения за любые неудобства и ценим ваше понимание.\n\nСпасибо за ваше сотрудничество.\n\nС уважением,\nСлужба поддержки`,
    },
    portuguese: {
      button: 'Redefinir senha',
      dir: 'ltr',
      subject: 'Importante: Notificação de Suspensão Temporária da Conta',
      body: `Prezado(a) ${name},\n\nSua conta foi temporariamente suspensa devido a 30 dias de inatividade como parte de nossas medidas de segurança para proteger suas informações e nosso sistema.\n\nEsteja seguro de que estamos analisando essa questão. Se você acredita que essa suspensão foi um erro, ou se você tem alguma preocupação, por favor, entre em contato com nossa equipe de suporte. Pedimos desculpas por qualquer inconveniente e apreciamos sua compreensão.\n\nObrigado pela sua cooperação.\n\nAtenciosamente,\nEquipe de Serviço`,
    },
    italian: {
      button: 'Resetta la password',
      dir: 'ltr',
      subject: 'Importante: Notifica di Sospensione Temporanea del Conto',
      body: `Caro ${name},\n\nAbbiamo sospeso temporaneamente il tuo conto a causa di 30 giorni di inattività, come parte delle nostre misure di sicurezza per proteggere le tue informazioni e il nostro sistema.\n\nTi assicuriamo che stiamo esaminando la questione. Se credi che questa sospensione sia un errore, o se hai delle preoccupazioni, ti preghiamo di contattare il nostro team di supporto. Ci scusiamo per eventuali disagi e apprezziamo la tua comprensione.\n\nGrazie per la tua cooperazione.\n\nCordiali saluti,\nTeam di Servizio`,
    },
    spanish: {
      button: 'Restablecer la contraseña',
      dir: 'ltr',
      subject: 'Importante: Notificación de Suspensión Temporal de Cuenta',
      body: `Estimado ${name},\n\nHemos suspendido temporalmente su cuenta debido a 30 días de inactividad como parte de nuestras medidas de seguridad para proteger su información y nuestro sistema.\n\nLe aseguramos que estamos revisando este asunto. Si cree que esta suspensión es un error, o si tiene alguna preocupación, por favor, contacte a nuestro equipo de soporte. Pedimos disculpas por cualquier inconveniente y apreciamos su comprensión.\n\nGracias por su cooperación.\n\nAtentamente,\nEquipo de Servicio`,
    },
    dutch: {
      button: 'Wachtwoord opnieuw instellen',
      dir: 'ltr',
      subject: 'Belangrijk: Kennisgeving van tijdelijke accountopschorting',
      body: `Geachte ${name},\n\nWe hebben uw account tijdelijk geschorst vanwege 30 dagen inactiviteit als onderdeel van onze beveiligingsmaatregelen om uw informatie en ons systeem te beschermen.\n\nWees gerust, we zijn deze kwestie aan het onderzoeken. Als u denkt dat deze schorsing een vergissing is, of als u zorgen heeft, neem dan contact op met ons ondersteuningsteam. Onze excuses voor het ongemak en we waarderen uw begrip.\n\nDank u voor uw medewerking.\n\nMet vriendelijke groet,\nServiceteam`,
    },
  };

  return (translations as any)[countryLanguage] || translations['english'];
};
export const generatePromotionDemotionEmail = ({
  companyName,
  name,
  newStatus,
  userType,
}: {
  userType: IUserType;
  name: string;
  newStatus: 'promoted' | 'demoted';
  companyName: string;
}): Promise<{ dir: string; subject: string; body: string }> =>
  new Promise((resolve) => {
    const translations = {
      english: {
        dir: 'ltr',
        // Default email content
        subject: 'Notification of Status Change',
        body: `Dear ${name},\n\nThis is to inform you of a change in your employment status. Please contact your HR department for more details.\n\nBest regards,\n${serviceTeamName}`,
      },
    };

    let subject: string = '';
    let body: string = '';

    // Determine the specific email content based on userType and newStatus
    if (newStatus === 'promoted') {
      if (userType === 'apartment-complex-manager') {
        subject = `Congratulations for Promotion: at ${companyName} for the role of Apartment Complex Manager`;
        body = `Dear ${name},\n\nWe are delighted to formally inform you of your promotion to Apartment Complex Manager at ${companyName}, effective immediately. Your exceptional hard work, dedication, and leadership have been consistently recognized, and we are confident that you will continue to excel and contribute significantly in this expanded capacity. We eagerly anticipate your success in this new role.\n\nCongratulations!\n\nBest regards,\n${managementTeamName}`;
      } else if (userType === 'tow-company-manager') {
        subject = `Congratulations for Promotion: at ${companyName} for the role Tow Company Manager`;
        body = `Dear ${name},\n\nWe are delighted to formally inform you of your promotion to Tow Company Manager at ${companyName}, effective immediately. Your exceptional hard work, dedication, and leadership have been consistently recognized, and we are confident that you will continue to excel and contribute significantly in this expanded capacity. We eagerly anticipate your success in this new role.\n\nCongratulations!\n\nBest regards,\n${managementTeamName}`;
      }
    } else if (newStatus === 'demoted') {
      if (userType === 'apartment-complex-employee') {
        // Demotion from employee to employee
        subject = `Notice of Role Change: at ${companyName} as an Apartment Complex Employee`;
        body = `Dear ${name},\n\nThis is to formally inform you of a change in your employment status at ${companyName}. Effective immediately, your role will be adjusted to Apartment Complex Employee. We understand this news may be unexpected, and we want to assure you of our commitment to supporting you through this transition. We are available to discuss this change and any concerns you may have at your earliest convenience.\n\nBest regards,\n${managementTeamName}`;
      } else if (userType === 'tow-company-employee') {
        // Demotion from employee to employee
        subject = `Notice of Role Change: ${companyName} as a Tow Company Employee`;
        body = `Dear ${name},\n\nThis is to formally inform you of a change in your employment status at ${companyName}. Effective immediately, your role will be adjusted to Tow Company Employee. We understand this news may be unexpected, and we want to assure you of our commitment to supporting you through this transition. We are available to discuss this change and any concerns you may have at your earliest convenience.\n\nBest regards,\n${managementTeamName}`;
      }
    }
    resolve({ dir: translations.english.dir, subject, body });
  });

export const renterAttachedRemovedNotification = (
  renterName: string,
  complexName: string,
  apartmentNumber: string,
  reason: string = 'attached'
) => {
  if (reason === 'attached') {
    return {
      subject: 'You Have Been Attached to an Apartment',
      body: `Dear ${renterName},\n\nYou have been successfully ${reason} as a renter to the following unit:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nIf you believe this assignment is incorrect, please contact our support team immediately for assistance.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  } else {
    return {
      subject: 'You Have Been Removed from an Apartment',
      body: `Dear ${renterName},\n\nYou have been successfully ${reason} from the following unit:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nIf this action was not expected or if you have any concerns, please contact our support team immediately.\n\n<q>Please also note that all occupants associated with your account have been removed permanently. However, those licenses will still be available in the license create interface for you to reassign them to another apartment. </q>\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  }
};

export const renterOccupantAttachedRemovedNotification = (
  renterName: string,
  complexName: string,
  apartmentNumber: string,
  reason: 'occupant-added' | 'occupant-removed' | 'occupant-detached' | 'occupant-attached',
  occupant?: {
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
  }
) => {
  if (reason === 'occupant-added') {
    return {
      subject: 'An Occupant Has Been Added to Your Apartment',
      body: `Dear ${renterName},\n\nA new occupant has been successfully added to your account and attached to the following apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nOccupant Details:\n<div style="background-color: #f7f7f7; padding: 10px; border-radius: 4px;">\n  <p><strong>Name:</strong> ${occupant?.firstName} ${occupant?.lastName}</p>\n  <strong>Status:</strong> Attached ✅</p>\n</div>\n\nIf this occupant was added in error, please contact our support team immediately.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  }
  if (reason === 'occupant-attached') {
    return {
      subject: 'An Occupant Has Been Attached to Your Apartment',
      body: `Dear ${renterName},\n\nA new occupant has been successfully attached to the following apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nOccupant Details:\n<div style="background-color: #f7f7f7; padding: 10px; border-radius: 4px;">\n  <p><strong>Name:</strong> ${occupant?.firstName} ${occupant?.lastName}</p>\n  <strong>Status:</strong> Attached ✅</p>\n</div>\n\nIf this occupant was added in error, please contact our support team immediately.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  } else if (reason === 'occupant-removed') {
    return {
      subject: 'An Occupant Has Been Removed from Your Apartment',
      body: `Dear ${renterName},\n\nAn occupant has been removed from your apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nOccupant Details:\n<div style="background-color: #f7f7f7; padding: 10px; border-radius: 4px;">\n <strong>Name:</strong> ${
        occupant?.firstName
      } ${occupant?.lastName}\n  ${occupant?.email ? `<strong>Email:</strong> ${occupant.email}` : ''}\n  ${
        occupant?.phoneNumber ? `\n<strong>Phone:</strong> ${occupant.phoneNumber}` : ''
      }\n  <strong>Status:</strong> Removed ❌\n</div>\n\nPlease note: The removed occupant is completely removed from your account. If you've moved to a different apartment, you will need to re-create the same occupant again, through the occupant interface.\n\nIf this action was unexpected, please contact our support team.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  } else {
    return {
      subject: 'An Occupant Has Been Detached from Your Apartment',
      body: `Dear ${renterName},\n\nAn occupant has been detach from your apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nOccupant Details:\n<div style="background-color: #f7f7f7; padding: 10px; border-radius: 4px;">\n  <strong>Name:</strong> ${
        occupant?.firstName
      } ${occupant?.lastName}\n  ${occupant?.email ? `<strong>Email:</strong> ${occupant.email}` : ''}\n  ${
        occupant?.phoneNumber ? `<strong>Phone:</strong> ${occupant.phoneNumber}` : ''
      }\n  <strong>Status:</strong> Detached ❌\n</div>\n\nPlease note: The detached occupant is still available in your account. If you've moved to a different apartment, you can easily reattach this occupant through the occupant interface.\n\nIf this action was unexpected, please contact our support team.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  }

  // Optional: handle other reasons...
};
export const renterLicenseAttachedRemovedNotification = (
  renterName: string,
  complexName: string,
  apartmentNumber: string,
  reason: 'new' | 'deleted' | 'updated' | 'attached',
  license?: {
    plate: string;
    stateShort: string;
  }
) => {
  const licenseDetails = license
    ? `<div style="background-color: #f7f7f7; padding: 10px; border-radius: 4px;">
         <p><strong>Plate Number:</strong> ${license.plate}</p>
         <p><strong>State:</strong> ${license.stateShort}</p>
       </div>`
    : '';

  if (reason === 'new') {
    return {
      subject: 'A Vehicle License Has Been Attached to Your Apartment',
      body: `Dear ${renterName},\n\nA new vehicle license has been successfully added to your account and associated with the following apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nLicense Details:\n${licenseDetails}\n\nIf this license was added in error, please contact our support team immediately.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  } else if (reason === 'deleted') {
    return {
      subject: 'A Vehicle License Has Been Removed from Your Apartment',
      body: `Dear ${renterName},\n\nA vehicle license has been removed from your account associated with the following apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nLicense Details:\n${licenseDetails}\n\nIf this action was unexpected, please contact our support team.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  } else if (reason === 'updated') {
    return {
      subject: 'A Vehicle License Has Been Updated on Your Account',
      body: `Dear ${renterName},\n\nA vehicle license associated with your apartment has been updated:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nUpdated License Details:\n${licenseDetails}\n\nIf you did not make this change, please contact our support team immediately.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  } else if (reason === 'attached') {
    return {
      subject: 'A Vehicle License Has Been Attached to Your Apartment',
      body: `Dear ${renterName},\n\nA vehicle license has been attached from your account licenses and associated with the following apartment:\n\nApartment Complex: ${complexName}\nApartment Number: ${apartmentNumber}\n\nLicense Details:\n${licenseDetails}\n\nIf this was not authorized by you, please contact our support team immediately.\n\nThank you.\nBest regards,\n${supportTeamName}`,
    };
  }

  // Optional fallback
  return {
    subject: 'Vehicle License Notification',
    body: `Dear ${renterName},\n\nThere has been an update related to a vehicle license on your account. Please log in to view the details.\n\nThank you.\nBest regards,\n${supportTeamName}`,
  };
};

// Helper function to generate common HTML content
const _commonEmailContent = (
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  const commonStyles = 'font-family: Arial, sans-serif; font-size: 14px; color: #333333;';
  const imgStyles = 'max-width:200px; border:1px solid #ccc; border-radius:4px;';
  const licensePlateList = licensePlates.map((lp, i) => `${i + 1}. ${lp.plateText}`).join('\n');

  const imageAttachments = licensePlates
    .map(
      (lp, index) =>
        `Original Image ${index + 1}: <img src='${lp.completeImage}' style="${imgStyles}" />\nLicense Plate ${
          index + 1
        }: <img src='${lp.croppedImage}' style="${imgStyles}" />`
    )
    .join('\n');

  const locationLink = `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`;
  const locationHTML = `<p style="${commonStyles}">Here are the location details:
      - Latitude: ${coordinates.lat}
      - Longitude: ${coordinates.lng}
      <a href="${locationLink}" style="color: #1a73e8; text-decoration: none;">Open in Google Maps</a></p>`;

  return {
    locationHTML,
    licensePlateList,
    imageAttachments,
  };
};

// 1. New Towing Request Email
export const towingRequestEmail = (
  name: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  isTowOperator?: boolean
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = 'Urgent: New Towing Request Received';
  const body = `Dear ${name},\n\nWe wanted to let you know that a new towing request has been submitted by ${
    requesterInfo.fullName
  } (${getRequesterContactInfo(requesterInfo)}),  ${
    getCompanyName(requesterInfo) ? `and company: ${getCompanyName(requesterInfo)}` : ''
  }. ${
    isTowOperator ? ' The system has automatically assigned this request to tow operator.' : ''
  }\n${locationHTML}. Vehicle license plate number:\n${licensePlateList}\n\nPlease review this request as soon as possible so you can assess the situation and provide the required assistance.\n\nYou can click the button below to see the full details and respond directly.\n\n Attached below is the list of images of the vehicle’s license plates for your reference:\n\n${imageAttachments}\n\nThank you for your quick attention and for continuing to provide reliable towing services.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Request', subject, body };
};

// 1. New Towing Request Email
export const towingNotificationToTheReferer = (
  name: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = 'Towing Request Created';
  const body = `Dear ${name},\n\nWe wanted to let you know that the user you sent a one time link has just submitted  a new towing request. \n The user is ${
    requesterInfo.fullName
  } (${getRequesterContactInfo(requesterInfo)}),  ${
    getCompanyName(requesterInfo) ? `and company: ${getCompanyName(requesterInfo)}` : ''
  }.\n${locationHTML}. Vehicle license plate number:\n${licensePlateList}\n\n You will receive further notifications related to this Towing Request. \n\n Attached below is the list of images of the vehicle’s license plates for your reference:\n\n${imageAttachments}\n\nThank you for your quick attention and for continuing to provide reliable towing services.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Request', subject, body };
};

// 2. Towing Request Assigned to Provider Email
export const towingRequestToTowOperator = (
  name: string,
  coordinates: ILocation,
  _: IUserDoc,
  assignedBy: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = 'Towing Request Assigned to You';
  const body = `Dear ${name},\n\nA towing request (${towRequestId}) has been assigned to you by ${assignedBy.fullName} (${assignedBy.email}).\n Distance to the pickup point is about ${towOperatorLocation.distance} miles. \n${locationHTML}Vehicle license plate number:\n${licensePlateList}\n\nPlease review the request details promptly and proceed with the necessary towing arrangements.\n\nYou can click the button below to access the full request details.\n\nAttached below is the list of images of the vehicle’s license plates for your reference:\n\n${imageAttachments}\n\nThank you for your prompt attention and professionalism.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Towing Details', subject, body };
};
export const towingRequestStatusUpdateEmail = (
  name: string,
  status: string,
  towRequestId: string,
  updatedBy: IUserDoc,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  role: 'MANAGER' | 'OPERATOR' | 'REQUESTER'
) => {
  const { locationHTML, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  let subject: string;
  let body: string;

  switch (role) {
    case 'MANAGER':
      if (status === 'REJECTED') {
        subject = `Action Required: Tow Request ${towRequestId} Rejected`;
        body = `Dear ${name},
        Operator <strong>${updatedBy?.fullName}</strong> has <strong>rejected</strong> tow request (ID: ${towRequestId}).
        Please reassign this request to another operator.
        ${locationHTML}${imageAttachments}`;
      } else if (status === 'CANCELLED') {
        subject = `Tow Request ${towRequestId} Cancelled`;
        body = `Dear ${name},
        The tow request (ID: ${towRequestId}) was cancelled by ${updatedBy.fullName}.
        ${locationHTML}${imageAttachments}`;
      } else {
        subject = `Tow Request Status Updated: ${status}`;
        body = `Dear ${name},
        Tow request (ID: ${towRequestId}) has been updated to <strong>${status}</strong> by ${updatedBy?.fullName}.
        ${locationHTML}${imageAttachments}`;
      }
      break;

    case 'REQUESTER':
      subject = `Update on Your Tow Request: ${status}`;
      body =
        `Dear ${name},\n\n` +
        `Your towing request (ID: ${towRequestId}) is now marked as ${status}.\n\n` +
        (status === 'ACCEPTED'
          ? 'A tow operator has accepted your request and is preparing to pick up your vehicle. You will be notified once the operator starts heading to your location.\n\n'
          : '') +
        (status === 'IN_PROGRESS'
          ? 'The tow operator is on the way or actively towing your vehicle. Please ensure you are ready at the pickup location.\n\n'
          : '') +
        (status === 'CANCELLED'
          ? 'This request was cancelled. If this was unexpected, please contact dispatch for assistance.\n\n'
          : '') +
        `${locationHTML}\n\n` +
        `${imageAttachments}`;
      break;

    case 'OPERATOR':
      subject = `Job Update: Tow Request ${towRequestId} is now ${status}`;
      body = `Dear ${name},
      The tow request assigned to you (ID: ${towRequestId}) is now <strong>${status}</strong>.
      ${status === 'ACCEPTED' ? 'Get ready to start the tow.' : ''}
      ${status === 'IN_PROGRESS' ? 'Proceed with towing and update status once completed.' : ''}
      ${status === 'COMPLETED' ? 'Great job! The tow is now completed.' : ''}
      ${locationHTML}${imageAttachments}`;
      break;
  }

  return { dir: 'ltr', button: 'View Tow Request', subject, body: body.replace(/\\n/g, '\n') };
};

// 4. Towing Assignment Email to Manager
export const towingAssignmentEmailToManager = (
  name: string,
  coordinates: ILocation,
  _: IUserDoc,
  assignedBy: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = 'Towing Request Assigned by Operator to themselves';
  const body = `Dear ${name},\n\n${assignedBy.fullName} (${
    assignedBy.email
  }) has assigned a towing request (${towRequestId}) to themselves.\n\n. This operator is ${Number(
    towOperatorLocation?.distance
  )?.toFixed(
    2
  )} miles away from the pickup position. \n${locationHTML}Vehicle license plate number:\n${licensePlateList}\n\nYou can click the button below to access the full request details.\n\nAttached below is the list of images of the vehicle's license plates for your reference:\n\n${imageAttachments}\n\n.Thank you for your prompt attention and professionalism.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Towing Details', subject, body };
};

// Force Assignment Email Templates
export const forceAssignmentEmailToTowOperator = (
  name: string,
  coordinates: ILocation,
  _: IUserDoc,
  assignedBy: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = '⚠️ Tow Request Assigned - Action Required';
  const body = `Dear ${name},\n\nA towing request (${towRequestId}) has been assigned to you by ${assignedBy.fullName} (${assignedBy.email}). This request has been automatically accepted and is now in ACCEPTED status.\n\nDistance to the pickup point is about ${towOperatorLocation.distance} miles.\n${locationHTML}Vehicle license plate number:\n${licensePlateList}\n\n⚠️ IMPORTANT: This assignment was made by management and the request is already in ACCEPTED status. You are expected to proceed with this tow request. Please review the details and begin the towing process as soon as possible.\n\nYou can click the button below to access the full request details.\n\nAttached below is the list of images of the vehicle's license plates for your reference:\n\n${imageAttachments}\n\nThank you for your prompt attention.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Towing Details', subject, body };
};

export const forceAssignmentEmailToManager = (
  name: string,
  coordinates: ILocation,
  _requesterInfo: IUserDoc,
  assignedBy: IUserDoc,
  assignedTo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = 'Tow Request Assigned';
  const body = `Dear ${name},\n\n${assignedBy.fullName} (${assignedBy.email}) has assigned towing request (${towRequestId}) to ${assignedTo.fullName} (${assignedTo.email}).\n\nThe tow request has been automatically set to ACCEPTED status, bypassing the normal acceptance process.\n\nDistance to the pickup point is about ${towOperatorLocation.distance} miles.\n${locationHTML}Vehicle license plate number:\n${licensePlateList}\n\nYou can click the button below to access the full request details.\n\nAttached below is the list of images of the vehicle's license plates for your reference:\n\n${imageAttachments}\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Tow Request', subject, body };
};

export const forceAssignmentEmailToPSP = (
  name: string,
  coordinates: ILocation,
  assignedBy: IUserDoc,
  assignedTo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);
  const subject = '⚠️ Tow Request Assigned - Status: ACCEPTED';
  const body = `Dear ${name},\n\nYour towing request (${towRequestId}) has been assigned to ${assignedTo.fullName} (${assignedTo.email}) by ${assignedBy.fullName} (${assignedBy.email}).\n\nThe tow request has been automatically set to ACCEPTED status, meaning the tow operator is expected to proceed with the tow.\n\nDistance to the pickup point is about ${towOperatorLocation.distance} miles.\n${locationHTML}Vehicle license plate number:\n${licensePlateList}\n\nYou can click the button below to access the full request details and track the progress.\n\nAttached below is the list of images of the vehicle's license plates for your reference:\n\n${imageAttachments}\n\nThank you for using our service.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Tow Request', subject, body };
};

// Email to send to the Parking Space Provider (PSP)
export const sendParkingNotificationToPSP = (
  name: string,
  bookedByInfo: IUserDoc,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string
) => {
  const subject = 'New Booking Confirmed: Your Parking Space Has Been Rented';
  const body = `Dear ${name},\n\nWe wanted to let you know that your parking space has been booked by a new renter: ${
    bookedByInfo.fullName
  } (${bookedByInfo.email}). \n The Parking ID is: ${parkingId}.\n\nBooking Details:\nStart Time: ${format(
    new Date(parkingStartTime),
    'PP • p'
  )}\nEnd Time: ${format(
    new Date(parkingEndTime),
    'PP • p'
  )}\n\nVehicle license plate number:\n${licensePlate}\n\nPlease review this booking as soon as possible and ensure the space is available.\n\n\nThank you for providing your space and for continuing to provide reliable parking services.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Booking Details', subject, body };
};

// Email to send to the Renter
export const sendParkingConfirmationToRenter = (
  name: string,
  parkingProviderInfo: IUserDoc,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string
) => {
  const subject = 'Your Parking Space Booking is Confirmed!';
  const body = `Dear ${name},\n\nYour booking for a parking space has been successfully confirmed. The parking space is provided by ${
    parkingProviderInfo.fullName
  } (${parkingProviderInfo.email}). \n The Parking ID is: ${parkingId}..\n\nBooking Details:\nStart Time: ${format(
    new Date(parkingStartTime),
    'PP • p'
  )}\nEnd Time: ${format(
    new Date(parkingEndTime),
    'PP • p'
  )}\n\nVehicle license plate number:\n${licensePlate}\n\nPlease review the details of your booking.\n\nThank you for using our service.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Booking Details', subject, body, parkingId };
};

// Email Reminder: Sent 15 minutes before parking ends
export const sendParkingReminderToRenter = (
  name: string,
  parkingProviderInfo: IUserDoc,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string
) => {
  const subject = 'Reminder: Your Parking Session is About to Expire!';
  const body = `Dear ${name},\n\nThis is a friendly reminder that your current parking session (Parking ID: ${parkingId}) is nearing its end.\n\nBooking Details:\nStart Time: ${format(
    new Date(parkingStartTime),
    'PP • p'
  )}\nEnd Time: ${format(
    new Date(parkingEndTime),
    'PP • p'
  )}\n\nVehicle license plate number:\n${licensePlate}\n\nPlease note:\n- After your booking expires, the parking space provider (${
    parkingProviderInfo.fullName
  }, ${
    parkingProviderInfo.email
  }) will no longer be responsible for your vehicle.\n- If your vehicle remains parked after the expiration, it may be subject to towing by the authorities or property management.\n\n✅ To avoid inconvenience, you can extend your parking session by clicking the button below.\n\nThank you for using our service.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'Extend Parking', subject, body, parkingId };
};

// Email Reminder: Sent 15 minutes before parking ends
export const sendParkingCompletionEmailToRenter = (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string
) => {
  const subject = 'Your Parking Session is Completed. Thank you for using our service!';
  const body = `Dear ${name},\n\nCongratulations! Your current parking session (Parking ID: ${parkingId}) has ended successfully.\n\nBooking Details:\nStart Time: ${format(
    new Date(parkingStartTime),
    'PP • p'
  )}\nEnd Time: ${format(
    new Date(parkingEndTime),
    'PP • p'
  )}\n\nVehicle license plate number:\n${licensePlate}\n\nYou have parked your vehicle for the duration you booked, and we appreciate your trust in our platform.\n\nThank you for choosing our service.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'Parking Session Completed', subject, body, parkingId };
};

// Email Reminder: Sent after parking ends
export const sendParkingCompletionEmailToParkingProvider = (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string,
  renter: IUserDoc
) => {
  const subject = 'Parking Session Completed – Booking ID: ' + parkingId;
  const body = `Dear ${name},\n\nThis is to inform you that the parking session (Parking ID: ${parkingId}) has now ended.\n\nBooking Details:\n- Start Time: ${format(
    new Date(parkingStartTime),
    'PP • p'
  )}\n- End Time: ${format(
    new Date(parkingEndTime),
    'PP • p'
  )}\n- Vehicle License Plate: ${licensePlate}\n\nRenter Information:\n${renter.fullName} (${
    renter.email
  })\n\nThe renter’s booking period is complete. The parking space is now available for new bookings.\n\nThank you for providing your parking space through our platform.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Booking Details', subject, body, parkingId };
};

// Email to send to the Parking Space Provider (PSP) when a booking is extended
// export const sendParkingExtensionNotificationToPSP = (
//   name: string,
//   bookedByInfo: IUserDoc,
//   licensePlate: string,
//   newParkingEndTime: string,
//   extendedHours: number,
//   parkingId: string
// ) => {
//   const subject = 'Booking Extended: Parking Time Updated';
//   const body = `Dear ${name},\n\nThe renter (${bookedByInfo.fullName}, ${
//     bookedByInfo.email
//   }) has extended their parking booking (ID: ${parkingId}).\n\nUpdated Booking Details:\nExtended By: ${extendedHours} hour(s)\nNew End Time: ${format(
//     new Date(newParkingEndTime),
//     'PP • p'
//   )}\n\nVehicle license plate number:\n${licensePlate}\n\nPlease ensure the parking space remains available for the updated duration.\n\nThank you for providing reliable parking services.\n\nBest regards,\n${serviceTeamName}`;

//   return { dir: 'ltr', button: 'View Updated Booking', subject, body };
// };

// // Email to send to the Renter when their booking is extended
// export const sendParkingExtensionConfirmationToRenter = (
//   name: string,
//   parkingProviderInfo: IUserDoc,
//   licensePlate: string,
//   newParkingEndTime: string,
//   extendedHours: number,
//   parkingId: string
// ) => {
//   const subject = 'Your Parking Booking Has Been Extended';
//   const body = `Dear ${name},\n\nYour booking has been successfully extended by ${extendedHours} hour(s).\nThe parking space is provided by ${
//     parkingProviderInfo.fullName
//   } (${parkingProviderInfo.email}).\n\nUpdated Booking Details:\nNew End Time: ${format(
//     new Date(newParkingEndTime),
//     'PP • p'
//   )}\n\nVehicle license plate number:\n${licensePlate}\n\nPlease review your updated booking details.\n\nThank you for using our service.\n\nBest regards,\n${serviceTeamName}`;

//   return { dir: 'ltr', button: 'View Updated Booking', subject, body, parkingId };
// };

// For PSP
export const sendParkingExtensionNotificationToPSP = (
  name: string,
  bookedByInfo: IUserDoc,
  licensePlate: string,
  newParkingEndTime: string,
  extendedHours: number,
  parkingId: string
) => {
  const subject = 'New Booking Created (Extension)';
  const body = `Dear ${name},\n\nThe renter (${bookedByInfo.fullName}, ${
    bookedByInfo.email
  }) has extended their parking time.\n\nA new booking (ID: ${parkingId}) has been created.\n\nDetails:\nDuration: ${extendedHours} hour(s)\nEnd Time: ${format(
    new Date(newParkingEndTime),
    'PP • p'
  )}\n\nVehicle: ${licensePlate}\n\nPlease ensure the space is available for this new booking.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Booking', subject, body };
};

// For Renter
export const sendParkingExtensionConfirmationToRenter = (
  name: string,
  parkingProviderInfo: IUserDoc,
  licensePlate: string,
  newParkingEndTime: string,
  extendedHours: number,
  parkingId: string
) => {
  const subject = 'Your Parking Extension is Confirmed';
  const body = `Dear ${name},\n\nYour extension has been confirmed. A new booking (ID: ${parkingId}) has been created for an additional ${extendedHours} hour(s).\n\nProvider: ${
    parkingProviderInfo.fullName
  } (${parkingProviderInfo.email})\nEnd Time: ${format(
    new Date(newParkingEndTime),
    'PP • p'
  )}\n\nVehicle: ${licensePlate}\n\nYou can review the booking details via the link below.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Booking', subject, body, parkingId };
};

export const towingRequestFollowUpEmailToManager = (
  name: string,
  towRequestId: string,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  const { locationHTML, imageAttachments } = _commonEmailContent(coordinates, licensePlates);

  const subject = `Follow-Up Required: Tow Request ${towRequestId} Pending Assignment`;
  const body = `Dear ${name},\n\nThe client has requested a follow-up on their towing request (ID: ${towRequestId}).\n\nThis request is still in *Pending Assignment* status and has not yet been assigned to any tow operator.\n\nAs the manager, please review the request and assign it to an operator as soon as possible to avoid delays.\n\n${locationHTML}\n\nAttached below are the images of the vehicle’s license plates for your reference:\n${imageAttachments}\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'Review Tow Request', subject, body };
};

export const towingRequestFollowUpEmailToManagerAndOperator = (
  name: string,
  towRequestId: string,
  assignedOperator: IUserDoc,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  const { locationHTML, imageAttachments } = _commonEmailContent(coordinates, licensePlates);

  // Manager copy
  const managerSubject = `Follow-Up Alert: Tow Request ${towRequestId} Assigned but Pending Action`;
  const managerBody = `Dear ${name},\n\nThe client has requested a follow-up on their towing request (ID: ${towRequestId}).\n\nThis request is currently assigned to ${assignedOperator.fullName} (${assignedOperator.email}) but has not yet been fulfilled.\n\nPlease monitor this request closely to ensure timely resolution.\n\n${locationHTML}\n\nAttached below are the images of the vehicle’s license plates for your reference:\n${imageAttachments}\n\nBest regards,\n${serviceTeamName}`;

  // Operator copy
  const operatorSubject = `Client Follow-Up: Tow Request ${towRequestId} Requires Your Action`;
  const operatorBody = `Dear ${assignedOperator.fullName},\n\nThe client has requested a follow-up on their towing request (ID: ${towRequestId}).\n\nThis request is currently assigned to you, but it appears that no action has been taken yet. Please update the request status or complete the towing service as soon as possible.\n\n${locationHTML}\n\nAttached below are the images of the vehicle’s license plates for your reference:\n${imageAttachments}\n\nBest regards,\n${serviceTeamName}`;

  return {
    manager: { dir: 'ltr', button: 'Review Tow Request', subject: managerSubject, body: managerBody },
    operator: { dir: 'ltr', button: 'Update Tow Request', subject: operatorSubject, body: operatorBody },
  };
};

// To renter
export const sendBookingCompletedAndExtensionStartedToRenter = (
  name: string,
  licensePlate: string,
  prevStart: string,
  prevEnd: string,
  nextBooking: IBookParkingDoc
) => {
  const subject = 'Your Booking Completed — Extension Started';
  const body = `Dear ${name},\n\nYour previous booking (${format(new Date(prevStart), 'p')} - ${format(
    new Date(prevEnd),
    'p'
  )}) has been completed.\n\nA new booking (extension) has automatically started:\nStart: ${format(
    new Date(nextBooking.parkingStartTime || new Date()),
    'PP • p'
  )}\nEnd: ${format(
    new Date(nextBooking.parkingEndTime || new Date()),
    'PP • p'
  )}\n\nVehicle: ${licensePlate}\n\nThank you for using our service.`;

  return { dir: 'ltr', button: 'View Extension Booking', subject, body };
};

// To PSP
export const sendBookingCompletedAndExtensionStartedToPSP = (
  pspName: string,
  renter: IUserDoc,
  licensePlate: string,
  prevStart: string,
  prevEnd: string,
  nextBooking: IBookParkingDoc
) => {
  const subject = 'Renter Booking Completed — Extension Started';
  const body = `Dear ${pspName},\n\nThe renter (${renter.fullName}, ${
    renter.email
  }) has completed their previous booking (${format(new Date(prevStart), 'p')} - ${format(
    new Date(prevEnd),
    'p'
  )}).\n\nA new booking (extension) has automatically started:\nStart: ${format(
    new Date(nextBooking.parkingStartTime || new Date()),
    'PP • p'
  )}\nEnd: ${format(
    new Date(nextBooking.parkingEndTime || new Date()),
    'PP • p'
  )}\n\nVehicle: ${licensePlate}\n\nPlease ensure availability for the new booking.`;

  return { dir: 'ltr', button: 'View Extension Booking', subject, body };
};

// 3. Towing Request Status Update Email
export const towingRequestUpdatesEmail = (
  name: string,
  towRequestId: string,
  updatedBy: IUserDoc,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
  // assignedToName?: string
) => {
  const { locationHTML, imageAttachments } = _commonEmailContent(coordinates, licensePlates);

  const subject = `Tow Request Updated`;
  const body = `Dear ${name},\n\nWe wanted to inform you that the towing request you are linked to (ID: ${towRequestId}) has been updated \nThis update was made by ${updatedBy.fullName} (${updatedBy.email}).\n${locationHTML}. \n Please click the button below to view the latest details of your tow request and take any necessary action.\n\nAttached below is the list of images of the vehicle’s license plates for your reference:\n\n${imageAttachments}\n\nThank you for staying updated.\n\nBest regards,\n${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Updated Request', subject, body };
};

export const towingRequestInviteEmailToUser = (inviter: { fullName?: string; email?: string }, companyName?: string) => {
  const subject = `One-Time Link to Create a Tow Request`;

  const body = `Hello,\n\n${inviter.fullName ? inviter.fullName : 'A manager'}${
    companyName ? ` from ${companyName}` : ''
  } has shared a one-time link with you to create a tow request in our system.\n\nPlease click on the button below to proceed and complete your tow request.\n\nIf you did not expect this invitation, you can safely ignore this message.\n\nFor any questions, you may contact the inviter at ${
    inviter.email || 'N/A'
  }.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

// Email when token expires
export const towingRequestInviteExpiredEmailToManager = (
  inviter: { fullName?: string; email?: string },
  inviteeContact: string,
  companyName?: string,
  contactMethod: 'email' | 'phone' = 'email'
) => {
  const subject = `Tow Request Invitation Link Expired`;
  const contactLabel = contactMethod === 'phone' ? 'phone number' : 'email';

  const body = `Hello ${inviter.fullName || 'Manager'},\n\nThe one-time tow request invitation you sent to ${contactLabel} ${inviteeContact}${
    companyName ? ` from ${companyName}` : ''
  } has expired and can no longer be used.\n\nIf necessary, you may generate and send a new link.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

// Email when user clicks the link
export const towingRequestInviteAcceptedEmailToManager = (
  inviter: { fullName?: string; email?: string },
  inviteeContact: string,
  companyName?: string,
  contactMethod: 'email' | 'phone' = 'email'
) => {
  const subject = `Tow Request Invitation Accepted`;
  const contactLabel = contactMethod === 'phone' ? 'phone number' : 'email';

  const body = `Hello ${inviter.fullName || 'Manager'},\n\nThe one-time tow request invitation you sent to ${contactLabel} ${inviteeContact}${
    companyName ? ` from ${companyName}` : ''
  } has been successfully validated.\n\nThe user can now proceed to create a tow request in the system.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

export const towingRequestInviteReminderEmailToUser = (inviter: IUserDoc, companyName?: string, token?: string) => {
  const subject = `Reminder: Your Tow Request Invitation Will Expire Soon`;

  const body = `Hello,\n\nThis is a friendly reminder that the one-time link you received from ${
    inviter.fullName || 'a manager'
  }${
    companyName ? ` at ${companyName}` : ''
  } to create a tow request will expire in 15 minutes.\n\nPlease make sure to complete your tow request before the link becomes invalid.\n\nToken: ${token}\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

export const towingRequestInviteAcceptedEmailToUser = (
  hasDummyEmail: boolean,
  hasDummyPhone: boolean
) => {
  const subject = `Welcome! You're Almost Ready to Create Your Tow Request`;

  let setupSteps = '';
  if (hasDummyEmail && hasDummyPhone) {
    setupSteps = '1. Add your email address\n2. Add your phone number\n3. Set a secure password';
  } else if (hasDummyEmail) {
    setupSteps = '1. Add your email address\n2. Set a secure password';
  } else if (hasDummyPhone) {
    setupSteps = '1. Add your phone number\n2. Set a secure password';
  } else {
    setupSteps = '1. Set a secure password';
  }

  const body = `Hello,\n\n🎉 Congratulations! You've successfully accepted your invitation.\n\nTo get started, you'll just need to:\n\n${setupSteps}\n\nClick the link below to complete your account setup\n\nThis link is valid until you complete your account setup.\n\nOnce done, you'll be ready to create your tow request right away.\n\nWe've made the process simple and easy — you'll be done in just a few moments.\n\nThank you for joining us!\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

// Email to invitee when invite is revoked/cancelled
export const towingRequestInviteCancelledEmailToInvitee = (
  inviteeName: string | undefined,
  inviterName: string | undefined,
  companyName?: string
) => {
  const subject = `Tow Request Invitation Cancelled`;

  const body = `Hello${inviteeName ? ` ${inviteeName}` : ''},\n\nWe wanted to let you know that the tow request invitation you received from ${
    inviterName || 'a tow company representative'
  }${companyName ? ` at ${companyName}` : ''} has been cancelled.\n\nThe invitation link is no longer valid and cannot be used to create a tow request.\n\nIf you believe this was done in error or have any questions, please contact the tow company directly.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

// Email to manager when they revoke/cancel an invite
export const towingRequestInviteCancelledEmailToManager = (
  inviter: { fullName?: string; email?: string },
  inviteeContact: string,
  companyName?: string,
  contactMethod: 'email' | 'phone' = 'email'
) => {
  const subject = `Tow Request Invitation Cancelled`;
  const contactLabel = contactMethod === 'phone' ? 'phone number' : 'email';

  const body = `Hello ${inviter.fullName || 'Manager'},\n\nYou have successfully cancelled the tow request invitation sent to ${contactLabel} ${inviteeContact}${
    companyName ? ` from ${companyName}` : ''
  }.\n\nThe invitation link is no longer valid and the recipient has been notified.\n\nIf you need to send a new invitation, you can do so at any time.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

// Email to manager when invitee declines/rejects an invite
export const towingRequestInviteRejectedEmailToManager = (
  inviterName: string | undefined,
  inviteeName: string | undefined,
  inviteeContact: string,
  companyName?: string
) => {
  const subject = `Tow Request Invitation Declined`;

  const body = `Hello ${inviterName || 'Manager'},\n\nThe tow request invitation you sent to ${inviteeName || inviteeContact}${
    companyName ? ` from ${companyName}` : ''
  } has been declined by the recipient.\n\nThe invitation link is no longer valid. If needed, you may reach out to the recipient directly or send a new invitation.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

export const sendPasswordAndNameSetupSuccessEmail = (user: IUserDoc) => {
  const subject = `Your Account Setup is Complete`;

  const body = `Hello ${user.fullName},\n\nCongratulations! You have successfully set up your account credentials.\nYou can now log in and create tow requests without any additional steps.\n\nIf this wasn’t you or you believe this action was made in error, please contact our support team immediately.\n\nThank you,\n${serviceTeamName}`;

  return { subject, body };
};

export const towingRequestApprovalEmail = (
  newUser: IUserDoc,
  ownerUser: IUserDoc,
  requestId: string,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  const { locationHTML, licensePlateList, imageAttachments } = _commonEmailContent(coordinates, licensePlates);

  const subject = `Action Required: New User ${newUser.fullName} Created Their First Tow Request`;

  const body = `Hello ${ownerUser.fullName},\n\n We wanted to let you know that a newly added user, ${newUser.fullName} (${newUser.email}), from your company has created their first tow request (Request ID: ${requestId}).\n\n As the owner of the parking spaces provider company, please review and confirm this request so that the manager of the tow company can proceed. Request details: ${locationHTML}. Vehicle license plate number: ${licensePlateList}.\n\nAttached below is the list of images of the vehicle's license plates for your reference:\n\n${imageAttachments}\n\n<span style="color:blue">As per policy, this request will be considered legitimate unless you explicitly mark it as not legitimate in the next 5 minutes. Please click the Reject button if you believe this request is not legitimate, and we will investigate further.\n\nIf this request was not intended, please contact our support team immediately.\n\nThank you, ${serviceTeamName}`;

  return { dir: 'ltr', button: 'View Request', subject, body };
};

/**
 * Email template for sending invoice
 */
export const towRequestInvoiceEmail = (
  name: string,
  towRequestId: string,
  invoiceNumber?: string
) => {
  const subject = `Invoice for Tow Request ${towRequestId}${invoiceNumber ? ` - Invoice #${invoiceNumber}` : ''}`;

  const body = `Dear ${name},\n\nPlease find attached the invoice for your tow request (ID: ${towRequestId}).\n\nThis invoice includes all charges related to your towing service, including mileage, fees, and any additional charges.\n\nIf you have any questions about this invoice, please don't hesitate to contact us.\n\nThank you for using our towing services.\n\nBest regards,\n${serviceTeamName}`;

  return { subject, body };
};

/**
 * Email template for account setup link
 */
export const accountSetupEmail = (name: string, setupLink: string) => {
  const subject = 'Complete Your Account Setup';

  const body = `Dear ${name},\n\nYour tow request has been completed! To continue using our services, please complete your account setup by setting up your password.\n\nClick the link below to set up your account:\n${setupLink}\n\nThis link will remain valid until you use it to set up your account.\n\nIf you did not request this, please ignore this email.\n\nThank you,\n${serviceTeamName}`;

  return { subject, body };
};

// 1. Actor notification
export const sendCrossCompanyActorNotification = async (actor: IUserDoc, targetUser: IUserDoc, towManagers: IUserDoc[]) => {
  const subject = `Cross-Company Parking space Owner Transfer Notification`;
  const body = `Hello ${actor.fullName},\n\n You attempted to transfer parking space ${
    getCompanyName(targetUser)
  } (User: ${targetUser.fullName}, Email:${
    targetUser.email
  }) from another Tow company to your company.\n\n Managers/owners of that company have been notified and must act within 5 minutes, otherwise the system will automatically approve the request.\n\n Notified owner/managers: ${towManagers
    .map((m) => m.email)
    .join(', ')}. \n\n You will be informed once finalized.\n\n Best regards,\n ${serviceTeamName}`;
  return { subject, body };
};

// 2. Manager notification
export const sendCrossCompanyManagerNotification = async (manager: IUserDoc, targetUser: IUserDoc, actor: IUserDoc) => {
  const subject = `Parking space Transfer Request: ${targetUser.fullName}`;
  const body = `Hello ${manager.fullName},\n\n A transfer of ownership has been triggered by ${actor.fullName} (${actor.email}) to move parking space ${getCompanyName(targetUser)} (User: ${targetUser.fullName}, Email: ${targetUser.email}) from your Tow company to their Tow Company.\n\n As per policy, this request will be automatically approved after 5 minutes unless you explicitly reject it, so please click Reject immediately if unintended, otherwise the system will finalize the transfer.\n\n Best regards,\n ${serviceTeamName}`;

  return { subject, body };
};

// 3. User notification
export const sendCrossCompanyUserNotification = async (targetUser: IUserDoc, actor: IUserDoc) => {
  const subject = `Parking space Transfer Request Initiated`;
  const body = `Hello ${targetUser.fullName},\n\n A request has been initiated by ${actor.fullName} (${actor.email}) to transfer your parking space to their Tow Company.\n\n This means, all your tow requests and tow management activity will now be handled by the new tow company.\n\n This transfer is pending approval from your current company’s managers/owners who have 5 minutes to reject it if unintended, otherwise the system will auto-approve, you will be notified once finalized.\n The transfer will be finalized once you click on the approve button.\n\n Ignore this message, if it not intended as we will automatically mark this request invalid after 1 hour. \n\n Best regards, ${serviceTeamName}`;

  return { subject, body };
};

// Actor Notification
export const crossCompanyAutoApproveActorEmail = (
  actor: IUserDoc,
  targetUser: IUserDoc,
  fromCompany: string,
  toCompany: string
) => {
  const subject = `Cross-Company Transfer Approved Automatically`;
  const body = `Hello ${actor.fullName},\n\nThe transfer of user ${targetUser.fullName} (${targetUser.email}) from Tow Company ${fromCompany} to ${toCompany} has been automatically approved after 5 minutes. The Parkning Space transfer will be finalized once the user click on the approve button.\n\nBest regards,\n${serviceTeamName}`;
  return { subject, body };
};

// Manager Notification
export const crossCompanyAutoApproveManagerEmail = (manager: IUserDoc, targetUser: IUserDoc) => {
  const subject = `Parkning Space Transfer Auto-Approved`;
  const body = `Hello ${manager.fullName},\n\nThe transfer of ${targetUser.fullName} (${targetUser.email}) has been auto-approved after 5 minutes. The Parkning Space transfer will be finalized once the user click on the approve button. \n\nIf this was not intended, please contact support immediately.\n\nBest regards,\n${serviceTeamName}`;
  return { subject, body };
};

// Target User Notification
export const crossCompanyAutoApproveUserEmail = (targetUser: IUserDoc, toCompany: string) => {
  const subject = `Parkning Space Transfer Approved`;
  const body = `Hello ${targetUser.fullName},\n\nYour account transfer grace period has ended, click on the approve button to finalize the transfer to ${toCompany}. This transfer was auto-approved after 5 minutes by the system.\n\nBest regards,\n${serviceTeamName}`;
  return { subject, body };
};

// Actor Notification (when discarded by manager)
export const crossCompanyDiscardActorEmail = (actor: IUserDoc, targetUser: IUserDoc, manager: IUserDoc) => {
  const subject = `Cross-Company Transfer Request Discarded`;
  const body = `Hello ${actor.fullName},\n\nThe transfer request for user ${targetUser.fullName} (${targetUser.email}) was discarded by ${manager.fullName} (${manager.email}).\n\nThis means the user will remain with their current Company.\n\nBest regards,\n${serviceTeamName}`;
  return { subject, body };
};

export const successfulTransferEmailContent = {
  oldCompanyOnCrossCompanyTransfer: (manager: IUserDoc, targetUser: IUserDoc, newCompany: IUserDoc) => {
    newCompany;
    const subject = `Transfer Completed: Parking space Transfer From Your Tow Company`;
    const body = `Hello ${manager.fullName},\n\nThe user ${targetUser.fullName} (${targetUser.email}) is approved for transfer from your Tow Company.\n\nThe transfer will be completed once the user clicks on the approve button.\n\nIf this transfer was not intended, reach out to Admin for further assistance.\n\nBest regards,\n${serviceTeamName}`;
    return { subject, body };
  },

  newCompanyOnCrossCompanyTransfer: (newCompanyActor: IUserDoc, newCompanyManagers: IUserDoc[], targetUser: IUserDoc) => {
    const subject = `Transfer Completed: New Parking Space Transfer Request`;
    newCompanyManagers;
    const body = `Hello ${newCompanyActor.fullName},\n\nA parking space transfer request has been approved to transfer user ${targetUser.fullName} (${targetUser.email}) into your Tow Company.\n\nThe transfer will be finalized automatically when the owner of the parking space accepts the invite.\n\nBest regards,\n${serviceTeamName}`;
    return { subject, body };
  },

  targetUserOnCrossCompanyTransfer: (targetUser: IUserDoc, oldCompany: IUserDoc, newCompany: IUserDoc) => {
    const subject = `Your Parking Space Transfer Completed`;
    const body = `Hello ${targetUser.fullName},\n\nA transfer request has been automatically approved to move your account from Tow Company ${getCompanyName(oldCompany)} to ${getCompanyName(newCompany)}.\n\nThis request will be completed once you click on the approve request button.\n\n If the request is not intended as per policy, don't accept the request we will automatically reject it after 1 hour.\n\nYou will be notified once this process is finalized.\n\nBest regards,\n${serviceTeamName}`;
    return { subject, body };
  },
};

export const discardTransferEmailContent = {
  oldCompanyOnCrossCompanyTransfer: (manager: IUserDoc, targetUser: IUserDoc, newCompany: IUserDoc) => {
    const subject = `Discarded: Parking Space Transfer From Your Tow Company`;
    newCompany;
    const body = `Hello ${manager.fullName},\n\nThe transfer request for user ${targetUser.fullName} (${targetUser.email}) from your Tow Company has been discarded by one of your managers/owner.\n\nThis transfer will not proceed further, and the user remains under your Tow Company.\n\nBest regards,\n${serviceTeamName}`;
    return { subject, body };
  },

  newCompanyOnCrossCompanyTransfer: (newCompanyActor: IUserDoc, newCompanyManagers: IUserDoc[], targetUser: IUserDoc) => {
    const subject = `Discarded: Parking Space Transfer to your company`;
    newCompanyManagers;
    const body = `Hello ${newCompanyActor.fullName},\n\nThe transfer request to move user ${targetUser.fullName} (${targetUser.email}) into your Tow Company has been discarded by the old company’s managers/owner.\n\nThis transfer will not proceed, and the user will remain with their current Tow Company.\n\nBest regards,\n${serviceTeamName}`;
    return { subject, body };
  },

  targetUserOnCrossCompanyTransfer: (targetUser: IUserDoc, oldCompany: IUserDoc, newCompany: IUserDoc) => {
    const subject = `Discarded: Your Tow Company Transfer Request`;
    const body = `Hello ${targetUser.fullName},\n\nThe transfer request to move your account from Tow Company ${getCompanyName(oldCompany)} to ${getCompanyName(newCompany)} has been discarded by your current company.\n\nNo further action is required, and you will remain under your existing Tow Company.\n\nBest regards,\n${serviceTeamName}`;
    return { subject, body };
  },
};

// Subscription-related email templates
export const subscriptionPaymentSuccessEmail = (
  name?: string,
  tierName?: string,
  amount?: number,
  nextBillingDate?: string
) => {
  return {
    title: 'Payment Successful - Subscription Confirmed',
    content: `Dear ${name},\nThank you for your payment!\nYour subscription to ${tierName} has been successfully processed.\nPayment Details:\n• Plan: ${tierName}\n• Amount: $${amount}\n• Next Billing Date: ${nextBillingDate}\n\nYour subscription is now active and you have full access to all features included in your plan.\nIf you have any questions or need assistance, please don't hesitate to contact our support team.\nThank you for choosing our service!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionCancelledEmail = (name?: string, tierName?: string, endDate?: string) => {
  return {
    title: 'Subscription Cancellation Scheduled',
    content: `Dear ${name},\n\nYour ${tierName} subscription cancellation has been scheduled.\n\n📅 Important Information:\n• Plan: ${tierName}\n• Access continues until: ${endDate}\n• Subscription status: Active until period end\n\n✅ You can continue using all features until ${endDate}\n🔄 You can reactivate your subscription anytime before this date\n\n🛑 What happens next?\nAfter ${endDate}, your subscription will be cancelled and you'll lose access to premium features.\n\n💡 Changed your mind?\nYou can reactivate your subscription at any time by visiting your account settings. Just click "Reactivate Subscription" and your subscription will continue seamlessly.\n\nIf you have any questions or need assistance, please don't hesitate to contact our support team.\nWe hope to see you back soon!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionUpdatedEmail = (name?: string, oldTierName?: string, newTierName?: string, amount?: number) => {
  return {
    title: 'Subscription Updated Successfully',
    content: `Dear ${name},\nYour subscription has been successfully updated!\nSubscription Changes:\n• Previous Plan: ${oldTierName}\n• New Plan: ${newTierName}\n• New Amount: $${amount}\n\nYour new subscription is now active and you have access to all features included in your updated plan.\nIf you have any questions about your new subscription or need assistance, please contact our support team.\nThank you for your continued trust in our service!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionUpgradeEmail = (
  name?: string,
  oldTierName?: string,
  newTierName?: string,
  oldPrice?: number,
  newPrice?: number,
  proratedAmount?: number,
  nextBillingDate?: Date
) => {
  return {
    title: 'Subscription Upgraded Successfully',
    content: `Dear ${name},\n\nGreat news! Your subscription has been upgraded successfully.\n\n📊 Subscription Changes:\n• Previous Plan: ${oldTierName} ($${oldPrice})\n• New Plan: ${newTierName} ($${newPrice})\n• Prorated Charge: $${proratedAmount?.toFixed(2) || '0.00'}\n• Next Billing Date: ${nextBillingDate?.toLocaleDateString() || 'N/A'}\n\n✨ Immediate Benefits:\nYour upgraded subscription is now active immediately! You now have access to all features included in your new ${newTierName} plan.\n\nYour account has been charged the prorated amount (difference between your old and new plan) for the remaining period.\n\nThank you for upgrading!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionDowngradeEmail = (
  name?: string,
  oldTierName?: string,
  newTierName?: string,
  oldPrice?: number,
  newPrice?: number,
  effectiveDate?: Date
) => {
  return {
    title: 'Subscription Downgrade Scheduled',
    content: `Dear ${name},\n\nYour subscription downgrade has been scheduled successfully.\n\n📊 Subscription Changes:\n• Current Plan: ${oldTierName} ($${oldPrice})\n• New Plan: ${newTierName} ($${newPrice})\n• Effective Date: ${effectiveDate?.toLocaleDateString() || 'N/A'}\n\n⏰ Important Information:\nYour subscription will downgrade at the end of your current billing period (${effectiveDate?.toLocaleDateString() || 'N/A'}). Until then, you will continue to have access to all features of your current ${oldTierName} plan.\n\nNo charges will be made at this time. You will begin paying $${newPrice} starting from your next billing cycle.\n\nIf you have any questions or need to modify this change, please contact our support team before the effective date.\n\nThank you for your continued use of our service!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionPaymentFailedEmail = (name?: string, tierName?: string, retryDate?: string) => {
  return {
    title: 'Payment Failed - Action Required',
    content: `Dear ${name},\nWe were unable to process your payment for your ${tierName} subscription.\nPayment Details:\n• Plan: ${tierName}\n• Retry Date: ${retryDate}\n\nTo avoid service interruption, please update your payment method in your account settings as soon as possible.\nIf you need assistance updating your payment information, please contact our support team.\nThank you for your attention to this matter.\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionExpiryReminderEmail = (name?: string, tierName?: string, price?: number, expiryDate?: string, daysUntilExpiry?: number) => {
  return {
    title: 'Subscription Expiring Soon - Renewal Reminder',
    content: `Dear ${name},\nYour ${tierName} subscription is expiring soon!\nSubscription Details:\n• Plan: ${tierName}\n• Price: $${price}\n• Expiry Date: ${expiryDate}\n• Days Remaining: ${daysUntilExpiry}\n\nTo continue enjoying uninterrupted service, please renew your subscription before the expiry date.\nYou can renew your subscription by logging into your account and updating your payment information.\nIf you have any questions or need assistance, please don't hesitate to contact our support team.\nThank you for being a valued customer!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionExpiredEmail = (name?: string, tierName?: string, price?: number, expiryDate?: string) => {
  return {
    title: 'Subscription Expired - Service Suspended',
    content: `Dear ${name},\nYour ${tierName} subscription has expired and your service has been suspended.\nSubscription Details:\n• Plan: ${tierName}\n• Price: $${price}\n• Expiry Date: ${expiryDate}\n\nTo restore your service, please renew your subscription by logging into your account and updating your payment information.\nIf you need assistance or have any questions, please contact our support team.\nWe look forward to welcoming you back!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionPaymentRetryEmail = (name?: string, tierName?: string, price?: number, retryDate?: string) => {
  return {
    title: 'Payment Retry Scheduled - Update Required',
    content: `Dear ${name},\nWe attempted to process your payment for your ${tierName} subscription but it failed.\nSubscription Details:\n• Plan: ${tierName}\n• Price: $${price}\n• Next Retry: ${retryDate}\n\nTo ensure your subscription continues without interruption, please update your payment method in your account settings before the retry date.\nIf you need assistance updating your payment information, please contact our support team.\nThank you for your attention to this matter.\nBest regards,\n${supportTeamName}`,
  };
};

export const invoiceCreatedEmail = (name?: string, tierName?: string, amount?: number, nextBillingDate?: string) => {
  return {
    title: 'New Invoice Generated - Payment Due',
    content: `Dear ${name},\nA new invoice has been generated for your ${tierName} subscription.\nInvoice Details:\n• Plan: ${tierName}\n• Amount: $${amount}\n• Next Billing Date: ${nextBillingDate}\n\nYour payment will be processed automatically using your default payment method. You don't need to take any action.\nIf you have any questions about this invoice or need to update your payment method, please contact our support team.\nThank you for your continued subscription!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionRenewalEmail = (name?: string, tierName?: string, amount?: number, nextBillingDate?: string) => {
  return {
    title: 'Subscription Renewed Successfully',
    content: `Dear ${name},\nYour ${tierName} subscription has been automatically renewed!\nRenewal Details:\n• Plan: ${tierName}\n• Amount: $${amount}\n• Next Billing Date: ${nextBillingDate}\n\nYour subscription continues to be active and you have uninterrupted access to all features included in your plan.\nThank you for your continued subscription!\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionReactivatedEmail = (name?: string, tierName?: string, nextBillingDate?: string) => {
  return {
    title: 'Subscription Reactivated Successfully',
    content: `Dear ${name},\n\nGreat news! Your ${tierName} subscription has been reactivated.\n\n✅ Your subscription is now active and will continue automatically\n📅 Next billing date: ${nextBillingDate}\n\nYou now have full access to all features included in your plan. Thank you for choosing to continue with us!\n\nIf you have any questions or need assistance, please don't hesitate to contact our support team.\nBest regards,\n${supportTeamName}`,
  };
};

export const subscriptionCancellationCompletedEmail = (name?: string, tierName?: string, cancellationDate?: string) => {
  return {
    title: 'Subscription Cancelled',
    content: `Dear ${name},\n\nYour ${tierName} subscription has been cancelled and your access to premium features has ended.\n\nSubscription Details:\n• Plan: ${tierName}\n• Cancelled on: ${cancellationDate}\n• Status: Cancelled\n\n⚠️ What this means:\nYou no longer have access to premium features. Your subscription will not auto-renew.\n\n💡 Want to come back?\nYou can resubscribe at any time to regain access to all premium features. Simply visit your account settings and choose a plan that works for you.\n\nIf you have any questions or need assistance, please don't hesitate to contact our support team.\nThank you for being part of our community!\nBest regards,\n${supportTeamName}`,
  };
};

