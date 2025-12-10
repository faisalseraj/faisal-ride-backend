// import * as brevo from '@getbrevo/brevo';

import { SendTemplatedEmail, SendTemplatedEmailWithAttachment } from './email.interfaces';
import {
  acceptRejectPromoteDemoteEmailResponse,
  accountArchivingEmail,
  accountResumeEmail,
  accountRetrievedEmail,
  accountSetupEmail,
  accountSuspensionEmail,
  accountTemporaryBlockedFor24Email,
  crossCompanyAutoApproveActorEmail,
  crossCompanyAutoApproveManagerEmail,
  crossCompanyAutoApproveUserEmail,
  crossCompanyDiscardActorEmail,
  discardTransferEmailContent,
  emailChangeOTP,
  emailChangeOTPNew,
  emailChangeOTPOld,
  emailChangedByManager,
  emailChangedConfirmation,
  emailLoginOTP,
  emailSetRequest,
  forceAssignmentEmailToManager,
  forceAssignmentEmailToPSP,
  forceAssignmentEmailToTowOperator,
  generatePromotionDemotionEmail,
  invoiceCreatedEmail,
  newAccountEmail,
  newUserApprovalDecisionEmailToRequester,
  newUserApprovalRequestToAdminEmail,
  notifyOwnerManagerOfBlockedUser,
  notifySuperAdminsOfRoleChange,
  promoteDemoteEmail,
  reminderToVerifyEmail,
  renterAttachedRemovedNotification,
  renterLicenseAttachedRemovedNotification,
  renterOccupantAttachedRemovedNotification,
  resetPassowrdEmail,
  sendBookingCompletedAndExtensionStartedToPSP,
  sendBookingCompletedAndExtensionStartedToRenter,
  sendCrossCompanyActorNotification,
  sendCrossCompanyManagerNotification,
  sendCrossCompanyUserNotification,
  sendParkingCompletionEmailToParkingProvider,
  sendParkingCompletionEmailToRenter,
  sendParkingConfirmationToRenter,
  sendParkingExtensionConfirmationToRenter,
  sendParkingExtensionNotificationToPSP,
  sendParkingNotificationToPSP,
  sendParkingReminderToRenter,
  sendPasswordAndNameSetupSuccessEmail,
  serviceTeamName,
  subscriptionCancelledEmail,
  subscriptionExpiredEmail,
  subscriptionExpiryReminderEmail,
  subscriptionPaymentFailedEmail,
  subscriptionPaymentRetryEmail,
  subscriptionPaymentSuccessEmail,
  subscriptionRenewalEmail,
  subscriptionUpdatedEmail,
  successfulTransferEmailContent,
  superAdminRoleNotification,
  temporaryBlockedUserAccountDueToInactivity,
  towRequestInvoiceEmail,
  towingAssignmentEmailToManager,
  towingNotificationToTheReferer,
  towingRequestApprovalEmail,
  towingRequestEmail,
  towingRequestFollowUpEmailToManager,
  towingRequestFollowUpEmailToManagerAndOperator,
  towingRequestInviteAcceptedEmailToManager,
  towingRequestInviteAcceptedEmailToUser,
  towingRequestInviteCancelledEmailToInvitee,
  towingRequestInviteCancelledEmailToManager,
  towingRequestInviteEmailToUser,
  towingRequestInviteExpiredEmailToManager,
  towingRequestInviteRejectedEmailToManager,
  towingRequestInviteReminderEmailToUser,
  towingRequestStatusUpdateEmail,
  towingRequestToTowOperator,
  towingRequestUpdatesEmail,
  unusualIpAddress,
  verificationEmailOnAccountCreate,
} from './email.util';

import { ApiError } from '../errors';
import { IBookParkingDoc } from '../book-parking/book-parking.interfaces';
import { ILocation } from '../tow-request/tow-request.interfaces';
import { INewUserDoc } from '../new-user/new-user.interfaces';
import { IUserDoc } from '../user/user.interfaces';
import User from '../user/user.model';
import config from '../../config/config';
import { emailTemplate } from './Template/email-template';
import { emailTemplateV3 } from './Template/email-templateV3';
// import { generateUnsubToken } from '../token/token.service';
import { getUserLanguage } from '../utils/languageUtil';
import httpStatus from 'http-status';
import { logService } from '../logs';
import nodemailer from 'nodemailer';
// import moment from 'moment';
import sgMail from '@sendgrid/mail';
import { smsUtil } from '../sms';
import { userService } from '../user';

export const sendEmailWithNodemailer = async (
  msg: {
    to: string | string[];
    from: any;
    subject: any;
    html: string;
  },

  user?: IUserDoc,
  receiverName?: string
) => {
  const transporter = await nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // STARTTLS (not SSL)
    auth: {
      user: 'noreply@huntITServices.net',
      pass: 'K.573608475551oj', // App password or actual password
    },
    tls: {
      ciphers: 'SSLv3',
    },
  });

  // Email options
  const mailOptions = {
    from: 'Noreply noreply@huntITServices.net',
    to: Array.isArray(msg.to)
      ? msg.to.map((address) => ({ address, name: receiverName! }))
      : [{ address: msg.to, name: receiverName! }],
    subject: msg.subject,
    html: msg.html,
  };

  // Send mail

  try {
    const response = await transporter.sendMail(mailOptions, (error: any, info: any) => {
      if (error) {
        return console.log('Error:', error);
      }
      console.log('Email sent:', info.response);
    });
    if (user?._id || user?.id) {
      await logService.createCommunicationLog({
        user,
        event: msg.subject,
        receiverDetails: {
          content: msg.html,
          sentTo: Array.isArray(msg.to) ? msg.to.join(',') : msg.to,
          name: receiverName!,
          type: 'email',
        },
      });
    }

    return response;
  } catch (error: any) {
    console.dir(error);
    return false;
  }
};

// export const sendEmail = async (
//   msg: {
//     to: string | string[];
//     from: any;
//     subject: any;
//     html: string;
//   },

//   user?: IUserDoc,
//   receiverName?: string
// ) => {
//   const apiInstance = new brevo.TransactionalEmailsApi();
//   apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, config.apiKey);

//   const sendSmtpEmail = {
//     subject: msg.subject,
//     htmlContent: msg.html,
//     sender: { name: config.senderName, email: config.senderEmail },
//     to: Array.isArray(msg.to)
//       ? msg.to.map((email) => ({ email, name: receiverName! }))
//       : [{ email: msg.to, name: receiverName! }],
//     // params: { parameter: "My param value", subject: "common subject" },
//   };
//   try {
//     const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
//     if (user?._id || user?.id) {
//       let ownerId: any;
//       if (user?.userType.includes('employee') || user?.userType?.includes('manager')) {
//         ownerId = await userService.getOwnerIdByUserId(user._id || user.id);
//       }
//       await logService.createCommunicationLog({
//         user,
//         ...(ownerId ? { ownerId } : {}),
//         event: msg.subject,
//         receiverDetails: {
//           content: msg.html,
//           sentTo: Array.isArray(msg.to) ? msg.to.join(',') : msg.to,
//           name: receiverName!,
//           type: 'email',
//         },
//       });
//     }

//     return response;
//   } catch (error: any) {
//     console.dir(error);
//     return false;
//   }
// };
sgMail.setApiKey(config.sendGridKey);

// const transport = nodemailer.createTransport(config.email.smtp);
// /* istanbul ignore next */
// if (config.env !== 'test') {
//   transport
//     .verify()
//     .then(() => logger.info('Connected to email server'))
//     .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));
// }

export const sendEmail = async (
  msg: {
    to: string[] | string;
    from: any;
    subject: string;
    html: string;
    attachments?: Array<{
      filename: string;
        content: string; // base64 encoded
        type: string;
        disposition?: 'attachment' | 'inline';
      }>;
    },
  user?: IUserDoc,
  receiverName?: string
) => {
  const emailPayload: any = {
    ...msg,
    from: { email: config.senderEmail, name: config.senderName },
  };

  // Add attachments if provided
  if (msg.attachments && msg.attachments.length > 0) {
    emailPayload.attachments = msg.attachments;
  }

  await sgMail.send(emailPayload);
  if (user?._id || user?.id) {
    let ownerId: any;
    if (user?.userType.includes('employee') || user?.userType?.includes('manager')) {
      ownerId = await userService.getOwnerIdByUserId(user._id || user.id);
    }
    await logService.createCommunicationLog({
      user,
      ...(ownerId ? { ownerId } : {}),
      event: msg.subject,
      receiverDetails: {
        content: msg.html,
        sentTo: Array.isArray(msg.to) ? msg.to.join(',') : msg.to,
        name: receiverName!,
        type: 'email',
      },
    });
  }
};

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise}
 */
export const sendEmailExternal = async (msg: { to: string; from: any; subject: string; html: string }) => {
  await sgMail.send(msg);
};

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise}
 */
export const sendTemplateEmail = async (emailBody: SendTemplatedEmail) => {
  let payload;
  const { email, subject, content, receiverName } = emailBody;
  if (!emailBody?.link) delete emailBody.link;
  if (!emailBody.linkTitle) delete emailBody.linkTitle;
  const formattedContent = content?.replace(new RegExp('&lt;', 'g'), '<');
  const templatedEmail = await emailTemplate({ ...emailBody, title: subject, content: formattedContent });
  try {
    if (email.includes(',')) {
      const emails = email.split(',').map((email) => email.replace(/\s+/g, ''));
      payload = {
        // to: email, // Recipient's email
        from: config.from, // Your email
        subject: subject,
        html: templatedEmail,
        to: emails,
      };
    } else {
      payload = {
        to: email, // Recipient's email
        from: config.from, // Your email
        subject: subject,
        html: templatedEmail,
      };
    }
    payload;
    receiverName;
    // await sgMail.send(payload);
    // await sendEmail(payload, undefined, receiverName);
    return { success: true, email: templatedEmail };
  } catch (e) {
    return { success: false, email: templatedEmail };
  }
};

