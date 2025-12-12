import { IUnsubDoc, IUnsubModel } from './unsub.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const unsubSchema = new mongoose.Schema<IUnsubDoc, IUnsubModel>(
  {
    contactType: {
      type: String,
      required: true,
      enum: ['EMAIL', 'SMS' ]
    },

    contactInfo: {
      type: String,
      required: true,
    },
    unsubscribedOn: {
      type: String,
      required: true,
      default: new Date().toISOString()
    },

    source: {
      type: String,
      required: true,
      source: ['EMAIL_API', 'MENU_SHARING_SMS' ],

    },
   
  },
  {
    timestamps: true,
  }
);

/**
 * Check if category name is taken
 * @param {string} email - The user's email
 * @param {string} [excludeSiteId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
unsubSchema.static('isAlreadyUnsubscribed', async function (contactInfo: string,): Promise<boolean> {
  const unsub = await this.findOne({
    contactInfo: {$regex: contactInfo?.replace("+", "\\+"), $options: 'i' }
  });
  return !!unsub;
});

// add plugin that converts mongoose to json
unsubSchema.plugin(toJSON);
unsubSchema.plugin(paginate);

const Unsub = mongoose.model<IUnsubDoc, IUnsubModel>('Unsubscriber', unsubSchema);

export default Unsub;
