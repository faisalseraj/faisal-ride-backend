import { INewUserDoc, INewUserModel } from './new-user.interfaces';

import { ApiError } from '../errors';
import { USER_TYPE } from '../user/user.interfaces';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';
import validator from 'validator';

const newUserSchema = new mongoose.Schema<INewUserDoc, INewUserModel>(
  {
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

    fullName: {
      type: String,
      default: function () {
        const user = this as unknown as INewUserDoc;
        return user.firstName + ' ' + user.lastName;
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

    phoneNumber: {
      type: String,
      required: false,
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

    userType: {
      type: String,
      enum: USER_TYPE,
      // default: null,
    },

    requestCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    towCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    company: {
      type: {
        companyName: {
          type: String,
          required: false,
          trim: true,
        },
      },
    },

    passkey: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
newUserSchema.plugin(toJSON);
newUserSchema.plugin(paginate);

const NewUser = mongoose.model<INewUserDoc, INewUserModel>('NewUser', newUserSchema);

export default NewUser;
