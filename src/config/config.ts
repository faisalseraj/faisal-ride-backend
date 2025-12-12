import 'dotenv/config';

import { Constants } from '../modules/utils/Constants';
import Joi from 'joi';

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().required(),
    BREVO_KEY: Joi.string(),
    SENDER_NAME: Joi.string().required(),
    SENDER_EMAIL: Joi.string().required(),
    PORT: Joi.number().default(3000),
    SOCKET_PORT: Joi.number().default(4000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),
    EMAIL_API_KEY: Joi.string().description('Provide the send grip key'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    GCP_BUCKET_NAME: Joi.string().description('The GCP bucket is required'),
    IPINFO_API_KEY: Joi.string().description('The Ipinfo API key is required'),
    SERVER_TYPE: Joi.string()
      .required()
      .description('Server type is required. Valid server types are production, staging and testing')
      .valid(
        ...[
          Constants.productionServer,
          Constants.stagingServer,
          Constants.testServer,
          Constants.localServer,
          Constants.demoServer,
        ]
      ),
    BACKEND_URL: Joi.string().required().description('Backend URL is required'),
    GCP_SECRET: Joi.string().description('Gcp Secret is required'),
    SERP_API_KEY: Joi.string(),
    WEB_CLIENT: Joi.string(),
    OPENAI_API_KEY: Joi.string().required().description('Open  AI API key is required'),
    XAI_API_KEY: Joi.string().required().description('Open  AI API key is required'),
    FREE_GPT_MODAL: Joi.string().description('Free GPT Modal Key is required. gpt-4o-mini'),
    PAID_GPT_MODAL: Joi.string().description('Paid GPT Modal Key is required. chatgpt-4o-latest'),
    GCP_BUCKET: Joi.string().description('Paid GPT Modal Key is required. chatgpt-4o-latest'),
    COMPUTER_VISION_KEY: Joi.string().description('Computer Vision Key is required. '),
    COMPUTER_VISION_ENDPOINT: Joi.string().description('Computer Vision Endpoint is required. '),
    PASSWORD_DECRYPT_KEY: Joi.string().description('Password decrypt key is required'),
    SENDGRID_KEY: Joi.string().description('Sendgrid key is required'),
    GOOGLE_VISION_OCR_KEY: Joi.string().description('Google vision key is required'),
    CUSTOM_OCR_URL: Joi.string().description('Custom URL is required'),
    AWS_ACCESS_KEY_ID: Joi.string().required().description('AWS access key ID is required'),
    AWS_SECRET_ACCESS_KEY: Joi.string().required().description('AWS secret access key is required'),
    AWS_REGION: Joi.string().required().description('AWS region is required'),
    S3_BUCKET_TOW_REQUESTS: Joi.string().required().description('S3 bucket for tow requests is required'),
    VAPID_PRIVATE_KEY: Joi.string().required().description('VAPID_PRIVATE_KEY is required'),
    VAPID_PUBLIC_KEY: Joi.string().required().description('VAPID_PUBLIC_KEY is required'),
    TWILIO_ACCOUNT_SID: Joi.string().required().description('Twilio Account SID is required'),
    TWILIO_AUTH_TOKEN: Joi.string().required().description('Twilio Auth Token is required'),
    TWILIO_FROM_NUMBER: Joi.string().required().description('Twilio From Number is required'),
    STRIPE_SECRET_KEY: Joi.string().required().description('Stripe secret key is required'),
    STRIPE_WEBHOOK_SECRET: Joi.string().required().description('Stripe webhook secret is required'),
    // STRIPE_PRICE_ID_BASIC: Joi.string().required().description('Stripe price ID for basic tier is required'),
    // STRIPE_PRICE_ID_PREMIUM: Joi.string().required().description('Stripe price ID for premium tier is required'),
    STRIPE_FRONTEND_URL: Joi.string().required().description('Frontend URL is required'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  socketPort: envVars.SOCKET_PORT,
  gcpBucketName: envVars.GCP_BUCKET_NAME,
  tinifyApiKey: envVars.GCP_BUCKET_NAME,

  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    cookieOptions: {
      httpOnly: true,
      secure: envVars.NODE_ENV === 'production',
      signed: true,
    },
  },
  // email: {
  //   smtp: {
  //     host: envVars.SMTP_HOST,
  //     port: envVars.SMTP_PORT,
  //     auth: {
  //       user: envVars.SMTP_USERNAME,
  //       pass: envVars.SMTP_PASSWORD,
  //     },
  //   },
  from: envVars.EMAIL_FROM,
  // },
  emailAPIKey: envVars.EMAIL_API_KEY,
  ipInfoApiKey: envVars.IPINFO_API_KEY,
  smsHostUrl: envVars.SMS_HOST,
  decryptionKey: envVars.PASSWORD_DECRYPT_KEY,
  clientUrl: envVars.WEB_CLIENT,
  backendUrl: envVars.BACKEND_URL,
  serverType: envVars.SERVER_TYPE,
  gcpSecret: envVars.GCP_SECRET,
  openAIApiKeyV4: envVars.OPENAI_API_KEY,
  xAiApiKeyV4: envVars.XAI_API_KEY,
  geminiApiKey: envVars.GEMINI_API_KEY,
  claudeApiKey: envVars.ANTHROPIC_API_KEY,
  computerVisionKey: envVars.COMPUTER_VISION_KEY,
  computerVisionEndPoint: envVars.COMPUTER_VISION_ENDPOINT,
  baseCurrency: envVars.BASE_CURRENCY,
  qrCodeUrl: envVars.QR_CODE_URL,
  // webBackgroundBucket: envVars.WEB_BACKGROUND_BUCKET,
  visitNowLink: envVars.EMAIL_VISIT_NOW_LINK,
  freeGPTModal: envVars?.FREE_GPT_MODAL,
  paidGPTModal: envVars?.PAID_GPT_MODAL,
  googleVisionOcrKey: envVars?.GOOGLE_VISION_OCR_KEY,
  customOCRURL: envVars?.CUSTOM_OCR_URL,

  apiKey: envVars.BREVO_KEY as string,
  senderName: envVars.SENDER_NAME as string,
  senderEmail: envVars.SENDER_EMAIL as string,
  sendGridKey: envVars.SENDGRID_KEY as string,

  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY as string,
    region: envVars.AWS_REGION as string,
    s3BucketTowRequests: envVars.S3_BUCKET_TOW_REQUESTS as string,
  },

  vapidPrivateKey: envVars.VAPID_PRIVATE_KEY as string,
  vapidPublicKey: envVars.VAPID_PUBLIC_KEY as string,

  twilio: {
    accountSid: envVars.TWILIO_ACCOUNT_SID as string,
    authToken: envVars.TWILIO_AUTH_TOKEN as string,
    fromNumber: envVars.TWILIO_FROM_NUMBER as string,
  },

  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY as string,
    webhookSecret: envVars.STRIPE_WEBHOOK_SECRET as string,
    // priceIds: {
    //   basic: envVars.STRIPE_PRICE_ID_BASIC as string,
    //   premium: envVars.STRIPE_PRICE_ID_PREMIUM as string,
    // },
    frontendUrl: envVars.STRIPE_FRONTEND_URL as string,
  },

};

export default config;
