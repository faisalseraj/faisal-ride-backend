import { IApartmentComplexDoc, IApartmentComplexModel } from './apartmentComplex.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const apartmentComplexSchema = new mongoose.Schema<IApartmentComplexDoc, IApartmentComplexModel>(
  {
    apartmentComplexName: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: {
        type: String,
        required: true,
      },
      lng: {
        type: String,
        required: true,
      },
    },

    licensePlates: [
      {
        plate: {
          type: String,
          required: true,
        },
        // stateFull: {
        //   type: String,
        //   required: true,
        // },
        stateShort: {
          type: String,
          required: true,
        },
      },
    ],
    totalParkingSpaces: {
      type: Number,
      default: 0,
    },
    maxApartments: {
      type: Number,
      default: 0,
    },
    availableParkingSpaces: {
      type: Number,
      default: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    managers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    users: [
      {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        slotNumber: {
          type: Number,
          required: true,
        },
        slotId: {
          type: Number,
          required: true,
        },
      },
    ],
    allowApartments: {
      type: String,
      enum: ['on', 'off'],
      defaultValue: 'off',
    },
    apartments: [
      {
        maxOccupantsAllowed: {
          type: Number,
          default: 0,
        },
        maxRentersAllowed: {
          type: Number,
          default: 0,
        },
        apartmentNumber: {
          type: String,
          required: true,
        },
        licensePlates: [
          {
            plate: {
              type: String,
              required: false,
            },
            stateShort: {
              type: String,
              required: false,
            },
            renterId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
              required: false,
            },
          },
        ],
        renters: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
          },
        ],
      },
    ],
    licensePlateLimitPerRenter: {
      type: Number,
    },
    renewalContractTime: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
apartmentComplexSchema.plugin(toJSON);
apartmentComplexSchema.plugin(paginate);

const ApartmentComplex = mongoose.model<IApartmentComplexDoc, IApartmentComplexModel>(
  'ApartmentComplex',
  apartmentComplexSchema
);

export default ApartmentComplex;
