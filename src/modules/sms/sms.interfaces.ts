export interface SMSMessage {
  to: string;
  from?: string;
  body: string;
}

export interface SendOneTimeLinkSMS {
  phoneNumber: string;
  link: string;
  linkTitle: string;
  receiverName?: string;
  expirationTime?: string;
  purpose?: string; // e.g., 'password-reset', 'account-verification', 'tow-invite'
}

export interface SendTemplatedSMS {
  phoneNumber: string;
  template: string;
  data: Record<string, any>;
  receiverName?: string;
}

export interface SMSDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  webhookUrl?: string;
}

export interface OneTimeLinkData {
  token: string;
  phoneNumber: string;
  purpose: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  metadata?: Record<string, any>;
}
