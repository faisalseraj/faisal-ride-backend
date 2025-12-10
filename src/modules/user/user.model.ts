import { IUserDoc, IUserModel, USER_TYPE } from './user.interfaces';

import { ApiError } from '../errors';
import bcrypt from 'bcryptjs';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';
import validator from 'validator';

const userSchema = new mongoose.Schema<IUserDoc, IUserModel>(
  {
    isSuperAdmin: {
      type: Boolean,
      required: false,
      validate(this: IUserDoc, value: boolean) {
        if (value && this.toObject().userType !== 'admin') {
          throw new ApiError(httpStatus.BAD_REQUEST, `isSuperAdmin can only be true if userType is admin`);
        }
      },
      message: '',
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    temporaryBlockedTill: {
      type: String,
      required: false,
    },

    isDefaultPassword: {
      type: Boolean,
      required: false,
      default: true,
    },

    fullName: {
      type: String,
      default: function () {
        const user = this as unknown as IUserDoc;
        return user.firstName + ' ' + user.lastName;
      },
    },
    company: {
      type: {
        companyName: {
          type: String,
          required: false,
          trim: true,
        },
        businessPhoneNumber: {
          type: String,
          required: false,
        },
        businessEmail: {
          type: String,
          required: false,
        },
        businessAddress: {
          type: String,
          required: false,
        }
      },
    },

    towCompany: {
      type: {
        companyName: {
          type: String,
          required: false,
          trim: true,
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
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value: string) {
        if (!validator.isEmail(value)) {
          throw new ApiError(httpStatus.BAD_REQUEST, `${value} Invalid Email`);
        }
      },
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate(value: string) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Password must contain atleast 1 number and 1 capital letter');
        }
      },
      private: true, // used by the toJSON plugin
    },
    phoneNumber: {
      type: String,
      required: false,
      unique: true,
      // minlength: 11,
      // validate(value: string) {
      //   if (!value.match(/^(\+92|92|03)\d{9}$/)) {
      //     throw new ApiError(httpStatus.BAD_REQUEST, 'Number is not valid');
      //   }
      // },
    },
    // userType: {
    //   type: String,
    //   enum: USER_TYPE,
    //   default: 'client',
    // },
    loggedInDevices: { type: [] },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneNumberVerified: {
      type: Boolean,
      default: false,
    },
    isPaidParkingSpaceProvider: {
      type: Boolean,
      default: false,
    },

    isTowOperator: {
      type: Boolean,
      default: false,
    },
    driverBadgeNumber: {
      type: String,
      required: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: String,
      default: () => new Date().toISOString(),
    },
    currentLogin: {
      type: String,
      default: () => new Date().toISOString(),
    },

    apartmentComplex: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApartmentComplex',
    },
    apartment: {
      type: [
        {
          apartmentId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          apartmentComplex: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ApartmentComplex',
          },
        },
      ],
    },

    towCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    pspCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    userType: {
      type: String,
      enum: USER_TYPE,
      // default: null,
    },
    emailVerificationReminders: [
      {
        sentAt: { type: String, required: false },
      },
    ],
    image: { type: String, default: '', required: false },
    isSuspended: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    manualPosition: { latitude: { type: String }, longitude: { type: String } },
    address: { type: String, required: false },
    district: { type: String, required: false },
    country: { type: String, required: false },
    isTemporaryBlocked: { type: Boolean, default: false },
    preferredLanguage: { type: String, default: false },
    deviceToken: { type: String, default: false },
    deviceType: { type: String, default: false },
    webToken: { type: String, default: '' },
    socketId: { type: String, required: false },
    avgRating: { type: String },
    isOnline: { type: Boolean },
    suspendReason: { type: String, required: false },
    archiveReason: { type: String, required: false },
    accountApproval: {
      type: {
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: false,
        },
        isApproved: {
          type: Boolean,
          default: true,
        },
      },
    },

    notifications: {
      type: [
        {
          status: {
            type: String,
            enum: ['warning', 'error', 'success'],
          },
          text: { type: String },
          html: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
    occupants: {
      type: [
        {
          firstName: { type: String },
          lastName: { type: String },
          dob: { type: String, required: false },
          relation: { type: String, required: false },
          apartmentComplex: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ApartmentComplex',
            required: false,
          },
          apartmentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
          },
        },
      ],
    },
    parkingDetails: {
      charges: { type: Number },
      unit: { type: String, enum: ['hour', 'day', 'week', 'month', 'year'] },
      totalSpaces: { type: Number },
      availabilityTimes: [
        {
          from: { type: String },
          to: { type: String },
          day: {
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          },
        },
      ],
    },

    licensePlates: [
      {
        plate: { type: String },
        stateShort: { type: String },
        apartmentComplex: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ApartmentComplex',
          required: true,
        },
      },
    ],

    stripeCustomerId: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.static('isEmailTaken', async function (email: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
  if (email.startsWith('dummy')) return false;
  const user = await this.findOne({ email, _id: { $ne: excludeUserId }, isDeleted: { $ne: true } });
  return !!user;
});

/**
 * Check if number is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.static(
  'isPhoneNumberTaken',
  async function (phoneNumber: string, userType: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
    // Skip check for dummy phone numbers (they start with +1000000)
    if (phoneNumber && phoneNumber.startsWith('+1000000')) return false;
    
    const user = await this.findOne({
      phoneNumber: phoneNumber,
      ...(userType, { userType: userType }),
      _id: { $ne: excludeUserId },
    });
    // check if new user or already user is client then check if user type match.

    return !!user;
  }
);

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.method('isPasswordMatch', async function (password: string): Promise<boolean> {
  const user = this;
  return bcrypt.compare(password, user.password);
});

userSchema.pre('save', async function (next) {
  const user = this as IUserDoc;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8);
  }

  if (user.isModified('firstName') || user.isModified('lastName')) {
    user.fullName = `${user.firstName} ${user.lastName}`;
  }

  if (user.email && user.isModified('email')) {
    user.email = user.email.toLowerCase();
  }

  next();
});

const User = mongoose.model<IUserDoc, IUserModel>('User', userSchema);

export default User;
