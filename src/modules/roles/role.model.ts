import { IRoleDoc, IRoleModel } from './role.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const roleSchema = new mongoose.Schema<IRoleDoc, IRoleModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    permissions: {
      type: [String],
      required: true,
      default: [],
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
roleSchema.plugin(toJSON);
roleSchema.plugin(paginate);

const Role = mongoose.model<IRoleDoc, IRoleModel>('Role', roleSchema);

export default Role;

