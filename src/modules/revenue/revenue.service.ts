import { IRevenueDoc, NewRevenueBody, UpdateRevenueBody } from './revenue.interfaces';

import ApiError from '../errors/ApiError';
import { QueryResult } from '../paginate/paginate';
import Revenue from './revenue.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Create a revenue record
 * @param {NewRevenueBody} revenueBody
 * @returns {Promise<IRevenueDoc>}
 */
export const createRevenue = async (revenueBody: NewRevenueBody): Promise<IRevenueDoc> => {
  return Revenue.create(revenueBody);
};

/**
 * Query for revenues
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryRevenues = async (filter: Record<string, any>, options: any): Promise<QueryResult> => {
  const revenues = await Revenue.paginate(filter, options);
  return revenues;
};

/**
 * Get revenue by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IRevenueDoc | null>}
 */
export const getRevenueById = async (id: mongoose.Types.ObjectId): Promise<IRevenueDoc | null> => {
  return Revenue.findById(id);
};

/**
 * Update revenue by id
 * @param {mongoose.Types.ObjectId} revenueId
 * @param {UpdateRevenueBody} updateBody
 * @returns {Promise<IRevenueDoc | null>}
 */
export const updateRevenueById = async (
  revenueId: mongoose.Types.ObjectId,
  updateBody: UpdateRevenueBody
): Promise<IRevenueDoc | null> => {
  const revenue = await getRevenueById(revenueId);
  if (!revenue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Revenue not found');
  }
  Object.assign(revenue, updateBody);
  await revenue.save();
  return revenue;
};

/**
 * Delete revenue by id
 * @param {mongoose.Types.ObjectId} revenueId
 * @returns {Promise<IRevenueDoc | null>}
 */
export const deleteRevenueById = async (revenueId: mongoose.Types.ObjectId): Promise<IRevenueDoc | null> => {
  const revenue = await getRevenueById(revenueId);
  if (!revenue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Revenue not found');
  }
  await revenue.deleteOne();
  return revenue;
};

/**
 * Get revenue statistics
 * @returns {Promise<Object>}
 */
export const getRevenueStats = async () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Daily revenue (today)
  const dailyRevenue = await Revenue.aggregate([
    {
      $match: {
        status: 'succeeded',
        paymentDate: { $gte: startOfDay }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Monthly revenue (current month)
  const monthlyRevenue = await Revenue.aggregate([
    {
      $match: {
        status: 'succeeded',
        paymentDate: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Yearly revenue (current year)
  const yearlyRevenue = await Revenue.aggregate([
    {
      $match: {
        status: 'succeeded',
        paymentDate: { $gte: startOfYear }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Total revenue (all time)
  const totalRevenue = await Revenue.aggregate([
    {
      $match: {
        status: 'succeeded'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Revenue by billing interval
  const revenueByInterval = await Revenue.aggregate([
    {
      $match: {
        status: 'succeeded'
      }
    },
    {
      $group: {
        _id: '$billingInterval',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    daily: {
      total: dailyRevenue[0]?.total || 0,
      count: dailyRevenue[0]?.count || 0
    },
    monthly: {
      total: monthlyRevenue[0]?.total || 0,
      count: monthlyRevenue[0]?.count || 0
    },
    yearly: {
      total: yearlyRevenue[0]?.total || 0,
      count: yearlyRevenue[0]?.count || 0
    },
    total: {
      total: totalRevenue[0]?.total || 0,
      count: totalRevenue[0]?.count || 0
    },
    byInterval: revenueByInterval
  };
};

/**
 * Get revenue for a specific date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
export const getRevenueByDateRange = async (startDate: Date, endDate: Date) => {
  const revenue = await Revenue.aggregate([
    {
      $match: {
        status: 'succeeded',
        paymentDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        daily: {
          $push: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
            amount: '$amount',
            billingInterval: '$billingInterval'
          }
        }
      }
    }
  ]);

  return {
    total: revenue[0]?.total || 0,
    count: revenue[0]?.count || 0,
    daily: revenue[0]?.daily || []
  };
};
