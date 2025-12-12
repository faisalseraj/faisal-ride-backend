import { IUserDoc, IUserModel, USER_TYPE } from './user.interfaces';

import { ApiError } from '../errors';
import bcrypt from 'bcryptjs';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';
import validator from 'validator';

/**
 * Faisal Ride User Schema
 * Simplified for carpooling application with admin and rider user types
 */
const userSchema = new mongoose.Schema<IUserDoc, IUserModel>(
  {
    // Basic Info
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
    },
    fullName: {
      type: String,
      default: function () {
        const user = this as unknown as IUserDoc;
        return `${user.firstName} ${user.lastName || ''}`.trim();
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
          throw new ApiError(httpStatus.BAD_REQUEST, `${value} is not a valid email`);
        }
      },
    },
    phoneNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate(value: string) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Password must contain at least 1 number and 1 letter');
        }
      },
      private: true,
    },
    userType: {
      type: String,
      enum: USER_TYPE,
      required: true,
      default: 'rider',
    },

    // Profile
    image: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    dateOfBirth: {
      type: String,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    },

    // Location
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    country: {
      type: String,
    },
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },

    // Authentication & Status
    lastLogin: {
      type: String,
      default: () => new Date().toISOString(),
    },
    currentLogin: {
      type: String,
      default: () => new Date().toISOString(),
    },
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
    isSuspended: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isTemporaryBlocked: {
      type: Boolean,
      default: false,
    },
    temporaryBlockedTill: {
      type: String,
    },
    isDefaultPassword: {
      type: Boolean,
      default: true,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
      validate(this: IUserDoc, value: boolean) {
        if (value && this.toObject().userType !== 'admin') {
          throw new ApiError(httpStatus.BAD_REQUEST, 'isSuperAdmin can only be true for admin users');
        }
      },
    },

    // Device & Notifications
    preferredLanguage: {
      type: String,
      default: 'english',
    },
    deviceToken: {
      type: String,
    },
    deviceType: {
      type: String,
    },
    socketId: {
      type: String,
    },
    webToken: {
      type: String,
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    loggedInDevices: {
      type: [],
      default: [],
    },

    // Rider Specific - Vehicle
    vehicle: {
      make: { type: String },
      model: { type: String },
      year: { type: Number },
      color: { type: String },
      licensePlate: { type: String },
      seats: { type: Number, default: 4 },
    },

    // Rider Specific - Preferences
    ridePreferences: {
      smokingAllowed: { type: Boolean, default: false },
      petsAllowed: { type: Boolean, default: false },
      musicAllowed: { type: Boolean, default: true },
      chatPreference: { type: String, enum: ['quiet', 'friendly', 'any'], default: 'any' },
      genderPreference: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
    },

    // Rider Stats
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    totalTripsPosted: {
      type: Number,
      default: 0,
    },

    // Driver Verification
    isDriverVerified: {
      type: Boolean,
      default: false,
    },
    driversLicense: {
      number: { type: String },
      expiryDate: { type: String },
      isVerified: { type: Boolean, default: false },
    },

    // Account Status
    suspendReason: {
      type: String,
    },
    archiveReason: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Notifications
    notifications: [
      {
        status: {
          type: String,
          enum: ['warning', 'error', 'success', 'info'],
        },
        text: { type: String },
        html: { type: String },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Payment
    stripeCustomerId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Plugins
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 */
userSchema.static('isEmailTaken', async function (email: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
  if (email.startsWith('dummy')) return false;
  const user = await this.findOne({ email, _id: { $ne: excludeUserId }, isDeleted: { $ne: true } });
  return !!user;
});

/**
 * Check if phone number is taken
 */
userSchema.static(
  'isPhoneNumberTaken',
  async function (phoneNumber: string, _: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
    if (phoneNumber && phoneNumber.startsWith('+1000000')) return false;
    const user = await this.findOne({
      phoneNumber,
      _id: { $ne: excludeUserId },
      isDeleted: { $ne: true },
    });
    return !!user;
  }
);

/**
 * Check if password matches
 */
userSchema.method('isPasswordMatch', async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
});

/**
 * Pre-save middleware
 */
userSchema.pre('save', async function (next) {
  const user = this as IUserDoc;
  
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8);
  }

  if (user.isModified('firstName') || user.isModified('lastName')) {
    user.fullName = `${user.firstName} ${user.lastName || ''}`.trim();
  }

  if (user.email && user.isModified('email')) {
    user.email = user.email.toLowerCase();
  }

  next();
});

const User = mongoose.model<IUserDoc, IUserModel>('User', userSchema);

export default User;
