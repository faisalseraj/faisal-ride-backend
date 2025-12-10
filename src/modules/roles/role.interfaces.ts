import { Document, Model } from 'mongoose';
import { IUserDoc, IUserType } from '../user/user.interfaces';

import { QueryResult } from '../paginate/paginate';

export interface IRole {
  name: string;
  permissions: string[];
  description?: string;
  isSystemRole?: boolean;
  isActive?: boolean;
}

export interface IRoleDoc extends IRole, Document {}

export interface IRoleModel extends Model<IRoleDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type NewCreatedRole = IRole;
export type UpdateRoleBody = Partial<Omit<IRole, 'name'>>;

// User Role Assignment interfaces
export interface IUserRoleAssignment {
  userId: IUserDoc['_id'];
  roleId: IRoleDoc['_id'];
  assignedBy: IUserDoc['_id'];
  assignedAt: Date;
  isActive: boolean;
  notes?: string;
}

export interface IUserRoleAssignmentDoc extends IUserRoleAssignment, Document {}

export interface IUserRoleAssignmentModel extends Model<IUserRoleAssignmentDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type NewCreatedUserRoleAssignment = IUserRoleAssignment;
export type UpdateUserRoleAssignmentBody = Partial<Omit<IUserRoleAssignment, 'userId' | 'roleId' | 'assignedBy' | 'assignedAt'>>;

// Role assignment authorization rules
export interface IRoleAssignmentRule {
  assignerUserType: IUserType;
  assignableUserTypes: IUserType[];
}

// Define who can assign roles to whom
export const ROLE_ASSIGNMENT_RULES: IRoleAssignmentRule[] = [
  {
    assignerUserType: 'admin',
    assignableUserTypes: [
      'admin',
      'apartment-complex-owner',
      'apartment-complex-manager',
      'apartment-complex-employee',
      'tow-company-owner',
      'tow-company-manager',
      'tow-company-employee',
      'parking-spaces-provider-owner',
      'parking-spaces-provider-manager',
      'parking-spaces-provider-employee',
      'tow-requester',
      'renter',
    ],
  },
  {
    assignerUserType: 'tow-company-owner',
    assignableUserTypes: [
      'tow-company-manager',
      'tow-company-employee',
      'parking-spaces-provider-owner',
      'parking-spaces-provider-manager',
      'parking-spaces-provider-employee',
    ],
  },
  {
    assignerUserType: 'apartment-complex-owner',
    assignableUserTypes: ['apartment-complex-manager', 'apartment-complex-employee'],
  },
];

