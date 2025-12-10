import { IUserRoleAssignmentDoc, IUserRoleAssignmentModel } from './role.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const userRoleAssignmentSchema = new mongoose.Schema<IUserRoleAssignmentDoc, IUserRoleAssignmentModel>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one active role per user
userRoleAssignmentSchema.index({ userId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

// add plugin that converts mongoose to json
userRoleAssignmentSchema.plugin(toJSON);
userRoleAssignmentSchema.plugin(paginate);

const UserRoleAssignment = mongoose.model<IUserRoleAssignmentDoc, IUserRoleAssignmentModel>(
  'UserRoleAssignment',
  userRoleAssignmentSchema
);

export default UserRoleAssignment;

