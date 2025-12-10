import { IOptions, QueryResult } from '../paginate/paginate';
import {
  IVSF,
  IVSFBulkCreate,
  IVSFBulkDelete,
  IVSFBulkUpdate,
  IVSFScrapeRequest,
  IVSFScrapeResponse,
  IVSFStats,
  IVSFUpdate,
  NewCreatedVSF,
  SearchVSFsOptions,
} from './vsf.interfaces';

import ApiError from '../errors/ApiError';
import { VSF } from './vsf.model';
import { callTDLRScraper } from './vsf.util';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Create a VSF
 * @param {NewCreatedVSF} vsfData
 * @returns {Promise<IVSF>}
 */
export const createVSF = async (vsfData: NewCreatedVSF): Promise<IVSF> => {
  if (await VSF.isMcrNumberTaken(vsfData.mcrNumber)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MCR Number already taken');
  }
  return VSF.create(vsfData);
};

/**
 * Query for VSFs
 * @param {SearchVSFsOptions} filter - Mongo filter
 * @param {IOptions} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryVSFs = async (filter: SearchVSFsOptions, options: IOptions): Promise<QueryResult> => {
  // Handle search functionality
  if (options.search && !options.search.includes('#')) {
    // If search doesn't have the # format, convert it to the proper format
    // Search across common VSF fields
    options.search = `${options.search}#companyName,name,mcrNumber,city,state,zipcode,ownerOfficer,phone,physicalAddress`;
  }
  
  const vsfs = await VSF.paginate(filter, options);
  return vsfs;
};

/**
 * Get VSF by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IVSF | null>}
 */
export const getVSFById = async (id: mongoose.Types.ObjectId): Promise<IVSF | null> => VSF.findById(id);

/**
 * Get VSF by mcrNumber
 * @param {string} mcrNumber
 * @returns {Promise<IVSF | null>}
 */
export const getVSFByMcrNumber = async (mcrNumber: string): Promise<IVSF | null> => VSF.findOne({ mcrNumber });

/**
 * Update VSF by id
 * @param {mongoose.Types.ObjectId} vsfId
 * @param {IVSFUpdate} updateBody
 * @returns {Promise<IVSF | null>}
 */
export const updateVSFById = async (vsfId: mongoose.Types.ObjectId, updateBody: IVSFUpdate): Promise<IVSF | null> => {
  const vsf = await getVSFById(vsfId);
  if (!vsf) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VSF not found');
  }
  if (updateBody.mcrNumber && (await VSF.isMcrNumberTaken(updateBody.mcrNumber, vsfId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MCR Number already taken');
  }
  Object.assign(vsf, updateBody);
  await vsf.save();
  return vsf;
};

/**
 * Delete VSF by id
 * @param {mongoose.Types.ObjectId} vsfId
 * @returns {Promise<IVSF | null>}
 */
export const deleteVSFById = async (vsfId: mongoose.Types.ObjectId): Promise<IVSF | null> => {
  const vsf = await getVSFById(vsfId);
  if (!vsf) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VSF not found');
  }
  await vsf.deleteOne();
  return vsf;
};

/**
 * Soft delete VSF by id (set isActive to false)
 * @param {mongoose.Types.ObjectId} vsfId
 * @returns {Promise<IVSF | null>}
 */
export const softDeleteVSFById = async (vsfId: mongoose.Types.ObjectId): Promise<IVSF | null> => {
  const vsf = await getVSFById(vsfId);
  if (!vsf) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VSF not found');
  }
  vsf.isActive = false;
  await vsf.save();
  return vsf;
};

/**
 * Bulk create VSFs
 * @param {IVSFBulkCreate} bulkData
 * @returns {Promise<{ created: number; skipped: number; errors: string[] }>}
 */
