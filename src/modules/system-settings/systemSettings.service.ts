import { ISystemSettings, ISystemSettingsDoc } from './systemSettings.interfaces';

import { ApiError } from '../errors';
import SystemSettings from './systemSettings.model';
import httpStatus from 'http-status';

// import { formatByHours } from './clicks.util';

/**
 * CRUD operations for System Settings
 */

export const createSystemSettings = async (systemSettingsBody: ISystemSettings): Promise<ISystemSettingsDoc> => {
  const systemSettings = await SystemSettings.find();
  if (systemSettings.length === 1) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only one system setting is allowed');
  }
  return SystemSettings.create(systemSettingsBody);
};

export const getSystemSettings = async (id: string): Promise<ISystemSettingsDoc | null> => {
  return SystemSettings.findById(id);
};

export const getFirstSystemSettings = async (): Promise<ISystemSettingsDoc | null> => {
  const systemSettings = await SystemSettings.find().limit(1).populate('modifiedBy');
  return systemSettings[0] || null;
};

export const updateSystemSettings = async (
  // _id: string,
  updateBody: Partial<ISystemSettings>
): Promise<ISystemSettingsDoc | null> => {
  const systemSettingsExists = await getFirstSystemSettings();

  if (!systemSettingsExists) {
    return createSystemSettings(updateBody as ISystemSettings);
  } else {
    const systemSettings = await SystemSettings.find().limit(1);
    if (systemSettings.length === 0) {
      return null;
    }
    const firstSystemSetting = systemSettings[0];
    return SystemSettings.findByIdAndUpdate(firstSystemSetting?._id, updateBody, { new: true, runValidators: true });
  }
};

export const deleteSystemSettings = async (id: string): Promise<ISystemSettingsDoc | null> => {
  return SystemSettings.findByIdAndDelete(id);
};

export async function decodeVin(vin: string) {
  try {
    const apiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`;

    const response = await fetch(apiUrl);

    // Check if the response was successful.
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }

    const data:any = await response.json();

    // Check if the VIN was successfully decoded.
    if (data.Results && data.Results.length > 0) {
      // Helper function to find a specific detail from the results array.
      const getDetail = (variableName: string) => {
        const result = data.Results.find((item: any) => item.Variable === variableName);
        return result ? result.Value : null;
      };

      // Extract the relevant vehicle details.
      const vehicleDetails = {
        vin,
        make: getDetail('Make'),
        model: getDetail('Model'),
        modelYear: getDetail('Model Year'),
        driveType: getDetail('Drive Type'),
        manufacturerName: getDetail('Manufacturer Name'),
        vehicleType: getDetail('Vehicle Type'),
        engineCylinders: getDetail('Engine Cylinders'),
        fuelTypePrimary: getDetail('Fuel Type - Primary'),
      };

      return vehicleDetails;
    } else {
      // If no results are found, throw a specific error.
      return { error: 'Unable to load vin details' };
    }
  } catch (e) {
    console.log(e);
    return { error: 'Unable to load vin details' };
  }
  // Define the VIN decoding API endpoint.
}
