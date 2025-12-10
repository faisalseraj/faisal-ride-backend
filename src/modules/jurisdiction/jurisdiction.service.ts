import { IJurisdiction, IJurisdictionDoc, NewCreatedJurisdiction, UpdateJurisdictionBody } from './jurisdiction.interfaces';

import ApiError from '../errors/ApiError';
import { ILocation } from '../tow-request/tow-request.interfaces';
import Jurisdiction from './jurisdiction.model';
import httpStatus from 'http-status';

export const createJurisdiction = async (jurisdictionBody: NewCreatedJurisdiction): Promise<IJurisdictionDoc> => {
  try{


  if (await Jurisdiction.findOne({ name: jurisdictionBody.name })) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Jurisdiction with this name already exists');
  }
  return Jurisdiction.create(jurisdictionBody);
    }catch(e){
    console.log(e)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Unable to create Jurisdiction.');

  }
};

export const queryJurisdictions = async (filter: Record<string, any>, options: Record<string, any>) => {
  // Handle search functionality
  if (options['search']) {
    // Format: searchTerm#field1,field2,field3
    const searchFields = 'name,description,city,state,county,zip';
    options['search'] = `${options['search']}#${searchFields}`;
  }
  
  return Jurisdiction.paginate(filter, options);
};

export const getJurisdictionById = async (id: string) => Jurisdiction.findById(id);

export const updateJurisdictionById = async (
  jurisdictionId: string,
  updateBody: UpdateJurisdictionBody
): Promise<IJurisdictionDoc | null> => {
  const jurisdiction = await getJurisdictionById(jurisdictionId);
  if (!jurisdiction) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Jurisdiction not found');
  }
  if (updateBody.name && updateBody.name !== jurisdiction.name) {
    const existing = await Jurisdiction.findOne({ name: updateBody.name });
    if (existing) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Jurisdiction with this name already exists');
    }
  }

  // Check if any charge field has changed
  const hasChargesChanged = updateBody.charges && 
    Object.keys(updateBody.charges).some(key => {
      const currentValue = jurisdiction.charges?.[key as keyof typeof jurisdiction.charges];
      const newValue = updateBody.charges?.[key as keyof typeof updateBody.charges];
      return currentValue !== newValue;
    });

  // If charges have changed, update the chargesUpdatedAt timestamp
  if (hasChargesChanged) {
    const newTimestamp = new Date();
    updateBody.chargesUpdatedAt = newTimestamp;
  }

  Object.assign(jurisdiction, updateBody);
  await jurisdiction.save();
  return jurisdiction;
};

export const deleteJurisdictionById = async (jurisdictionId: string): Promise<IJurisdictionDoc | null> => {
  const jurisdiction = await getJurisdictionById(jurisdictionId);
  if (!jurisdiction) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Jurisdiction not found');
  }
  await jurisdiction.deleteOne();
  return jurisdiction;
};

export const bulkUpdateJurisdictions = async (jurisdictionIds: string[], updates: Partial<UpdateJurisdictionBody>) => {
  // Check if charges are being updated in bulk
  const hasChargesUpdate = updates.charges && Object.keys(updates.charges).length > 0;
  
  // If charges are being updated, add chargesUpdatedAt timestamp
  if (hasChargesUpdate) {
    const newTimestamp = new Date();
    updates.chargesUpdatedAt = newTimestamp;
    console.log(`Charges updated for ${jurisdictionIds.length} jurisdictions at ${newTimestamp.toISOString()}`);
  }

  const result = await Jurisdiction.updateMany(
    { _id: { $in: jurisdictionIds } },
    { $set: updates }
  );
  return result;
};

/**
 * Find jurisdiction based on a given location.
 * Will match by zip first, then city+state, then county.
 */
export const findJurisdictionByLocation = async (location: ILocation): Promise<IJurisdiction | null> => {
  if (!location) return null;

  // Try exact match by ZIP (most reliable)
  if (location.zip) {
    const jByZip = await Jurisdiction.findOne({ zip: location.zip });
    if (jByZip) return jByZip.toObject();
  }

  // Try city + state
  if (location.city && location.state) {
    const jByCityState = await Jurisdiction.findOne({
      city: new RegExp(`^${location.city}$`, 'i'),
      state: new RegExp(`^${location.state}$`, 'i'),
    });
    if (jByCityState) return jByCityState.toObject();
  }

  // Try county + state
  if (location.county && location.state) {
    const jByCounty = await Jurisdiction.findOne({
      county: new RegExp(`^${location.county}$`, 'i'),
      state: new RegExp(`^${location.state}$`, 'i'),
    });
    if (jByCounty) return jByCounty.toObject();
  }

  // No jurisdiction found
  return null;
};
