import { IVSFScrapeRequest, IVSFScrapeResponse } from './vsf.interfaces';

// import { Request } from 'express';
import { ApiError } from '../errors';
import config from '../../config/config';
// Using built-in fetch (Node.js 18+)
import httpStatus from 'http-status';

/**
 * Calls the Python FastAPI TDLR scraper endpoint.
 */
export const callTDLRScraper = async (scrapeRequest: IVSFScrapeRequest, Authorization: string, xApiKey: string, serverType: string): Promise<IVSFScrapeResponse> => {
  try {
    const response = await fetch(`${config.customOCRURL}/tdlr-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': Authorization, // You might want to get this from request context
        'xApiKey': xApiKey, // You might want to get this from request context
        'serverType': serverType,
      },
      body: JSON.stringify(scrapeRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TDLR Scraper API Error: ${response.status} - ${errorText}`);
      throw new ApiError(
        response.status,
        `TDLR Scraper API failed: ${response.statusText}. Details: ${errorText}`
      );
    }

    const result = await response.json() as IVSFScrapeResponse;
    
    if (!result.success) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'TDLR scraping failed');
    }

    return result;
  } catch (error) {
    console.error('Error calling TDLR scraper:', error);
   
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to scrape TDLR data');
  }
};

/**
 * Validate zipcode format
 */
export const validateZipcode = (zipcode: string): boolean => {
  // Basic regex for 5-digit or 5-digit + 4-digit format
  return /^\d{5}(-\d{4})?$/.test(zipcode);
};

/**
 * Validate a list of zipcodes
 */
export const validateZipcodes = (zipcodes: string[]): { valid: string[]; invalid: string[] } => {
  const valid: string[] = [];
  const invalid: string[] = [];
  zipcodes.forEach(zipcode => {
    if (validateZipcode(zipcode)) {
      valid.push(zipcode);
    } else {
      invalid.push(zipcode);
    }
  });
  return { valid, invalid };
};

/**
 * Transform TDLR company data to VSF format
 */
export const transformTDLRToVSF = (tdlrCompany: any): any => {
  return {
    companyName: tdlrCompany.companyName,
    name: tdlrCompany.name,
    mcrNumber: tdlrCompany.mcrNumber,
    city: tdlrCompany.city,
    state: tdlrCompany.state,
    zipcode: tdlrCompany.zipcode,
    ownerOfficer: tdlrCompany.ownerOfficer,
    phone: tdlrCompany.phone,
    physicalAddress: tdlrCompany.physicalAddress,
    status: tdlrCompany.status || 'Active',
    carrierType: tdlrCompany.carrier_type || 'vsf',
    isActive: true,
  };
};

/**
 * Get scraping rate limits based on user type
 */
export const getScrapingRateLimits = (userType: string): { maxZipcodes: number; delay: number } => {
  switch (userType) {
    case 'admin':
    case 'super-admin':
      return { maxZipcodes: 50, delay: 0.5 }; // Higher limits for admins
    case 'apartment-complex-owner':
    case 'apartment-complex-manager':
      return { maxZipcodes: 20, delay: 1.0 }; // Moderate limits
    case 'apartment-complex-employee':
      return { maxZipcodes: 5, delay: 2.0 }; // Lower limits
    default:
      return { maxZipcodes: 1, delay: 5.0 }; // Very restricted for others
  }
};

/**
 * Check if user has permissions to scrape
 */
export const checkScrapingPermissions = (userType: string): boolean => {
  const allowedRoles = [
    'admin',
    'super-admin',
    'apartment-complex-owner',
    'apartment-complex-manager',
    'apartment-complex-employee',
  ];
  return allowedRoles.includes(userType);
};