export const bulkCreateVSFs = async (bulkData: IVSFBulkCreate): Promise<{ created: number; skipped: number; errors: string[] }> => {
  const { companies } = bulkData;

  let createdCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const data of companies) {
    try {
      const existingVsf = await VSF.findOne({ mcrNumber: data.mcrNumber });
      if (existingVsf) {
        skippedCount++;
        continue;
      }
      await VSF.create(data);
      createdCount++;
    } catch (error: any) {
      errors.push(`Failed to create VSF ${data.mcrNumber}: ${error.message}`);
    }
  }

  return { created: createdCount, skipped: skippedCount, errors };
};

/**
 * Bulk update VSFs
 * @param {IVSFBulkUpdate} bulkData
 * @returns {Promise<{ updated: number; errors: string[] }>}
 */
export const bulkUpdateVSFs = async (bulkData: IVSFBulkUpdate): Promise<{ updated: number; errors: string[] }> => {
  const { ids, updates } = bulkData;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const vsf = await VSF.findById(id);
      if (!vsf) {
        errors.push(`VSF with ID ${id} not found`);
        continue;
      }
      Object.assign(vsf, updates);
      await vsf.save();
      updatedCount++;
    } catch (error: any) {
      errors.push(`Failed to update VSF ${id}: ${error.message}`);
    }
  }
  return { updated: updatedCount, errors };
};

/**
 * Bulk delete VSFs
 * @param {IVSFBulkDelete} bulkData
 * @returns {Promise<{ deleted: number; errors: string[] }>}
 */
export const bulkDeleteVSFs = async (bulkData: IVSFBulkDelete): Promise<{ deleted: number; errors: string[] }> => {
  const { ids } = bulkData;
  let deletedCount = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const vsf = await VSF.findById(id);
      if (!vsf) {
        errors.push(`VSF with ID ${id} not found`);
        continue;
      }
      await vsf.deleteOne();
      deletedCount++;
    } catch (error: any) {
      errors.push(`Failed to delete VSF ${id}: ${error.message}`);
    }
  }
  return { deleted: deletedCount, errors };
};

/**
 * Get VSF statistics
 * @returns {Promise<IVSFStats>}
 */
export const getVSFStats = async (): Promise<IVSFStats> => {
  const totalVSFs = await VSF.countDocuments({ isActive: true });
  const activeVSFs = await VSF.countDocuments({ status: 'Active', isActive: true });
  const inactiveVSFs = await VSF.countDocuments({ status: 'Inactive', isActive: true });
  
  const byCarrierType = await VSF.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$carrierType', count: { $sum: 1 } } },
  ]);

  const byState = await VSF.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$state', count: { $sum: 1 } } },
  ]);

  const byCity = await VSF.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$city', count: { $sum: 1 } } },
  ]);

  const recentlyScraped = await VSF.countDocuments({
    isActive: true,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
  });

  return {
    totalVSFs,
    activeVSFs,
    inactiveVSFs,
    byCarrierType: {
      vsf: byCarrierType.find(item => item._id === 'vsf')?.count || 0,
      tow: byCarrierType.find(item => item._id === 'tow')?.count || 0,
    },
    byState: byState.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
    byCity: byCity.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
    recentlyScraped,
  };
};

/**
 * Search VSFs by text across multiple fields
 * @param {string} searchTerm - The search term
 * @param {SearchVSFsOptions} additionalFilters - Additional filters to apply
 * @returns {Promise<IVSF[]>}
 */
