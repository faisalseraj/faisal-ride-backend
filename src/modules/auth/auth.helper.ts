import { ILog, LogStatus, StatusEnum } from '../logs/log.interfaces';
import { Log, logService } from '../logs';
import { User, userService } from '../user';
import { sendTemporaryBlockingAccountEmail, sendUnusualIpEmail } from '../email/email.service';

import { ALL_EVENTS } from '../utils/events';
import { ApiError } from '../errors';
import { Constants } from '../utils/Constants';
import { IUserDoc } from '../user/user.interfaces';
import { Message } from '../utils/errorMessage';
import { Request } from 'express';
import config from '../../config/config';
// Using built-in fetch (Node.js 18+)
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { tokenService } from '../token';

// const UNEXPECTED_COUNTRY_THRESHOLD = 0.9; // Percentage of logins from user's typical country to consider an IP unusual

// Helper function to check if the IP address is from an unexpected country
async function checkExpectedCountry(
  ipAddress: string,
  typicalIPPattern: string[]
): Promise<{ isExpectedCountry: boolean; country: string }> {
  try {
    if (ipAddress === '::1') return { isExpectedCountry: true, country: '' }; // Use a geolocation API or database to get the country information of the IP address
    if (!ipAddress) return { isExpectedCountry: true, country: '' };
    const country: string = await getCountryFromIP(ipAddress); // Replace with your geolocation API or database call

    // Compare the country with the user's typical country(s) from the typicalIPPattern
    // Here, I'm assuming that the typicalIPPattern contains an array of typical IP addresses with their countries
    const expectedCountries = await Promise.all(typicalIPPattern.map((ip) => getCountryFromIP(ip)));

    // Check if the country is present in the expectedCountries array
    const isExpectedCountry = expectedCountries.includes(country);

    return { isExpectedCountry, country };
  } catch (err) {
    console.error('Error checking expected country:', err);
    return { isExpectedCountry: false, country: '' }; // Return false in case of errors or if the country cannot be determined
  }
}

// Helper function to get country information from the IP address using a geolocation API or database
async function getCountryFromIP(ipAddress: string): Promise<string> {
  try {
    const apiUrl = `http://ipinfo.io/${ipAddress}?token=${config.ipInfoApiKey}`;

    // Make the API call to ipinfo.io
    const res = await fetch(`${apiUrl}`, {
      method: 'GET',
    });

    const response = (await res.json()) as any;

    // Extract the country information from the response data
    const country = response.country;

    return country;
  } catch (err) {
    console.error('Error getting country from IP:', err);
    throw err;
  }
}

// // Helper function to check excessive login attempts
export async function checkExcessiveLoginAttempts(
  user: IUserDoc,
  MAX_LOGIN_ATTEMPTS: number = 5,
  status: LogStatus,
  userIP: string,
  language?: string
): Promise<number> {
  language = language || 'english';
  try {
    const ownerId = await userService.getOwnerIdByUserId(user._id || user.id);
    logService.createLog({
      user,
      ownerId,
      event: ALL_EVENTS.UserEvents.userLoginFailure,
      eventEnum: 'UE',
    });
    const userId = user._id;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // Get the timestamp of one hour ago
    // Query the database to get the count of login attempts for the user in the last hour
    const loginAttempts = await Log.countDocuments({
      userId,
      date: { $gte: oneHourAgo },
      ipAddress: userIP,
      status,
    });

    // Return true if the count exceeds MAX_LOGIN_ATTEMPTS, otherwise return false
    if (loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
      await userService.temporaryBlockFor24AfterBruteForceLogin(new mongoose.Types.ObjectId(userId));

      throw new ApiError(
        httpStatus.FORBIDDEN,
        Message.partnerAuth.accountBlockedIncorrectLogin[language],
        true,
        '',
        Message.partnerAuth.accountBlockedIncorrectLogin['english']
      );
    }

    return loginAttempts;
  } catch (err: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err.message);
    console.error('Error checking excessive login attempts:', err);
  }
}

// Rest of the code remains the same

async function getUserLoginHistory(userId: string) {
  try {
    // Query the database to get the user's login history
    const loginHistory = await Log.find({ userId, ipAddress: { $exists: true }, status: StatusEnum.LOGIN_SUCCESS })
      .sort({ date: 1 })
      .limit(200);
    return loginHistory;
  } catch (err) {
    console.error('Error retrieving login history:', err);
    throw err;
  }
}

// Step 3: Calculate Typical IP Address Pattern
function calculateTypicalIPPattern(userId: string): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 2: Retrieve User Login History
      const loginHistory = await getUserLoginHistory(userId);

      // Step 3: Calculate Typical IP Address Pattern
      const ipCounts: any = {}; // Object to store IP address counts
      let totalLoginCount = 0;

      // Count the occurrences of each IP address in the login history
      loginHistory.forEach((log: ILog) => {
        const { ipAddress } = log;
        if (ipAddress) {
          ipCounts[ipAddress] = (ipCounts[ipAddress] || 0) + 1;
          totalLoginCount++;
        }
      });

      // Calculate the percentage of each IP address based on its occurrence
      const ipPercentage: any = {};
      Object.keys(ipCounts).forEach((ip) => {
        ipPercentage[ip] = ipCounts[ip] / totalLoginCount;
      });
      // Sort IP addresses by their occurrence percentage in descending order
      const sortedIPs = Object.keys(ipPercentage).sort((a, b) => ipPercentage[b] - ipPercentage[a]);
      // Return the top N IP addresses (you can adjust this number as needed)
      const typicalIPPattern = sortedIPs.slice(0, 5); // Return the top 5 most frequently used IP addresses

      resolve(typicalIPPattern);
    } catch (err) {
      reject(err);
    }
  });
}

