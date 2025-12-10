import { IOptions, QueryResult } from '../paginate/paginate';
import { IUnsubDoc, NewCreatedUnsub } from './unsub.interfaces';

import { ApiError } from '../errors';
// import { Message } from '../utils/errorMessage';
import Unsub from './unsub.model';
import httpStatus from 'http-status';

// import { Review } from '../review';
/**
 * Create a user
 * @param {NewCreatedUnsub} categoryBody
 * @returns {Promise<IUnsubDoc>}
 */
export const createUnsub = async (categoryBody: NewCreatedUnsub): Promise<IUnsubDoc> => {
  const { contactInfo } = categoryBody;
  // // try {
  if (await Unsub.isAlreadyUnsubscribed(contactInfo)) {
    // throw new ApiError(httpStatus.BAD_REQUEST, 'category already exists');
    throw new ApiError(httpStatus.BAD_REQUEST, 'You have already Unsubscribed');
  }

  // if (await Unsub.isDisplayPriorityTaken(displayPriority!, siteId)) {
  //   // throw new ApiError(httpStatus.BAD_REQUEST, 'category display priority conflicts');
  //   throw new ApiError(httpStatus.BAD_REQUEST, Message.galleryImages.displayPriorityConflict[language]);
  // }
  return Unsub.create(categoryBody);
  // }
  // catch (e) {
  //   console.log(e, 'ERROR')
  //   throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, JSON.stringify(e))
  // }
};

/**
 * Query for unsubscribers
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryUnsub = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  const unsubscribers = await Unsub.paginate(filter, { ...options });
  return unsubscribers;
};

/**
 * Get user by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IUnsubDoc | null>}
 */
export const getUnsubsEmails = async (): Promise<string[]> => {
  const unsubs = await Unsub.find({ contactType: 'EMAIL', source: 'EMAIL_API' });
  return unsubs.map((unsub: IUnsubDoc) => unsub.contactInfo);
};