export const searchVSFs = async (searchTerm: string, additionalFilters: SearchVSFsOptions = {}): Promise<IVSF[]> => {
  function escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const filter = {
    isActive: true,
    ...additionalFilters,
    $or: [
      { companyName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { name: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { mcrNumber: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { city: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { state: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { zipcode: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { ownerOfficer: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { phone: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { physicalAddress: { $regex: escapeRegex(searchTerm), $options: 'i' } },
    ],
  };

  const vsfs = await VSF.find(filter).sort({ createdAt: -1 }).limit(50);
  return vsfs;
};

/**
 * Search VSFs by location
 * @param {string} city
 * @param {string} state
 * @param {string} zipcode
 * @param {number} radius
 * @returns {Promise<IVSF[]>}
 */
export const searchVSFsByLocation = async (
  city?: string,
  state?: string,
  zipcode?: string,
  _radius?: number
): Promise<IVSF[]> => {
  const filter: any = { isActive: true };

  if (city) {
    filter.city = { $regex: city, $options: 'i' };
  }
  if (state) {
    filter.state = { $regex: state, $options: 'i' };
  }
  if (zipcode) {
    filter.zipcode = zipcode;
  }

  // For now, we'll just return filtered results.
  // Geocoding and radius search would require external services or geospatial indexing.
  const vsfs = await VSF.find(filter).limit(10); // Limit to 10 for demonstration
  return vsfs;
};

/**
 * Scrape VSFs from TDLR
 * @param {IVSFScrapeRequest} scrapeRequest
 * @returns {Promise<IVSFScrapeResponse>}
 */
export const scrapeVSFs = async (scrapeRequest: IVSFScrapeRequest, Authorization: string, xApiKey: string, serverType: string): Promise<IVSFScrapeResponse> => {
  try {
    const result = await callTDLRScraper(scrapeRequest, Authorization, xApiKey, serverType);
    
    // Process the result to add missing fields and check for existing VSFs
    const companies = result.companies || [];
    let createdCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    
    // Check which companies already exist in the database
    for (const company of companies) {
      try {
        const existingVsf = await VSF.findOne({ mcrNumber: company.mcrNumber });
        if (existingVsf) {
          skippedCount++;
        } else {
          createdCount++;
        }
      } catch (error: any) {
        errors.push(`Failed to check MCR ${company.mcrNumber}: ${error.message}`);
        createdCount++; // Assume new if we can't check
      }
    }
    
    return {
      success: result.success,
      message: result.success ? 'Scraping completed successfully' : 'Scraping failed',
      totalCompanies: result.totalCompanies || companies.length,
      zipcodesProcessed: result.zipcodesProcessed || scrapeRequest.zipcodes.length,
      created: createdCount,
      skipped: skippedCount,
      carrierType: result.carrierType || scrapeRequest.carrierType || 'vsf',
      companies: companies,
      errors: [...(result.errors || []), ...errors],
    };
  } catch (error: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Scraping failed: ${error.message}`);
  }
};

/**
 * Get closest VSFs based on latitude and longitude
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} limit - Number of VSFs to return (default: 10)
 * @param {string} carrierType - Type of carrier ('vsf' or 'tow')
 * @returns {Promise<IVSF[]>}
 */
export const getClosestVSFs = async (lat: number, lng: number, limit: number = 10, carrierType: string = 'vsf'): Promise<IVSF[]> => {
  // Build the base filter
  const filter: any = {
    isActive: true,
    carrierType,
    lat: { $exists: true, $ne: null },
    lng: { $exists: true, $ne: null }
  };

  // Get all VSFs matching the filter
  const allVSFs = await VSF.find(filter).lean();

  // Calculate distance for each VSF using Haversine formula
  const vsfsWithDistance = allVSFs.map((vsf: any) => {
    const distance = calculateDistance(lat, lng, vsf.lat, vsf.lng);
    return {
      ...vsf,
      distance
    };
  });

  // Sort by distance and limit results
  const closestVSFs = vsfsWithDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return closestVSFs;
};

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in meters
  return distance;
}

/**
 * Check if MCR number is taken
 * @param {string} mcrNumber
 * @param {mongoose.Types.ObjectId} excludeVsfId
 * @returns {Promise<boolean>}
 */
export const isMcrNumberTaken = async (mcrNumber: string, excludeVsfId?: mongoose.Types.ObjectId): Promise<boolean> => {
  const vsf = await VSF.findOne({ mcrNumber, _id: { $ne: excludeVsfId } });
  return !!vsf;
};