export async function checkUnusualIP(req: Request, user: IUserDoc) {
  try {
    const { _id, email, fullName } = user;
    // Retrieve the user's typical IP address pattern
    const typicalIPPattern = await calculateTypicalIPPattern(_id);

    // Get the user's current IP address from the request
    const userIP = getIpFromHeader(req);
    // Check if the IP address is part of the user's typical pattern
    const isTypicalIP = typicalIPPattern?.includes(userIP);

    // Check if the IP address belongs to an unexpected country
    const { isExpectedCountry, country } = await checkExpectedCountry(userIP, typicalIPPattern);

    // Check the login frequency of the user
    // const isExcessiveLoginAttempts = await checkExcessiveLoginAttempts(userId);
    // If the IP is not typical or is from an unexpected country or has excessive login attempts, trigger an email alert
    if (!isTypicalIP || !isExpectedCountry) {
      if (email && !email.startsWith('dummy')) {
        const resetPasswordToken = await tokenService.generateResetPasswordToken(email);

        await logService.createLog({
          user: user!,
          event: ALL_EVENTS.ManagementEvents.SystemAnomalyDetected(
            user?.fullName!,
            !isTypicalIP ? 'due to non typical IP address' : 'Non typical country location.'
          ),
          eventEnum: 'MaE',
        });

        await sendUnusualIpEmail(email, fullName!, userIP, country, resetPasswordToken, user);
      }
    }
  } catch (e: any) {
    console.log(e, 'error is here');
    const ownerId = await userService.getOwnerIdByUserId(user._id || user.id);
    // Log the error
    await logService.createLog({
      user: user!,
      ownerId,
      event: ALL_EVENTS.UserEvents.errorInIrregualrLogin(user.phoneNumber, user?.fullName, JSON.stringify(e)),
      eventEnum: 'UE',
    });
    // throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong in checking unusual IP ');
  }
}

// Step 6: Identify Irregularities
function checkForIrregularities(loginHistory: ILog[], thresholdDays: number): boolean {
  const latestLogin = loginHistory[loginHistory.length - 1];

  const prevLoginTime = new Date(latestLogin?.date!);
  const currentLoginTime = new Date();
  const timeDifferenceInDays = Math.floor((currentLoginTime.getTime() - prevLoginTime.getTime()) / (1000 * 60 * 60 * 24));

  return timeDifferenceInDays >= thresholdDays ? true : false;
}

export const checkForIrregularitiesInLogin = async (user: IUserDoc) => {
  const { _id, email } = user;
  const loginHistory = await getUserLoginHistory(_id);
  // const maxGapBetweenLogins = calculateMaxGapBetweenLoginDays(loginHistory);
  // const averageLoginFrequency = calculateAverageLoginFrequency(loginHistory);
  // const thresholdDays = calculateThresholdDays(averageLoginFrequency);
  // console.log(threesholdDays)
  const irregularLogins = checkForIrregularities(loginHistory, 60);
  if (irregularLogins) {
    await User.findByIdAndUpdate(_id, { isTemporaryBlocked: true });
    const resetPasswordToken = await tokenService.generateResetPasswordToken(user?.email!);
    if (email) await sendTemporaryBlockingAccountEmail(user, resetPasswordToken);
    await logService.createLog({
      user: user!,
      event: ALL_EVENTS.ManagementEvents.SystemUserSuspend(
        user.fullName!,
        'becuase the user has attempted to login to his accounce after 60 days.'
      ),
      eventEnum: 'MaE',
    });

    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Your account is temporary blocked please contact customer support for more details'
    );
  }
};

export const getIpFromHeader = (req: Request) => {
  const userIP =
    config.serverType === Constants.localServer || config.serverType === Constants.stagingServer
      ? ((req.headers['x-forwarded-for'] || req.connection.remoteAddress) as unknown as string)
      : (req.headers['source_ip'] as unknown as string) || req.headers['do-connecting-ip'];
  return userIP as unknown as string;
};

export const localesFullForm = {
  en: 'english',
  fr: 'french',
  es: 'spanish',
  ar: 'arabic',
  de: 'german',
  ru: 'russian',
  pt: 'portugees',
  it: 'italian',
  he: 'hebrew',
  nl: 'dutch',
  bg: 'english', //'bulgarian',
  el: 'english', //'greek',
  sv: 'english', //'sweden'
};

export const localesShortForm = {
  english: 'en',
  french: 'fr',
  spanish: 'es',
  arabic: 'ar',
  german: 'de',
  russian: 'ru',
  portugees: 'pt',
  italian: 'it',
  hebrew: 'he',
  dutch: 'nl',
};
