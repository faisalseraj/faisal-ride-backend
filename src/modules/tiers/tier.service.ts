import { IOptions, QueryResult } from '../paginate/paginate';
import { ITier, ITierDoc, NewCreatedTier } from './tier.interfaces';

import { ApiError } from '../errors';
import Tier from './tier.model';
import { createStripePriceId } from '../stripe/stripe.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Create a tier
 * @param {NewCreatedTier} tierData
 * @returns {Promise<ITierDoc>}
 */
export const createTier = async (tierData: NewCreatedTier): Promise<ITierDoc> => {
  try {
    // Create the tier first
    const tier = await Tier.create(tierData);
    
    // Create Stripe Price ID for the tier
    try {
      const stripePriceId = await createStripePriceId(tier);
      tier.stripePriceId = stripePriceId;
      await tier.save();
    } catch (stripeError) {
      console.error('Failed to create Stripe Price ID for tier:', tier._id, stripeError);
      // Don't fail tier creation if Stripe fails, just log the error
      // The tier can be updated later with the Stripe Price ID
    }
    
    return tier;
  } catch (error) {
    console.error('Error creating tier:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create tier');
  }
};

/**
 * Query for tiers
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryTiers = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  const tiers = await Tier.paginate(filter, options);
  return tiers;
};

/**
 * Get tier by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ITierDoc | null>}
 */
export const getTierById = async (id: mongoose.Types.ObjectId): Promise<ITierDoc | null> => {
  return Tier.findById(id);
};

/**
 * Get all active tiers
 * @returns {Promise<ITierDoc[]>}
 */
export const getAllActiveTiers = async (): Promise<ITierDoc[]> => {
  return Tier.find({ isActive: true }).sort({ price: 1 });
};

/**
 * Update tier by id
 * @param {mongoose.Types.ObjectId} tierId
 * @param {Partial<ITier>} updateBody
 * @returns {Promise<ITierDoc | null>}
 */
export const updateTierById = async (tierId: mongoose.Types.ObjectId, updateBody: Partial<ITier>): Promise<ITierDoc | null> => {
  const tier = await getTierById(tierId);
  if (!tier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
  }
  Object.assign(tier, updateBody);
  await tier.save();
  return tier;
};

/**
 * Delete tier by id
 * @param {mongoose.Types.ObjectId} tierId
 * @returns {Promise<ITierDoc | null>}
 */
export const deleteTierById = async (tierId: mongoose.Types.ObjectId): Promise<ITierDoc | null> => {
  const tier = await getTierById(tierId);
  if (!tier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
  }
  // Soft delete by setting isActive to false
  tier.isActive = false;
  await tier.save();
  return tier;
};

/**
 * Hard delete tier by id (for admin purposes)
 * @param {mongoose.Types.ObjectId} tierId
 * @returns {Promise<void>}
 */
export const hardDeleteTierById = async (tierId: mongoose.Types.ObjectId): Promise<void> => {
  const tier = await getTierById(tierId);
  if (!tier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
  }
  await Tier.findByIdAndDelete(tierId);
};

