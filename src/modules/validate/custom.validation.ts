import { CustomHelpers } from 'joi';
import libPhoneNumber from 'google-libphonenumber';

export const phoneNumberValidationAll = (value: string, helpers: CustomHelpers) => {
  if (!value.includes('+00')) {
    const phoneUtil = libPhoneNumber.PhoneNumberUtil.getInstance();
    const parsedPhoneNumber = phoneUtil.parse(value);

    const isValid = phoneUtil.isValidNumber(parsedPhoneNumber);

    if (!isValid) {
      return helpers.message({ custom: 'Phone number is not valid, enter a valid phone number' });
    }
  }
  return value;
};

export function phoneNumberValidation(phone: string, helpers: CustomHelpers) {
  const cleaned = phone.replace(/\s+/g, ''); // remove all spaces
  
  // US phone number validation (10 digits, no country code)
  const usRegex = /^(\(?[2-9][0-9]{2}\)?)[-. ]?[0-9]{3}[-. ]?[0-9]{4}$/;
  
  // Pakistan phone number validation (10-11 digits, no country code)
  // Pakistan mobile numbers: 03XX-XXXXXXX (11 digits) or 3XX-XXXXXXX (10 digits)
  const pakistanRegex = /^(0?3[0-9]{2})[-. ]?[0-9]{7}$/;
  
  // International format validation (with country codes)
  const internationalRegex = /^(\+1|92)[-. ]?[0-9]{10,11}$/;
  
  // Check if it starts with +1 (US) or +92 (Pakistan) - reject these as we want local format
  if (cleaned.startsWith('+1') || cleaned.startsWith('+92')) {
    return helpers.message({ custom: 'Please enter phone number without country code (+1 or +92). Use local format only.' });
  }
  
  // Validate against US, Pakistan, or international format
  if (usRegex.test(phone) || pakistanRegex.test(phone) || internationalRegex.test(phone)) {
    return phone;
  }
  
  return helpers.message({ custom: 'Phone number is not valid. Please enter a valid US or Pakistan phone number without country code.' });
}

export const objectId = (value: string, helpers: CustomHelpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message({ custom: '"{{#label}}" must be a valid mongo id' });
  }
  return value;
};

export const getCountryCodeFromPhonenumber = (phoneNumber: string) => {
  const phoneUtil = libPhoneNumber.PhoneNumberUtil.getInstance();
  const parsedPhoneNumber = phoneUtil.parse(phoneNumber);
  const countryCode = parsedPhoneNumber.getCountryCode();
  return `+${countryCode}`;
};

export const password = (value: string, helpers: CustomHelpers) => {
  if (value.length < 8) {
    return helpers.message({ custom: 'password must be at least 8 characters' });
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    return helpers.message({ custom: 'password must contain at least 1 letter and 1 number' });
  }
  return value;
};

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const days = (value: string, helpers: CustomHelpers) => {
  if (!daysOfWeek.includes(value)) {
    return helpers.message({
      custom: 'day must be one of full day of a week e.g Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday',
    });
  }
  return value;
};
