import { IBookParkingDoc, IBookParkingModel } from './book-parking.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const BookParkingSchema = new mongoose.Schema<IBookParkingDoc, IBookParkingModel>(
  {
    parkingProviderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    bookedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    previousBookingIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'BookParking',
      required: false,
    },

    nextBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookParking',
      required: false,
    },

    parkingStartTime: {
      type: String,
      required: true,
      default: new Date().toISOString(),
    },

    parkingCompletedAt: {
      type: String,
      required: false,
    },
    parkingEndTime: {
      type: String,
      required: true,
    },

    licensePlate: {
      type: String,
      required: true,
    },

    parkingTime: {
      type: Number,
      required: true,
    },

    payableCharges: {
      type: Number,
      required: true,
    },

    parkingDetails: {
      charges: { type: Number },
      unit: { type: String, enum: ['hour', 'day', 'week', 'month', 'year'] },
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },

    isOcrScanner: {
      type: Boolean,
      default: false,
      required: true,
    },
    state: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['ONGOING', 'COMPLETED'],
      default: 'ONGOING',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
BookParkingSchema.plugin(toJSON);
BookParkingSchema.plugin(paginate);

const BookParking = mongoose.model<IBookParkingDoc, IBookParkingModel>('BookParking', BookParkingSchema);

export default BookParking;