export const sendTemplatedEmailWithAttachment = async (emailBody: SendTemplatedEmailWithAttachment) => {
  let payload: any;
  const { email, subject, content, attachment } = emailBody;

  // Rest of your code remains the same...
  const templatedEmail = await emailTemplate({ ...emailBody, title: subject, content });
  if (email.includes(',')) {
    const emails = email.split(',').map((email) => ({ to: email.replace(/\s+/g, '') }));
    payload = {
      from: config.from,
      subject: subject,
      html: templatedEmail,
      personalizations: emails,
      ...(attachment ? { attachments: [attachment] } : {}),
    };
  } else {
    payload = {
      to: email,
      from: config.from,
      subject: subject,
      html: templatedEmail,
      ...(attachment ? { attachments: [attachment] } : {}),
      // Add the attachment to the payload
    };
  }

  await sgMail.send(payload);
  return templatedEmail;
};

export const sendTemplatedEmailWithAttachmentV3 = async (emailBody: SendTemplatedEmailWithAttachment) => {
  let payload: any;
  const { email, subject, content, attachment } = emailBody;
  // const expires = moment().add(1, 'years');
  // const encryptedEmail = await generateUnsubToken({ contactInfo: email, source: 'EMAIL_API' }, expires, 'EMAIL');
  // const linkToUnsub = `${config.clientUrl}/unsub?tk=${encryptedEmail}`;

  // Rest of your code remains the same...
  const templatedEmail = await emailTemplateV3({ ...emailBody, title: subject, content });
  if (email.includes(',')) {
    const emails = email.split(',').map((email) => ({ to: email.replace(/\s+/g, '') }));
    payload = {
      from: config.from,
      subject: subject,
      html: templatedEmail,
      personalizations: emails,
      ...(attachment ? { attachments: [attachment] } : {}),
    };
  } else {
    payload = {
      to: email,
      from: config.from,
      subject: subject,
      html: templatedEmail,
      ...(attachment ? { attachments: [attachment] } : {}),
      // Add the attachment to the payload
    };
  }

  await sgMail.send(payload);
  return templatedEmail;
};

// Only testing purpose not used in any API
export async function sendEmailWithAttachment(attachment: any) {
  const msg = {
    to: 'faisalseraj47@gmail.com', // Replace with recipient email address
    from: config.from,
    subject: 'PDF Report',
    text: 'Please find the attached PDF report.',
    attachments: [attachment],
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent successfully');
  } catch (error: any) {
    console.error('Error sending email:', error.toString());
  }
}

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendResetPasswordEmail = async (to: string, token: string, name: string, user: IUserDoc) => {
  try {
    // replace this url with the link to the reset password page of your front-end app
    const languageCode = await getUserLanguage(user);

    const MLEmail = resetPassowrdEmail(name, languageCode.fullForm);
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}`;
    const subject = MLEmail.subject;
    const linkProps = { link: resetPasswordUrl, linkTitle: MLEmail.button };
    const text = MLEmail.body;
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, ...linkProps, direction: MLEmail.dir }),
    };

    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendVerificationEmail = async (to: string, token: string, name: string, user: IUserDoc) => {
  try {
    const MLEmail = verificationEmailOnAccountCreate(user.fullName, user.preferredLanguage || 'english');

    const subject = MLEmail.Subject;
    // replace this url with the link to the email verification page of your front-end app
    let verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;

    const text = MLEmail.Content;
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        link: verificationEmailUrl,
        linkTitle: MLEmail.button,
        direction: user.preferredLanguage === 'arabic' || user.preferredLanguage === 'hebrew' ? 'rtl' : 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendNewAccountEmail = async (to: string, token: string, name: string, user: IUserDoc, password?: string) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}&isFirstLogin=true`;

    const linkProps = { link: resetPasswordUrl, linkTitle: 'Verify Account' };

    const languageCode = await getUserLanguage(user);
    const titleAndContent = newAccountEmail(languageCode.fullForm, name, password);

    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        ...linkProps,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendApprovalRequestToAdminForNewAccount = async (
  to: string | string[],
  name: string,
  user: INewUserDoc,
  emailContent: {
    requesterName: string;
    requesterEmail: string;
    newUserName: string;
    newUserEmail: string;
    newUserType: string;
  }
) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;

    const approve = `${config.clientUrl}/user/approve-reject?uid=${user.id}&status=accept`;
    const reject = `${config.clientUrl}/user/approve-reject?uid=${user.id}&status=reject`;

    const link2 = { link: approve, linkTitle: 'Approve', variant: 'success' };
    const linkProps = { link: reject, linkTitle: 'Reject' };

    const titleAndContent = newUserApprovalRequestToAdminEmail(emailContent);

    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        ...linkProps,
        link2,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user as any, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendSuperadminRoleNotification = async (to: string, name: string, user: IUserDoc) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    const titleAndContent = superAdminRoleNotification(name, user.isSuperAdmin ? user.isSuperAdmin : false);

    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const notifyAllSuperadminsOfNewSuperAdmin = async (to: string[], user: IUserDoc) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    const titleAndContent = notifySuperAdminsOfRoleChange(
      user.email!,
      user.fullName!,
      user.isSuperAdmin ? user.isSuperAdmin : false
    );

    const msg = {
      to: to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user, 'All super admins');
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const promoteDemoteUserRequest = async (
  to: string,
  token: string,
  name: string,
  user: IUserDoc,
  requestDetails: {
    toUpdateUser: IUserDoc;
    requestCreatedBy: IUserDoc;
    comments?: string;
  }
) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    const promte = `${config.clientUrl}/promote-demote?token=${token}&status=accept`;
    const demote = `${config.clientUrl}/promote-demote?token=${token}&status=reject`;

    const linkProps = { link: demote, linkTitle: 'Reject' };
    const link2 = { link: promte, linkTitle: 'Accept', variant: 'success' };

    const titleAndContent = promoteDemoteEmail(name, requestDetails);
    const html = await emailTemplate({
      ...titleAndContent,
      ...linkProps,
      link2,
      direction: 'ltr',
    });
    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html,
    };
    await sendEmail(msg, user, name);
    return html;
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const acceptRejectPromoteDemoteEmail = async (
  to: string,
  name: string,
  user: IUserDoc,
  requestDetails: {
    toUpdateUser: IUserDoc;
    requestCreatedBy: IUserDoc;
    comments?: string;
  },
  decision: 'accepted' | 'rejected'
) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;

    const titleAndContent = acceptRejectPromoteDemoteEmailResponse(decision, requestDetails);
    const html = await emailTemplate({
      ...titleAndContent,
      direction: 'ltr',
    });
    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html,
    };
    await sendEmail(msg, user, name);
    return html;
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const newUserApprovalDecision = async (
  to: string,
  name: string,
  user: IUserDoc,
  requestDetails: {
    toUpdateUser: IUserDoc;
    requestCreatedBy: IUserDoc;
    comments?: string;
  },
  decision: 'approved' | 'rejected'
) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;

    const titleAndContent = newUserApprovalDecisionEmailToRequester(decision, requestDetails);
    const html = await emailTemplate({
      ...titleAndContent,
      direction: 'ltr',
    });
    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html,
    };
    await sendEmail(msg, user, name);
    return html;
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendAccountEmailChanged = async (
  to: string,
  token: string,
  name: string,
  user: IUserDoc,
  password?: string
) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}&isFirstLogin=true`;

    const linkProps = { link: resetPasswordUrl, linkTitle: 'Verify Account' };

    const languageCode = await getUserLanguage(user);
    const titleAndContent = emailChangedByManager(languageCode.fullForm, name, password);
    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        ...linkProps,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const sendEmailChangedConfirmation = async (to: string, name: string, user: IUserDoc) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;

    const titleAndContent = emailChangedConfirmation(name);
    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
export const resendAccountVerificationEmail = async (to: string, token: string, name: string, user: IUserDoc) => {
  try {
    // replace this url with the link to the email verification page of your front-end app
    // const verificationEmailUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}&isFirstLogin=true`;

    const linkProps = { link: resetPasswordUrl, linkTitle: 'Verify Account' };

    const languageCode = await getUserLanguage(user);
    const titleAndContent = reminderToVerifyEmail(languageCode.fullForm, name);

    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        ...linkProps,
        direction: 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email ' + e);
  }
};

