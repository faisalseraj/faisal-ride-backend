const allRoles = {
  // Rider role - basic users who can create trips and book rides
  rider: [
    'self',
    'updateProfile',
  ],

  // Admin role - system administrators with full access
  admin: [
    'self',
    'updateProfile',
    'getUsers',
    'createUser',
    'updateUser',
    'deleteUser',
    'manageUsers',
    'manageAdmins',
    'manageSuperAdmin',
    'verifyDriver',
    'getLogs',
    'manageRoles',
    'changeEmail',
    'impersonation',
    'createAPIKey',
    'generateAdminReport',
  ],
};

export const roles: string[] = Object.keys(allRoles);
export const roleRights: Map<string, string[]> = new Map(Object.entries(allRoles));
