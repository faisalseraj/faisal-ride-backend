export default function formatPhoneNumber(phoneNumber: string) {
  // Remove any non-numeric characters
  if (!phoneNumber) return phoneNumber;
  const numericPhoneNumber = phoneNumber.replace(/\D/g, '');

  // Iterate through the list of country codes
  for (const countryCode of countryCodes) {
    if (numericPhoneNumber.startsWith(countryCode)) {
      const countryCodeLength = countryCode.length;
      const phoneNumberWithoutCountryCode = numericPhoneNumber.slice(countryCodeLength);
      // Remove the leading zero if it follows the country code
      return `+${countryCode}${phoneNumberWithoutCountryCode.replace(/^0+/, '')}`;
    }
  }

  // If the numeric phone number doesn't match any country code, return it as is
  return phoneNumber;
}

// Example usage with a list of country codes
const countryCodes = ['91', '1', '33', '30', '32', '39', '357', '972', '970', '34', '44', '46', '92'];
