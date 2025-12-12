import { IUserDoc } from '../user/user.interfaces';

const getUserLanguage = async (user: IUserDoc) => {
  user;
  return {
    shortForm: 'en',
    fullForm: 'English',
  };
};

function capitalizeString(value: string) {
  if (!value) return value; // Handle empty values
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export { getUserLanguage, capitalizeString };