// deprecated for now
/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendChangeEmail = async (to: string, code: string, name: string, user: IUserDoc) => {
  try {
    const languageCode = await getUserLanguage(user);

    const MLEmail = emailChangeOTP(name, languageCode.fullForm, code);
    const subject = MLEmail.subject;
    const text = MLEmail.body;
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: MLEmail.dir }),
    };

    await sendEmail(msg, user, name);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendChangeEmailOld = async (to: string, code: string, name: string, user: IUserDoc) => {
  try {
    const languageCode = await getUserLanguage(user);

    const MLEmail = emailChangeOTPOld(name, languageCode.fullForm, code);
    const subject = MLEmail.subject;
    const text = MLEmail.body;
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: MLEmail.dir }),
    };

    await sendEmail(msg, user, name);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendChangeEmailNew = async (to: string, code: string, name: string, user: IUserDoc) => {
  try {
    const languageCode = await getUserLanguage(user);

    const MLEmail = emailChangeOTPNew(name, languageCode.fullForm, code);
    const subject = MLEmail.subject;
    const text = MLEmail.body;
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: MLEmail.dir }),
    };

    await sendEmail(msg, user, name);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendLoginOtp = async (to: string, code: string, name: string, user: IUserDoc) => {
  try {
    const MLEmail = emailLoginOTP(name, code);
    const subject = MLEmail.subject;
    const text = MLEmail.body;
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: MLEmail.dir }),
    };

    await sendEmail(msg, user, name);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendSetEmail = async (to: string, code: string, name: string, user: IUserDoc) => {
  try {
    const languageCode = await getUserLanguage(user);

    const titleAndContent = emailSetRequest(languageCode.fullForm, name, code);
    const msg = {
      to,
      from: config.from,
      subject: titleAndContent.title,
      html: await emailTemplate({
        ...titleAndContent,
        direction: languageCode.fullForm === 'arabic' || languageCode.fullForm === 'hebrew' ? 'rtl' : 'ltr',
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email ' + e);
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendUnusualIpEmail = async (
  to: string,
  name: string,
  ipAddress: string,
  location: string,
  token: string,
  user: IUserDoc
) => {
  try {
    const language = await getUserLanguage(user);
    const mlEmail = unusualIpAddress({ name: user.fullName!, countryLanguage: language.fullForm, ipAddress, location });
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}`;
    const linkProps = { link: resetPasswordUrl, linkTitle: mlEmail.button };

    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        direction: mlEmail.dir,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, name);
  } catch (e) {
    console.log(e, 'email error');
    // await logService.createLog({
    //   user: user!,
    //   onlyAdmin: user.userType.includes('owner'),

    //   event: ALL_EVENTS.UserEvents.failedUnusualAlert(user.phoneNumber, user?.fullName, JSON.stringify(e)),
    //   eventEnum: 'UE',
    // });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email' + e);
  }
};

/**
 * Send archive email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendArchiveEmail = async (user: IUserDoc) => {
  try {
    const language = await getUserLanguage(user);
    const mlEmail = accountArchivingEmail(user.fullName!, language.fullForm);
    const subject = mlEmail.subject;
    const text = mlEmail.body;

    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: mlEmail.dir }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send archive email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendPromotionDemotionEmail = async ({
  companyName,
  newStatus,
  user,
}: {
  newStatus: 'promoted' | 'demoted';
  companyName: string;
  user: IUserDoc;
}) => {
  try {
    const mlEmail = await generatePromotionDemotionEmail({
      companyName,
      newStatus,
      name: user.fullName as string,
      userType: user.userType,
    });
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: mlEmail.dir }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send retrieval email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendRetrieveEmail = async (user: IUserDoc) => {
  try {
    const language = await getUserLanguage(user);
    const mlEmail = accountRetrievedEmail(user.fullName!, language.fullForm);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const loginURL = `${config.clientUrl}/sign-in/${'email'}`;

    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        link: loginURL,
        linkTitle: mlEmail.button,
        direction: mlEmail.dir,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send suspension email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendSuspensionEmail = async (user: IUserDoc) => {
  try {
    const language = await getUserLanguage(user);
    const mlEmail = accountSuspensionEmail(user.fullName!, language.fullForm);
    const subject = mlEmail.subject;
    const text = mlEmail.body;

    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: mlEmail.dir }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send resume email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendResumeEmail = async (user: IUserDoc) => {
  try {
    const language = await getUserLanguage(user);
    const mlEmail = accountResumeEmail(user.fullName!, language.fullForm);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const loginURL = `${config.clientUrl}/sign-in/${'email'}`;

    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        link: loginURL,
        linkTitle: mlEmail.button,
        direction: mlEmail.dir,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendTBFor24Email = async (user: IUserDoc, token: string) => {
  try {
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}`;

    const language = await getUserLanguage(user);
    const mlEmail = accountTemporaryBlockedFor24Email(user.fullName!, language.fullForm);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const linkProps = { link: resetPasswordUrl, linkTitle: mlEmail.button };

    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
        direction: mlEmail.dir,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendNotificationToOwnerManagerOfBlockedUser = async (name: string, user: IUserDoc, sendTo: string) => {
  try {
    const mlEmail = notifyOwnerManagerOfBlockedUser(name, user);
    const subject = mlEmail.subject;
    const text = mlEmail.body;

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendClosingAccountEmail = async (user: IUserDoc) => {
  try {
    const subject = 'Account Closure Confirmation';
    // replace this url with the link to the email verification page of your front-end app
    const text = `Dear ${user.fullName},
    We regret to inform you that your account has been closed.
    If you have any further inquiries or require assistance, please reach out to our support team.
   
    Thank you for your past support.
    
    Best regards,
    Your Support Team    
    `;
    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendTemporaryBlockingAccountEmail = async (user: IUserDoc, token: string) => {
  try {
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}`;
    const language = await getUserLanguage(user);

    const mlEmail = temporaryBlockedUserAccountDueToInactivity(user.fullName!, language.fullForm);
    const subject = mlEmail.subject;
    const linkProps = { link: resetPasswordUrl, linkTitle: mlEmail.button };
    const text = mlEmail.body;
    const msg = {
      to: user.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
        direction: mlEmail.dir,
      }),
    };

    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendContactSupportEmail = async ({
  to,
  toName,
  name,
  phoneNumber,
  email,
  subject,
  description,
  user,
}: {
  to: string;
  toName: string;
  name: string;
  email: string;
  phoneNumber?: string;
  subject: string;
  description: string;
  user: IUserDoc;
}) => {
  const sub = 'User Support Request: Account Reactivation';
  // replace this url with the link to the email verification page of your front-end app
  const text = `Hello ${toName},
  We would like to bring to your attention that a user has submitted a support request for account reactivation. Here are the details of the request:

  - User's Name: ${name}
  - User's Email: ${email} ${
    !phoneNumber
      ? ''
      : `
   - User's Phone number: ${phoneNumber}`
  }
  - Subject of the Issue: ${subject}
  - Description of the Issue: ${description}

  Kindly review the user's request and take necessary steps to assist them in reactivating their account. Should you require any additional information from the user, please feel free to respond to this email thread or directly reach out to them.
  Your swift attention to this matter is greatly appreciated.
  Best regards,
  Your Support Team
  `;

  const content = await emailTemplate({ title: subject, content: text });
  try {
    const msg = {
      to,
      from: config.from,
      subject: sub,
      html: content,
    };

    // await logService.createCommunicationLog({
    //   user: user!,

    //   event: ALL_EVENTS.userCommunication.ContactSupportEmail(user),
    //   eventEnum: 'ComE',
    //   receiverDetails: {
    //     content: content,
    //     sentTo: email,
    //     isFailed: false,
    //     type: 'email',
    //     name: user.fullName!,
    //   },
    // });
    await sendEmail(msg, user, name);
  } catch (e) {
    // await logService.createCommunicationLog({
    //   user: user!,

    //   event: ALL_EVENTS.userCommunication.ContactSupportEmail(user),
    //   eventEnum: 'ComE',
    //   receiverDetails: {
    //     content: content,
    //     sentTo: email,
    //     isFailed: true,
    //     type: 'email',
    //     name: user.fullName!,
    //   },
    // });
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send contact support email
 * @param {string} to
 * @param {string} name
 * @param {string} subject
 * @param {string} description
 * @returns {Promise}
 */
export const sendContactSupportEmailForHuntItServices = async ({
  to,
  toName,
  name,
  email,
  description,
  company,
}: {
  to: string;
  toName: string;
  name: string;
  email: string;
  company?: string;
  description: string;
}) => {
  const subject = `New Contact Request`;

  const text = `Hello ${toName},

You have received a new contact request from the Hunt IT Services website. Below are the details submitted by the user:

- Name: ${name}
- Email: ${email}
- Company: ${company}
- Message:
${description}

Please review the request and respond accordingly. You may reach out to the user via their provided contact information.

Best regards,  
Hunt IT Services – Contact Form Notification`;

  const content = await emailTemplate({ title: 'New Contact Request', content: text });

  try {
    const msg = {
      to,
      from: config.from,
      subject: subject,
      html: content,
    };
    await sendEmail(msg, undefined, name);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/*** Send Email to Sales || Tech agents when their status changed ***/
export const sendEmailOnStatusChange = async (to: string, text: string) => {
  try {
    const subject = 'Site status changed';

    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, linkTitle: 'Status Change' }),
    };
    await sgMail.send(msg);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email' + e);
  }
};

export const sendCustomEmail = async (
  to: string,
  subject: string,
  text: string,
  direction: string = 'ltr',
  invoiceTemplate: string = ''
) => {
  try {
    const msg = {
      to,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: text, direction: direction, invoiceTemplate }),
    };
    await sgMail.send(msg);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email' + e);
  }
};

// Subscription email functions
export const sendSubscriptionPaymentSuccessEmail = async (
  user: IUserDoc,
  tierName: string,
  amount: number,
  nextBillingDate: string
) => {
  try {
    const emailContent = subscriptionPaymentSuccessEmail(user.fullName, tierName, amount, nextBillingDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Payment Successful, Subscription Confirmed',
      `A user has successfully completed their subscription payment.\n\nUser: ${user.fullName} (${user.email})\nTier: ${tierName}\nAmount: $${amount}\nNext Billing Date: ${nextBillingDate}`,
      { userEmail: user.email, userName: user.fullName, tierName, amount, nextBillingDate }
    ).catch(error => console.error('Error sending admin notification for payment success:', error));
  } catch (error) {
    console.error('Error sending subscription payment success email:', error);
  }
};

export const sendSubscriptionCancelledEmail = async (user: IUserDoc, tierName: string, endDate: string) => {
  try {
    const emailContent = subscriptionCancelledEmail(user.fullName, tierName, endDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Cancellation Scheduled',
      `A user has scheduled their subscription cancellation.\n\nUser: ${user.fullName} (${user.email})\nTier: ${tierName}\nCancellation Date: ${endDate}\nStatus: Active until period end\n\nNote: The user can still reactivate their subscription before the cancellation date.`,
      { userEmail: user.email, userName: user.fullName, tierName, endDate, scheduledFor: 'period_end' }
    ).catch(error => console.error('Error sending admin notification for subscription cancellation:', error));
  } catch (error) {
    console.error('Error sending subscription cancelled email:', error);
  }
};

export const sendSubscriptionReactivatedEmail = async (user: IUserDoc, tierName: string, nextBillingDate: string) => {
  try {
    const { subscriptionReactivatedEmail: emailContentFunction } = require('./email.util');
    const emailContent = emailContentFunction(user.fullName, tierName, nextBillingDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Reactivated',
      `A user has reactivated their subscription.\n\nUser: ${user.fullName} (${user.email})\nTier: ${tierName}\nNext Billing Date: ${nextBillingDate}\nStatus: Active\n\nThe user has chosen to continue their subscription.`,
      { userEmail: user.email, userName: user.fullName, tierName, nextBillingDate }
    ).catch(error => console.error('Error sending admin notification for subscription reactivation:', error));
  } catch (error) {
    console.error('Error sending subscription reactivated email:', error);
  }
};

export const sendSubscriptionCancellationCompletedEmail = async (user: IUserDoc, tierName: string, cancellationDate: string) => {
  try {
    const { subscriptionCancellationCompletedEmail: emailContentFunction } = require('./email.util');
    const emailContent = emailContentFunction(user.fullName, tierName, cancellationDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Cancellation Completed',
      `A subscription has been fully cancelled.\n\nUser: ${user.fullName} (${user.email})\nTier: ${tierName}\nCancellation Date: ${cancellationDate}\nStatus: Cancelled\n\nThe subscription period has ended and access has been revoked.`,
      { userEmail: user.email, userName: user.fullName, tierName, cancellationDate }
    ).catch(error => console.error('Error sending admin notification for subscription completion:', error));
  } catch (error) {
    console.error('Error sending subscription cancellation completed email:', error);
  }
};

export const sendInvoiceCreatedEmail = async (
  user: IUserDoc,
  tierName: string,
  amount: number,
  nextBillingDate: string
) => {
  try {
    const emailContent = invoiceCreatedEmail(user.fullName, tierName, amount, nextBillingDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);
  } catch (error) {
    console.error('Error sending invoice created email:', error);
  }
};

export const sendSubscriptionRenewalEmail = async (
  user: IUserDoc,
  tierName: string,
  amount: number,
  nextBillingDate: string
) => {
  try {
    const emailContent = subscriptionRenewalEmail(user.fullName, tierName, amount, nextBillingDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Renewed',
      `A user's subscription has been automatically renewed.\n\nUser: ${user.fullName} (${user.email})\nTier: ${tierName}\nAmount: $${amount}\nNext Billing Date: ${nextBillingDate}`,
      { userEmail: user.email, userName: user.fullName, tierName, amount, nextBillingDate }
    ).catch(error => console.error('Error sending admin notification for subscription renewal:', error));
  } catch (error) {
    console.error('Error sending subscription renewal email:', error);
  }
};

export const sendSubscriptionUpdatedEmail = async (
  user: IUserDoc,
  oldTierName: string,
  newTierName: string,
  amount: number
) => {
  try {
    const emailContent = subscriptionUpdatedEmail(user.fullName, oldTierName, newTierName, amount);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Updated Successfully',
      `A user has updated their subscription.\n\nUser: ${user.fullName} (${user.email})\nPrevious Plan: ${oldTierName}\nNew Plan: ${newTierName}\nNew Amount: $${amount}`,
      { userEmail: user.email, userName: user.fullName, oldTierName, newTierName, amount }
    ).catch(error => console.error('Error sending admin notification for subscription update:', error));
  } catch (error) {
    console.error('Error sending subscription updated email:', error);
  }
};

export const sendSubscriptionUpgradeEmail = async (
  user: IUserDoc,
  oldTierName: string,
  newTierName: string,
  oldPrice: number,
  newPrice: number,
  proratedAmount: number,
  nextBillingDate: Date
) => {
  try {
    const { subscriptionUpgradeEmail: emailContentFunction } = require('./email.util');
    const emailContent = emailContentFunction(user.fullName, oldTierName, newTierName, oldPrice, newPrice, proratedAmount, nextBillingDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Upgraded',
      `A user has upgraded their subscription.\n\nUser: ${user.fullName} (${user.email})\nPrevious Plan: ${oldTierName} ($${oldPrice})\nNew Plan: ${newTierName} ($${newPrice})\nProrated Amount: $${proratedAmount}`,
      { userEmail: user.email, userName: user.fullName, oldTierName, newTierName, oldPrice, newPrice, proratedAmount }
    ).catch(error => console.error('Error sending admin notification for subscription upgrade:', error));
  } catch (error) {
    console.error('Error sending subscription upgrade email:', error);
  }
};

export const sendSubscriptionDowngradeEmail = async (
  user: IUserDoc,
  oldTierName: string,
  newTierName: string,
  oldPrice: number,
  newPrice: number,
  effectiveDate: Date
) => {
  try {
    const { subscriptionDowngradeEmail: emailContentFunction } = require('./email.util');
    const emailContent = emailContentFunction(user.fullName, oldTierName, newTierName, oldPrice, newPrice, effectiveDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Subscription Downgraded',
      `A user has downgraded their subscription.\n\nUser: ${user.fullName} (${user.email})\nCurrent Plan: ${oldTierName} ($${oldPrice})\nNew Plan: ${newTierName} ($${newPrice})\nEffective Date: ${effectiveDate.toLocaleDateString()}`,
      { userEmail: user.email, userName: user.fullName, oldTierName, newTierName, oldPrice, newPrice, effectiveDate }
    ).catch(error => console.error('Error sending admin notification for subscription downgrade:', error));
  } catch (error) {
    console.error('Error sending subscription downgrade email:', error);
  }
};

export const sendSubscriptionPaymentFailedEmail = async (user: IUserDoc, tierName: string, retryDate: string) => {
  try {
    const emailContent = subscriptionPaymentFailedEmail(user.fullName, tierName, retryDate);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName);

    // Send admin notification (non-blocking)
    sendAdminNotificationForSubscriptionEvent(
      'Payment Failed',
      `A user's payment has failed and requires attention.\n\nUser: ${user.fullName} (${user.email})\nTier: ${tierName}\nRetry Date: ${retryDate}`,
      { userEmail: user.email, userName: user.fullName, tierName, retryDate }
    ).catch(error => console.error('Error sending admin notification for payment failure:', error));
  } catch (error) {
    console.error('Error sending subscription payment failed email:', error);
  }
};

/**
 * Send admin notification for subscription events (non-blocking)
 * @param {string} subject - Email subject
 * @param {string} content - Email content
 * @param {any} eventData - Additional event data
 */
const sendAdminNotificationForSubscriptionEvent = async (subject: string, content: string, eventData?: any): Promise<void> => {
  try {
    // Find all admin users
    const adminUsers = await User.find({
      $or: [
        { userType: 'admin' },
        { isSuperAdmin: true }
      ]
    });

    // Send email to each admin (non-blocking)
    for (const admin of adminUsers) {
      if (admin.email) {
        const msg = {
          to: admin.email,
          from: config.from,
          subject: `Subscription Alert - ${subject}`,
          html: await emailTemplate({ 
            title: `Subscription Alert - ${subject}`, 
            content: `${content}\n\nEvent Details:\n${JSON.stringify(eventData, null, 2)}` 
          }),
        };
        
        // Send email without waiting for response
        sendEmail(msg, admin, admin.fullName).catch(error => 
          console.error(`Error sending admin notification to ${admin.email}:`, error)
        );
      }
    }
  } catch (error) {
    console.error('Error in sendAdminNotificationForSubscriptionEvent:', error);
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendRenterOnboardAndOffboardEmails = async (
  {
    apartmentComplexName,
    apartmentNumber,
    reason,
  }: { apartmentComplexName: string; reason: string; apartmentNumber: string },
  user: IUserDoc
) => {
  try {
    const mlEmail = renterAttachedRemovedNotification(user.fullName!, apartmentComplexName, apartmentNumber, reason);
    const subject = mlEmail.subject;
    const text = mlEmail.body;

    const msg = {
      to: user?.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};
/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendOccupantCreateAndDeleteEmails = async (
  {
    apartmentComplexName,
    apartmentNumber,
    reason,
  }: {
    apartmentComplexName: string;
    reason: 'occupant-added' | 'occupant-removed' | 'occupant-detached' | 'occupant-attached';
    apartmentNumber: string;
  },
  user: IUserDoc,
  occupant?: {
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
  }
) => {
  try {
    const mlEmail = renterOccupantAttachedRemovedNotification(
      user.fullName!,
      apartmentComplexName,
      apartmentNumber,
      reason,
      occupant
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;

    const msg = {
      to: user?.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendRenterLicenseAttachedRemovedNotification = async (
  renterName: string,
  complexName: string,
  apartmentNumber: string,
  reason: 'new' | 'deleted' | 'updated' | 'attached',
  user: IUserDoc,

  license?: {
    plate: string;
    stateShort: string;
  }
) => {
  try {
    const mlEmail = renterLicenseAttachedRemovedNotification(renterName, complexName, apartmentNumber, reason, license);
    const subject = mlEmail.subject;
    const text = mlEmail.body;

    const msg = {
      to: user?.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendTowingNotification = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  isTowOperator: boolean
) => {
  try {
    const mlEmail = towingRequestEmail(name, coordinates, requesterInfo, licensePlates, isTowOperator);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

export const sendTowingNotificationToReferer = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  try {
    const mlEmail = towingNotificationToTheReferer(name, coordinates, requesterInfo, licensePlates);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendTowingNotificationToTowOperator = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  assignedBy: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  try {
    const mlEmail = towingRequestToTowOperator(
      name,
      coordinates,
      requesterInfo,
      assignedBy,
      licensePlates,
      towRequestId,
      towOperatorLocation
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendTowingAssignmentEmailToManager = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  assignedBy: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  try {
    const mlEmail = towingAssignmentEmailToManager(
      name,
      coordinates,
      requesterInfo,
      assignedBy,
      licensePlates,
      towRequestId,
      towOperatorLocation
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send force assignment email to tow operator
 */
export const sendForceAssignmentEmailToTowOperator = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  assignedBy: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  try {
    const mlEmail = forceAssignmentEmailToTowOperator(
      name,
      coordinates,
      requesterInfo,
      assignedBy,
      licensePlates,
      towRequestId,
      towOperatorLocation
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/**
 * Send force assignment email to manager
 */
export const sendForceAssignmentEmailToManager = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  assignedBy: IUserDoc,
  assignedTo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  try {
    const mlEmail = forceAssignmentEmailToManager(
      name,
      coordinates,
      requesterInfo,
      assignedBy,
      assignedTo,
      licensePlates,
      towRequestId,
      towOperatorLocation
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/**
 * Send force assignment email to parking space provider
 */
export const sendForceAssignmentEmailToPSP = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  assignedBy: IUserDoc,
  assignedTo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string,
  towOperatorLocation: ILocation
) => {
  try {
    const mlEmail = forceAssignmentEmailToPSP(
      name,
      coordinates,
      assignedBy,
      assignedTo,
      licensePlates,
      towRequestId,
      towOperatorLocation
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/**
 * Send towing request status update email
 * @param {string} name - Recipient name
 * @param {string} status - New status
 * @param {string} towRequestId
 * @param {IUserDoc} loggedInUser - User who updated status
 * @param {ILocation} coordinates
 * @param {Array} licensePlates
 * @param {'MANAGER'|'OPERATOR'|'REQUESTER'} role - Role of the recipient
 * @param {string} sendTo - Recipient email
 */
export const towingRequestStatusUpdateEmailToLinkedUsers = async (
  name: string,
  status: string,
  towRequestId: string,
  loggedInUser: IUserDoc,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  role: 'MANAGER' | 'OPERATOR' | 'REQUESTER',
  sendTo: string,
  pdfAttachment?: Buffer
) => {
  try {
    // generate role-specific email content
    const mlEmail = towingRequestStatusUpdateEmail(
      name,
      status,
      towRequestId,
      loggedInUser,
      coordinates,
      licensePlates,
      role
    );

    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg: any = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };

    // Add PDF attachment if provided (only for COMPLETED status)
    if (pdfAttachment && status === 'COMPLETED') {
      msg.attachments = [
        {
          filename: `Invoice_${towRequestId}.pdf`,
          content: pdfAttachment.toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ];
    }

    await sendEmail(msg, loggedInUser, loggedInUser.fullName!);
  } catch (e) {
    console.error(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/**
 * Send invoice email with PDF attachment
 * @param {string} recipientEmail - Email address to send invoice to
 * @param {string} recipientName - Name of the recipient
 * @param {string} towRequestId - Tow request ID
 * @param {string} invoiceNumber - Invoice number (optional)
 * @param {Buffer} pdfBuffer - PDF buffer to attach
 * @param {IUserDoc} loggedInUser - User who triggered the email
 */
export const sendInvoiceEmail = async (
  recipientEmail: string,
  recipientName: string,
  towRequestId: string,
  invoiceNumber: string | undefined,
  pdfBuffer: Buffer,
  loggedInUser: IUserDoc
): Promise<void> => {
  try {
    const invoiceEmail = towRequestInvoiceEmail(recipientName, towRequestId, invoiceNumber);

    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg: any = {
      to: recipientEmail,
      from: config.from,
      subject: invoiceEmail.subject,
      html: await emailTemplate({
        title: invoiceEmail.subject,
        content: invoiceEmail.body,
        ...linkProps,
      }),
      attachments: [
        {
          filename: `Invoice_${invoiceNumber || towRequestId}.pdf`,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    await sendEmail(msg, loggedInUser, recipientName);
  } catch (e) {
    console.error(e, 'invoice email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending invoice email');
  }
};

/**
 * Send account setup link email
 * @param {string} recipientEmail - Email address to send setup link to
 * @param {string} setupLink - Account setup link
 * @param {string} recipientName - Name of the recipient
 * @param {IUserDoc} loggedInUser - User who triggered the email
 */
export const sendAccountSetupLink = async (
  recipientEmail: string,
  setupLink: string,
  recipientName: string,
  loggedInUser: IUserDoc
): Promise<void> => {
  try {
    const emailContent = accountSetupEmail(recipientName, setupLink);

    const msg: any = {
      to: recipientEmail,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
        link: setupLink,
        linkTitle: 'Complete Account Setup',
      }),
    };

    await sendEmail(msg, loggedInUser, recipientName);
  } catch (e) {
    console.error(e, 'account setup email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending account setup email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingConfirmationEmailToPSP = async (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string,
  sendTo: string,
  user: any
) => {
  try {
    const mlEmail = sendParkingNotificationToPSP(name, user, licensePlate, parkingStartTime, parkingEndTime, parkingId);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/book/parking/?parkingId=${parkingId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingConfirmationEmailToRenter = async (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string,
  sendTo: string,
  user: any
) => {
  try {
    const mlEmail = sendParkingConfirmationToRenter(name, user, licensePlate, parkingStartTime, parkingEndTime, parkingId);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/book/parking/?parkingId=${parkingId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingEndingEmailToRenter = async (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string,
  sendTo: string,
  user: any,
  provider: any
) => {
  try {
    const mlEmail = sendParkingReminderToRenter(name, provider, licensePlate, parkingStartTime, parkingEndTime, parkingId);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewParking = `${config.clientUrl}/my-bookings?parkingId=${parkingId}&type=extend`;
    const linkProps = { link: viewParking, linkTitle: 'Extend Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingCompletionEmailToRenter = async (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string,
  sendTo: string,
  user: any
) => {
  try {
    const mlEmail = sendParkingCompletionEmailToRenter(name, licensePlate, parkingStartTime, parkingEndTime, parkingId);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewParking = `${config.clientUrl}/my-bookings?parkingId=${parkingId}&type=preview`;
    const linkProps = { link: viewParking, linkTitle: 'View Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingCompletionEmailToParkingProvider = async (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  parkingId: string,
  sendTo: string,
  user: any,
  renter: any
) => {
  try {
    const mlEmail = sendParkingCompletionEmailToParkingProvider(
      name,
      licensePlate,
      parkingStartTime,
      parkingEndTime,
      parkingId,
      renter
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewParking = `${config.clientUrl}/my-bookings?parkingId=${parkingId}&type=preview`;
    const linkProps = { link: viewParking, linkTitle: 'View Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send booking extension email to Parking Space Provider (PSP)
 */
export const sendBookingExtensionEmailToPSP = async (
  name: string,
  licensePlate: string,
  newParkingEndTime: string,
  extendedHours: number,
  parkingId: string,
  sendTo: string,
  user: any
) => {
  try {
    const mlEmail = sendParkingExtensionNotificationToPSP(
      name,
      user,
      licensePlate,
      newParkingEndTime,
      extendedHours,
      parkingId
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewBooking = `${config.clientUrl}/book/parking/?parkingId=${parkingId}`;
    const linkProps = { link: viewBooking, linkTitle: 'View Updated Booking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};

/**
 * Send booking extension email to Renter
 */
export const sendBookingExtensionEmailToRenter = async (
  name: string,
  licensePlate: string,
  newParkingEndTime: string,
  extendedHours: number,
  parkingId: string,
  sendTo: string,
  user: any
) => {
  try {
    const mlEmail = sendParkingExtensionConfirmationToRenter(
      name,
      user,
      licensePlate,
      newParkingEndTime,
      extendedHours,
      parkingId
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewBooking = `${config.clientUrl}/book/parking/?parkingId=${parkingId}`;
    const linkProps = { link: viewBooking, linkTitle: 'View Updated Booking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending email');
  }
};
export const towingRequestFollowUpEmailToLinkedUsers = async (
  towRequestId: string,
  status: string,
  managers: IUserDoc[],
  assignedOperator: IUserDoc | null,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[]
) => {
  try {
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    if (status === 'PENDING_ASSIGNMENT') {
      // Manager only
      await Promise.all(
        managers.map(async (manager) => {
          const email = towingRequestFollowUpEmailToManager(manager.fullName!, towRequestId, coordinates, licensePlates);

          const msg = {
            to: manager.email!,
            from: config.from,
            subject: email.subject,
            html: await emailTemplate({
              title: email.subject,
              content: email.body,
              link: viewTow,
              linkTitle: 'Review Tow Request',
            }),
          };

          await sendEmail(msg, manager, manager.fullName!);
        })
      );
    }

    if (status === 'ASSIGNED' && assignedOperator) {
      // Build operator email once (same for all managers)
      const { operator: operatorEmail } = towingRequestFollowUpEmailToManagerAndOperator(
        managers?.[0]?.fullName!, // safe to take first manager for operator copy
        towRequestId,
        assignedOperator,
        coordinates,
        licensePlates
      );

      // Send to all managers
      await Promise.all(
        managers.map(async (manager) => {
          const { manager: managerEmail } = towingRequestFollowUpEmailToManagerAndOperator(
            manager.fullName!,
            towRequestId,
            assignedOperator,
            coordinates,
            licensePlates
          );

          const managerMsg = {
            to: manager.email!,
            from: config.from,
            subject: managerEmail.subject,
            html: await emailTemplate({
              title: managerEmail.subject,
              content: managerEmail.body,
              link: viewTow,
              linkTitle: 'Review Tow Request',
            }),
          };

          await sendEmail(managerMsg, manager, manager.fullName!);
        })
      );

      // Finally send to operator
      const operatorMsg = {
        to: assignedOperator.email!,
        from: config.from,
        subject: operatorEmail.subject,
        html: await emailTemplate({
          title: operatorEmail.subject,
          content: operatorEmail.body,
          link: viewTow,
          linkTitle: 'Update Tow Request',
        }),
      };
      await sendEmail(operatorMsg, assignedOperator, assignedOperator.fullName!);
    }
  } catch (e) {
    console.log(e, 'follow-up email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending follow-up email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingCompletionAndExtensionEmailToRenter = async (
  name: string,
  licensePlate: string,
  parkingStartTime: string,
  parkingEndTime: string,
  nextBooking: IBookParkingDoc,
  parkingId: string,
  sendTo: string,
  user: any
) => {
  try {
    const mlEmail = sendBookingCompletedAndExtensionStartedToRenter(
      name,
      licensePlate,
      parkingStartTime,
      parkingEndTime,
      nextBooking
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewParking = `${config.clientUrl}/my-bookings?parkingId=${parkingId}&type=preview`;
    const linkProps = { link: viewParking, linkTitle: 'View Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendBookingCompletionAndExtensionEmailToParkingProvider = async (
  name: string,
  licensePlate: string,
  previousParkingStartTime: string,
  previousParkingEndTime: string,
  nextBooking: IBookParkingDoc,
  parkingId: string,
  sendTo: string,
  user: any,
  renter: any
) => {
  try {
    const mlEmail = sendBookingCompletedAndExtensionStartedToPSP(
      name,
      renter,
      licensePlate,
      previousParkingStartTime,
      previousParkingEndTime,
      nextBooking
    );
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewParking = `${config.clientUrl}/my-bookings?parkingId=${parkingId}&type=preview`;
    const linkProps = { link: viewParking, linkTitle: 'View Parking' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const towingRequestUpdatesEmailToLinkedUsers = async (
  name: string,
  towRequestId: string,
  loggedInUser: IUserDoc,
  coordinates: ILocation,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  user: IUserDoc,
  sendTo: string
) => {
  try {
    const mlEmail = towingRequestUpdatesEmail(name!, towRequestId, loggedInUser, coordinates, licensePlates);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}`;
    const linkProps = { link: viewTow, linkTitle: 'View Tow Request' };

    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

export const sendTowRequestInvite = async (token: string, email: string, inviter: IUserDoc, companyName: string) => {
  try {
    const viewTow = `${config.clientUrl}/tow-invite/${token}`;
    const emailContent = towingRequestInviteEmailToUser(inviter, companyName);

    const msg = {
      to: email,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
        link: viewTow,
        linkTitle: 'Accept tow request',
      }),
    };

    await sendEmail(msg, inviter, inviter.fullName!);
  } catch (e) {
    console.log(e, 'follow-up email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending follow-up email');
  }
};

// Send manager notification
export const sendInviteStatusEmailToManager = async (
  inviter: IUserDoc,
  inviteeContact: string,
  status: 'expired' | 'accepted',
  companyName?: string,
  contactMethod: 'email' | 'phone' = 'email'
) => {
  try {
    let emailContent;

    if (status === 'expired') {
      emailContent = towingRequestInviteExpiredEmailToManager(inviter, inviteeContact, companyName, contactMethod);
    } else if (status === 'accepted') {
      emailContent = towingRequestInviteAcceptedEmailToManager(inviter, inviteeContact, companyName, contactMethod);
    }

    const msg = {
      to: inviter.email!,
      from: config.from,
      subject: emailContent?.subject!,
      html: await emailTemplate({
        title: emailContent?.subject!,
        content: emailContent?.body!,
      }),
    };

    await sendEmail(msg, inviter, inviter.fullName || 'Manager');
  } catch (e) {
    console.error(e, 'invite status email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to send invitation status email to manager');
  }
};

export const sendTowRequestInviteReminder = async (
  email: string,
  inviter: IUserDoc,
  companyName?: string,
  token?: string
) => {
  try {
    const emailContent = towingRequestInviteReminderEmailToUser(inviter, companyName, token);
    const viewTow = `${config.clientUrl}/tow-invite/${token}`;

    const msg = {
      to: email,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
        link: viewTow,
        linkTitle: 'Accept tow request',
      }),
    };

    await sendEmail(msg, inviter, inviter.fullName || 'Manager');
  } catch (e) {
    console.error(e, 'invite reminder email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to send invitation reminder email');
  }
};

export const towingRequestInviteAcceptedEmailToPSP = async (user: IUserDoc, setupToken: string) => {
  try {
    // Check if user has dummy email or phone
    const hasDummyEmail = user.email?.startsWith('dummyemail') ?? false;
    const hasDummyPhone = user.phoneNumber?.startsWith('+1000000') ?? false;
    
    // Generate the setup link
    const setupLink = `${config.clientUrl}/account-setup/${setupToken}`;
    
    const emailContent = towingRequestInviteAcceptedEmailToUser( hasDummyEmail, hasDummyPhone);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
        link: setupLink,
        linkTitle: 'Complete your account setup',
      }),
    };

    await sendEmail(msg, user, user.fullName || 'User');
  } catch (e) {
    console.error(e, 'invite accepted email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to send invitation accepted email');
  }
};

export const sendAccountSetupSuccessEmail = async (user: IUserDoc) => {
  try {
    const emailContent = sendPasswordAndNameSetupSuccessEmail(user);

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
      }),
    };

    await sendEmail(msg, user, user.fullName || 'Manager');
  } catch (e) {
    console.error(e, 'invite reminder email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to send invitation reminder email');
  }
};

/**
 * Send email to invitee when their tow request invite is cancelled/revoked
 * @param {string} inviteeEmail - The invitee's email address
 * @param {string} inviteeName - The invitee's name (if known)
 * @param {string} inviterName - The inviter's name
 * @param {string} companyName - The tow company name
 * @returns {Promise}
 */
export const sendTowInviteCancelledEmailToInvitee = async (
  inviteeEmail: string,
  inviteeName?: string,
  inviterName?: string,
  companyName?: string
) => {
  try {
    const emailContent = towingRequestInviteCancelledEmailToInvitee(inviteeName, inviterName, companyName);

    const msg = {
      to: inviteeEmail,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
      }),
    };

    await sendEmail(msg, undefined, inviteeName || 'User');
  } catch (e) {
    console.error(e, 'invite cancellation email to invitee error');
    // Don't throw - this is a non-critical notification
  }
};

/**
 * Send email to manager/inviter when they cancel a tow request invite
 * @param {IUserDoc} inviter - The inviter user document
 * @param {string} inviteeContact - The invitee's contact (email or phone)
 * @param {string} companyName - The tow company name
 * @param {'email' | 'phone'} contactMethod - How the invite was sent
 * @returns {Promise}
 */
export const sendTowInviteCancelledEmailToManager = async (
  inviter: IUserDoc,
  inviteeContact: string,
  companyName?: string,
  contactMethod: 'email' | 'phone' = 'email'
) => {
  try {
    const emailContent = towingRequestInviteCancelledEmailToManager(inviter, inviteeContact, companyName, contactMethod);

    const msg = {
      to: inviter.email!,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
      }),
    };

    await sendEmail(msg, inviter, inviter.fullName || 'Manager');
  } catch (e) {
    console.error(e, 'invite cancellation email to manager error');
    // Don't throw - this is a non-critical notification
  }
};

/**
 * Send email to manager when an invitee rejects/declines their tow invite
 * @param {string} inviterEmail - The inviter's email address
 * @param {string} inviterName - The inviter's name
 * @param {string} inviteeName - The invitee's name (if known)
 * @param {string} inviteeContact - The invitee's contact info
 * @param {string} companyName - The tow company name
 * @returns {Promise}
 */
export const sendTowInviteRejectedEmailToManager = async (
  inviterEmail: string,
  inviterName?: string,
  inviteeName?: string,
  inviteeContact?: string,
  companyName?: string
) => {
  try {
    const emailContent = towingRequestInviteRejectedEmailToManager(
      inviterName, 
      inviteeName, 
      inviteeContact || 'the recipient',
      companyName
    );

    const msg = {
      to: inviterEmail,
      from: config.from,
      subject: emailContent.subject,
      html: await emailTemplate({
        title: emailContent.subject,
        content: emailContent.body,
      }),
    };

    await sendEmail(msg, undefined, inviterName || 'Manager');
  } catch (e) {
    console.error(e, 'invite rejection email to manager error');
    // Don't throw - this is a non-critical notification
  }
};

/**
 * Send account temporary blocked due to in correct password/otp email
 * @param {string} to
 * @param {string} code
 * @returns {Promise}
 */
export const sendTowingApprovalNotification = async (
  user: IUserDoc,
  sendTo: string,
  coordinates: ILocation,
  requesterInfo: IUserDoc,
  licensePlates: { plateText: string; croppedImage: string; completeImage: string }[],
  towRequestId: string
) => {
  try {
    const mlEmail = towingRequestApprovalEmail(requesterInfo, user, towRequestId, coordinates, licensePlates);
    const subject = mlEmail.subject;
    const text = mlEmail.body;
    const viewTow = `${config.clientUrl}/tow-requests/${towRequestId}?status=CANCEL`;
    const linkProps = { link: viewTow, linkTitle: 'Cancel Tow Request' };
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: text,
        ...linkProps,
      }),
    };
    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.log(e, 'email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending  email');
  }
};

export const notifyActorOnCrossCompanyTransfer = async (actor: IUserDoc, targetUser: IUserDoc, towManagers: IUserDoc[]) => {
  const { subject, body } = await sendCrossCompanyActorNotification(actor, targetUser, towManagers);

  const msg = {
    to: actor.email!,
    from: config.from,
    subject,
    html: await emailTemplate({
      title: subject,
      content: body,
    }),
  };

  await sendEmail(msg, actor, actor.fullName!);
};

// 2. Notify managers/owners of the target company
export const notifyManagersOnCrossCompanyTransfer = async (
  towManagers: IUserDoc[],
  targetUser: IUserDoc,
  actor: IUserDoc,
  token: string
) => {
  for (const manager of towManagers) {
    const { subject, body } = await sendCrossCompanyManagerNotification(manager, targetUser, actor);
    const viewTow = `${config.clientUrl}/tow-invite/${token}/discard`;
    const linkProps = { link: viewTow, linkTitle: 'Discard the request' };
    const msg = {
      to: manager.email!,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: body,
        ...linkProps,
      }),
    };

    await sendEmail(msg, manager, manager.fullName!);
  }
};

// 3. Notify the target user (the one being transferred)
export const notifyUserOnCrossCompanyTransfer = async (targetUser: IUserDoc, actor: IUserDoc, token: string) => {
  const { subject, body } = await sendCrossCompanyUserNotification(targetUser, actor);
  const viewTow = `${config.clientUrl}/tow-invite/${token}`;
  const linkProps = { link: viewTow, linkTitle: 'Accept the request' };

  const msg = {
    to: targetUser.email!,
    from: config.from,
    subject,
    html: await emailTemplate({
      title: subject,
      content: body,
      ...linkProps,
    }),
  };
  await sendEmail(msg, targetUser, targetUser.fullName!);
};

export const sendCrossCompanyAutoApproveActor = async (
  actor: IUserDoc,
  targetUser: IUserDoc,
  fromCompany: string,
  toCompany: string
) => {
  const emailContent = crossCompanyAutoApproveActorEmail(actor, targetUser, fromCompany, toCompany);
  await sendEmail({
    to: actor.email!,
    from: config.from,
    subject: emailContent.subject,
    html: await emailTemplate({
      title: emailContent.subject,
      content: emailContent.body,
    }),
  });
};

export const sendCrossCompanyAutoApproveManagers = async (towManagers: IUserDoc[], targetUser: IUserDoc) => {
  await Promise.all(
    towManagers.map(async (m) => {
      const emailContent = crossCompanyAutoApproveManagerEmail(m, targetUser);
      return sendEmail({
        to: m.email!,
        from: config.from,
        subject: emailContent.subject,
        html: await emailTemplate({
          title: emailContent.subject,
          content: emailContent.body,
        }),
      });
    })
  );
};

export const sendCrossCompanyAutoApproveUser = async (targetUser: IUserDoc, toCompany: string, token: string) => {
  const emailContent = crossCompanyAutoApproveUserEmail(targetUser, toCompany);
  const viewTow = `${config.clientUrl}/tow-invite/${token}`;
  const linkProps = { link: viewTow, linkTitle: 'Accept the request' };

  await sendEmail({
    to: targetUser.email!,
    from: config.from,
    subject: emailContent.subject,
    html: await emailTemplate({
      title: emailContent.subject,
      content: emailContent.body,
      ...linkProps,
    }),
  });
};

export const sendCrossCompanyDiscardActorEmail = async (actor: IUserDoc, targetUser: IUserDoc, manager: IUserDoc) => {
  const emailContent = crossCompanyDiscardActorEmail(actor, targetUser, manager);

  await sendEmail({
    to: targetUser.email!,
    from: config.from,
    subject: emailContent.subject,
    html: await emailTemplate({
      title: emailContent.subject,
      content: emailContent.body,
    }),
  });
};

export const successfulTransferEmails = {
  notifyOldCompanyOnCrossCompanyTransfer: async (
    oldCompanyManagers: IUserDoc[],
    targetUser: IUserDoc,
    newCompany: IUserDoc
  ) => {
    for (const manager of oldCompanyManagers) {
      const { subject, body } = successfulTransferEmailContent.oldCompanyOnCrossCompanyTransfer(
        manager,
        targetUser,
        newCompany
      );
      const msg = {
        to: manager.email!,
        from: config.from,
        subject,
        html: await emailTemplate({ title: subject, content: body }),
      };
      await sendEmail(msg, manager, manager.fullName!);
    }
  },

  notifyNewCompanyOnCrossCompanyTransfer: async (
    newCompanyActor: IUserDoc,
    newCompanyManagers: IUserDoc[],
    targetUser: IUserDoc
  ) => {
    const { subject, body } = successfulTransferEmailContent.newCompanyOnCrossCompanyTransfer(
      newCompanyActor,
      newCompanyManagers,
      targetUser
    );
    const msg = {
      to: newCompanyActor.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: body }),
    };
    await sendEmail(msg, newCompanyActor, newCompanyActor.fullName!);
  },

  notifyTargetUserOnCrossCompanyTransfer: async (targetUser: IUserDoc, oldCompany: IUserDoc, newCompany: IUserDoc) => {
    const { subject, body } = successfulTransferEmailContent.targetUserOnCrossCompanyTransfer(
      targetUser,
      oldCompany,
      newCompany
    );
    const msg = {
      to: targetUser.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: body }),
    };
    await sendEmail(msg, targetUser, targetUser.fullName!);
  },
};

export const discardTransferEmails = {
  notifyOldCompanyOnCrossCompanyTransfer: async (
    oldCompanyManagers: IUserDoc[],
    targetUser: IUserDoc,
    newCompany: IUserDoc
  ) => {
    for (const manager of oldCompanyManagers) {
      const { subject, body } = discardTransferEmailContent.oldCompanyOnCrossCompanyTransfer(
        manager,
        targetUser,
        newCompany
      );
      const msg = {
        to: manager.email!,
        from: config.from,
        subject,
        html: await emailTemplate({ title: subject, content: body }),
      };
      await sendEmail(msg, manager, manager.fullName!);
    }
  },

  notifyNewCompanyOnCrossCompanyTransfer: async (
    newCompanyActor: IUserDoc,
    newCompanyManagers: IUserDoc[],
    targetUser: IUserDoc
  ) => {
    const { subject, body } = discardTransferEmailContent.newCompanyOnCrossCompanyTransfer(
      newCompanyActor,
      newCompanyManagers,
      targetUser
    );
    const msg = {
      to: newCompanyActor.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: body }),
    };
    await sendEmail(msg, newCompanyActor, newCompanyActor.fullName!);
  },

  notifyTargetUserOnCrossCompanyTransfer: async (targetUser: IUserDoc, oldCompany: IUserDoc, newCompany: IUserDoc) => {
    const { subject, body } = discardTransferEmailContent.targetUserOnCrossCompanyTransfer(
      targetUser,
      oldCompany,
      newCompany
    );
    const msg = {
      to: targetUser.email!,
      from: config.from,
      subject,
      html: await emailTemplate({ title: subject, content: body }),
    };
    await sendEmail(msg, targetUser, targetUser.fullName!);
  },
};

// ========== SMS FUNCTIONS ==========

/**
 * Send reset password SMS
 * @param {string} phoneNumber
 * @param {string} token
 * @param {string} name
 * @param {IUserDoc} user
 * @returns {Promise}
 */
export const sendResetPasswordSMS = async (phoneNumber: string, token: string, name: string, user: IUserDoc) => {
  try {
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}`;
    return await smsUtil.sendPasswordResetSMS(phoneNumber, resetPasswordUrl, name, user);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending SMS: ' + e);
  }
};

/**
 * Send verification SMS
 * @param {string} phoneNumber
 * @param {string} token
 * @param {string} name
 * @param {IUserDoc} user
 * @returns {Promise}
 */
export const sendVerificationSMS = async (phoneNumber: string, token: string, name: string, user: IUserDoc) => {
  try {
    const verificationUrl = `${config.clientUrl}/auth/verify-email?token=${token}`;
    return await smsUtil.sendAccountVerificationSMS(phoneNumber, verificationUrl, name, user);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending SMS: ' + e);
  }
};

/**
 * Send new account SMS
 * @param {string} phoneNumber
 * @param {string} token
 * @param {string} name
 * @param {IUserDoc} user
 * @param {string} password
 * @returns {Promise}
 */
export const sendNewAccountSMS = async (
  phoneNumber: string,
  token: string,
  name: string,
  user: IUserDoc,
  _password?: string
) => {
  try {
    const resetPasswordUrl = `${config.clientUrl}/auth/reset-password?token=${token}&isFirstLogin=true`;
    return await smsUtil.sendAccountVerificationSMS(phoneNumber, resetPasswordUrl, name, user);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending SMS: ' + e);
  }
};

/**
 * Send tow request invite SMS
 * @param {string} phoneNumber
 * @param {string} inviteLink
 * @param {string} name
 * @param {IUserDoc} user
 * @returns {Promise}
 */
export const sendTowRequestInviteSMS = async (phoneNumber: string, inviteLink: string, name: string, user: IUserDoc) => {
  try {
    return await smsUtil.sendTowRequestInviteSMS(phoneNumber, inviteLink, name, user);
  } catch (e) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending SMS: ' + e);
  }
};

/**
 * Send simple tow request status update email
 * @param {string} name - Recipient name
 * @param {IUserDoc} user - User object
 * @param {string} sendTo - Recipient email
 * @param {string} status - New status
 * @param {string} towRequestId - Tow request ID
 */
export const sendTowingRequestStatusUpdateEmail = async (
  name: string,
  user: IUserDoc,
  sendTo: string,
  _: string,
  towRequestId: string,
  isPreviousUser: boolean
) => {
  try {
    let subject: string;
    let body: string;

    subject = `Tow Request ${towRequestId} Rejected`;
    body = `Dear ${name},\n\nTow request ${towRequestId} has been auto rejected by the system.\n\nPlease contact dispatch for assistance or create a new request.\n\nBest regards,\n${serviceTeamName}`;

    const viewTow = `${config.clientUrl}/tow-requests${isPreviousUser ? '?towRequestId=' : '/'}${towRequestId}`;
    const msg = {
      to: sendTo,
      from: config.from,
      subject,
      html: await emailTemplate({
        title: subject,
        content: body,
        link: viewTow,
        linkTitle: 'View Tow Request',
      }),
    };

    await sendEmail(msg, user, user.fullName!);
  } catch (e) {
    console.error(e, 'status update email error');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong when sending status update email');
  }
};

/**
 * Send subscription expiry reminder email
 * @param {IUserDoc} user - User object
 * @param {string} tierName - Subscription tier name
 * @param {number} price - Subscription price
 * @param {string} expiryDate - Expiry date
 * @param {number} daysUntilExpiry - Days until expiry
 */
export const sendSubscriptionExpiryReminderEmail = async (
  user: IUserDoc,
  tierName: string,
  price: number,
  expiryDate: string,
  daysUntilExpiry: number
): Promise<void> => {
  try {
    const emailContent = subscriptionExpiryReminderEmail(
      user.fullName!,
      tierName,
      price,
      expiryDate,
      daysUntilExpiry
    );

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName!);

    // Send admin notification (non-blocking)
    const adminSubject = `Subscription Expiry Reminder - ${user.fullName}`;
    const adminContent = `User ${user.fullName} (${user.email}) has a subscription expiring in ${daysUntilExpiry} days. Tier: ${tierName}, Price: $${price}, Expiry: ${expiryDate}`;
    
    sendAdminNotificationForSubscriptionEvent(adminSubject, adminContent, {
      userId: user._id,
      tierName,
      price,
      expiryDate,
      daysUntilExpiry
    }).catch(error => console.error('Error sending admin notification for expiry reminder:', error));
  } catch (error) {
    console.error('Error sending subscription expiry reminder email:', error);
  }
};

/**
 * Send subscription expired email
 * @param {IUserDoc} user - User object
 * @param {string} tierName - Subscription tier name
 * @param {number} price - Subscription price
 * @param {string} expiryDate - Expiry date
 */
export const sendSubscriptionExpiredEmail = async (
  user: IUserDoc,
  tierName: string,
  price: number,
  expiryDate: string
): Promise<void> => {
  try {
    const emailContent = subscriptionExpiredEmail(
      user.fullName!,
      tierName,
      price,
      expiryDate
    );

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName!);

    // Send admin notification (non-blocking)
    const adminSubject = `Subscription Expired - ${user.fullName}`;
    const adminContent = `User ${user.fullName} (${user.email}) subscription has expired. Tier: ${tierName}, Price: $${price}, Expired: ${expiryDate}`;
    
    sendAdminNotificationForSubscriptionEvent(adminSubject, adminContent, {
      userId: user._id,
      tierName,
      price,
      expiryDate
    }).catch(error => console.error('Error sending admin notification for subscription expiry:', error));
  } catch (error) {
    console.error('Error sending subscription expired email:', error);
  }
};

/**
 * Send subscription payment retry email
 * @param {IUserDoc} user - User object
 * @param {string} tierName - Subscription tier name
 * @param {number} price - Subscription price
 * @param {string} retryDate - Retry date
 */
export const sendSubscriptionPaymentRetryEmail = async (
  user: IUserDoc,
  tierName: string,
  price: number,
  retryDate: string
): Promise<void> => {
  try {
    const emailContent = subscriptionPaymentRetryEmail(
      user.fullName!,
      tierName,
      price,
      retryDate
    );

    const msg = {
      to: user.email!,
      from: config.from,
      subject: emailContent.title,
      html: await emailTemplate({ title: emailContent.title, content: emailContent.content }),
    };

    await sendEmail(msg, user, user.fullName!);

    // Send admin notification (non-blocking)
    const adminSubject = `Payment Retry Required - ${user.fullName}`;
    const adminContent = `User ${user.fullName} (${user.email}) has a failed payment that will be retried. Tier: ${tierName}, Price: $${price}, Retry Date: ${retryDate}`;
    
    sendAdminNotificationForSubscriptionEvent(adminSubject, adminContent, {
      userId: user._id,
      tierName,
      price,
      retryDate
    }).catch(error => console.error('Error sending admin notification for payment retry:', error));
  } catch (error) {
    console.error('Error sending subscription payment retry email:', error);
  }
};


export const sendWebhookCallAlertToMe = async (event: any) => {
  const msg = {
    to: 'faisalseraj47@gmail.com',
    from: config.from,
    subject: 'Webhook Call Alert',
    html: `<p>Webhook call alert</p><p>Event: ${event.type}</p><p>Data: ${JSON.stringify(event)}</p>`,
  };
  await sgMail.send({ ...msg, from: { email: config.senderEmail, name: config.senderName } });
};

/**
 * Send invoice paid email with PDF attachment
 */
export const sendInvoicePaidEmail = async (emailData: {
  to: string;
  firstName: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  tierName: string;
  billingInterval: string;
  invoiceId: string;
  invoiceUrl: string | null;
}) => {
  try {
    const { to, firstName, subscriptionId, amount, currency, paymentDate, tierName, billingInterval, invoiceId, invoiceUrl } = emailData;

    const subject = `Payment Confirmation - ${tierName} Subscription`;
    const content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Confirmation</h2>
        <p>Hello ${firstName},</p>
        <p>Thank you for your payment! Your subscription has been successfully processed.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Payment Details</h3>
          <p><strong>Subscription:</strong> ${tierName}</p>
          <p><strong>Billing Interval:</strong> ${billingInterval}</p>
          <p><strong>Amount:</strong> ${currency} ${amount.toFixed(2)}</p>
          <p><strong>Payment Date:</strong> ${paymentDate.toLocaleDateString()}</p>
          <p><strong>Invoice ID:</strong> ${invoiceId}</p>
        </div>
        
        <p>Your subscription is now active and you can continue using our services.</p>
        
        ${invoiceUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoiceUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Download Invoice PDF
          </a>
        </div>
        ` : ''}
        
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>Hits Towing Manager Team</p>
      </div>
    `;

    const msg = {
      to,
      from: config.from,
      subject,
      html: content,
    };

    await sgMail.send({ ...msg, from: { email: config.senderEmail, name: config.senderName } });

    // Send admin notification
    const adminSubject = `Payment Confirmed - ${firstName} (${tierName})`;
    const adminContent = `
      <p><strong>User:</strong> ${firstName} (${to})</p>
      <p><strong>Subscription:</strong> ${tierName} (${billingInterval})</p>
      <p><strong>Amount:</strong> ${currency} ${amount.toFixed(2)}</p>
      <p><strong>Payment Date:</strong> ${paymentDate.toLocaleDateString()}</p>
      <p><strong>Invoice ID:</strong> ${invoiceId}</p>
    `;

    await sendAdminNotificationForSubscriptionEvent(adminSubject, adminContent, {
      userId: subscriptionId,
      tierName,
      amount,
      paymentDate: paymentDate.toISOString()
    }).catch(error => console.error('Error sending admin notification for invoice paid:', error));

    console.log(`Invoice paid email sent to ${to}`);
  } catch (error) {
    console.error('Error sending invoice paid email:', error);
  }
};

/**
 * Send upcoming invoice reminder email
 */
export const sendSubscriptionUpcomingInvoiceEmail = async (emailData: {
  to: string;
  firstName: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  nextPaymentDate: Date;
  tierName: string;
  billingInterval: string;
}) => {
  try {
    const { to, firstName, amount, currency, nextPaymentDate, tierName, billingInterval } = emailData;

    const subject = `Upcoming Payment - ${tierName} Subscription`;
    const content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Upcoming Payment Reminder</h2>
        <p>Hello ${firstName},</p>
        <p>This is a friendly reminder that your subscription payment is coming up soon.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">Payment Details</h3>
          <p><strong>Subscription:</strong> ${tierName}</p>
          <p><strong>Billing Interval:</strong> ${billingInterval}</p>
          <p><strong>Amount:</strong> ${currency} ${amount.toFixed(2)}</p>
          <p><strong>Next Payment Date:</strong> ${nextPaymentDate.toLocaleDateString()}</p>
        </div>
        
        <p>Your payment method on file will be charged automatically. If you need to update your payment method, please visit your subscription management page.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.stripe.frontendUrl}/subscription-management" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Manage Subscription
          </a>
        </div>
        
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>Hits Towing Manager Team</p>
      </div>
    `;

    const msg = {
      to,
      from: config.from,
      subject,
      html: content,
    };

    await sgMail.send({ ...msg, from: { email: config.senderEmail, name: config.senderName } });

    console.log(`Upcoming invoice email sent to ${to}`);
  } catch (error) {
    console.error('Error sending upcoming invoice email:', error);
  }
};