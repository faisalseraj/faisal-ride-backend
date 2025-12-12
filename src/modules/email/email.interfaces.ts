
export interface Message {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendContactSupportEmail {
  email: string;
  name: string;
  subject: string;
  description: string;
  phoneNumber?: string;
  preferredLanguage?: string;
}

export interface SendTemplatedEmail {
  email: string;
  subject: string;
  content: string;
  receiverName?: string;
  link?: string;
  linkTitle?: string;
  language?: string;
}

export interface SendTemplatedEmailV2 {
  language?: string;
  email: string;
  subject: string;
  content: string;
  receiverName?: string;
  link1?: string;
  link1Color?: string;
  linkTitle1?: string;

  link2Color?: string;
  link2?: string;
  linkTitle2?: string;
}

export interface SendTemplatedEmailWithAttachment extends SendTemplatedEmail {
  language?: string;
  direction?: string;
  file: string;
  fileName: string;
  attachment?: {
    filename: string;
    content: string;
    type: string;
  };
}

export interface SendTemplatedEmailWithAttachmentV2 extends SendTemplatedEmailV2 {
  file: string;
  fileName: string;
  attachment?: {
    filename: string;
    content: string;
    type: string;
  };
}
