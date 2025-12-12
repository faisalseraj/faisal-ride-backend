// Keep old interfaces for backward compatibility
export interface IRole {
  name: string;
  permissions: string[];
  description?: string;
}

export interface IRoleUpdate {
  permissions?: string[];
  description?: string;
}

export interface IRoleResponse {
  name: string;
  permissions: string[];
  description?: string;
}

// Re-export from role.interfaces for new database-backed roles
export * from './role.interfaces';

