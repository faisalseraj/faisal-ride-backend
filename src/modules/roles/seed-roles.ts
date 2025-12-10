import { roleRights, roles } from '../../config/roles';

import Role from './role.model';
import config from '../../config/config';
import logger from '../logger/logger';
import mongoose from 'mongoose';

/**
 * Role descriptions mapping
 */
const roleDescriptions: Record<string, string> = {
  admin: 'Administrator with full system access',
  superadmin: 'Super administrator with elevated privileges',
  'apartment-complex-owner': 'Owner of an apartment complex',
  'apartment-complex-manager': 'Manager of an apartment complex',
  'apartment-complex-employee': 'Employee of an apartment complex',
  'tow-company-owner': 'Owner of a tow company',
  'tow-company-manager': 'Manager of a tow company',
  'tow-company-employee': 'Employee of a tow company',
  'parking-spaces-provider-owner': 'Owner of a parking spaces provider',
  'parking-spaces-provider-manager': 'Manager of a parking spaces provider',
  'parking-spaces-provider-employee': 'Employee of a parking spaces provider',
  'tow-requester': 'User who can request tow services',
  renter: 'Renter of an apartment',
  customer: 'General customer',
};

/**
 * Seed roles from roles.ts into database
 * This function is idempotent - can be run multiple times safely
 * @param silent - If true, only logs errors and completion summary
 */
export const seedRoles = async (silent: boolean = false): Promise<void> => {
  try {
    if (!silent) {
      logger.info('Starting roles seed...');
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const roleName of roles) {
      let permissions = roleRights.get(roleName) || [];
      const description = roleDescriptions[roleName] || `Role: ${roleName}`;

      // Ensure manageRoles is only in admin role - remove it from all other roles
      if (roleName.toLowerCase() !== 'admin' && permissions.includes('manageRoles')) {
        permissions = permissions.filter((p) => p !== 'manageRoles');
        logger.warn(`Removed "manageRoles" permission from ${roleName} role (only allowed for admin)`);
      }

      // Check if role already exists
      const existingRole = await Role.findOne({ name: roleName.toLowerCase() });

      if (existingRole) {
        // Update existing role if permissions have changed
        const permissionsChanged = JSON.stringify(existingRole.permissions.sort()) !== JSON.stringify(permissions.sort());
        
        if (permissionsChanged || !existingRole.description) {
          // Ensure manageRoles is not in non-admin roles
          let updatedPermissions = permissions;
          if (roleName.toLowerCase() !== 'admin' && updatedPermissions.includes('manageRoles')) {
            updatedPermissions = updatedPermissions.filter((p) => p !== 'manageRoles');
          }
          
          existingRole.permissions = updatedPermissions;
          existingRole.description = description;
          existingRole.isSystemRole = true; // Mark as system role
          existingRole.isActive = true;
          await existingRole.save();
          updatedCount++;
          if (!silent) {
            logger.info(`Updated role: ${roleName}`);
          }
        } else {
          skippedCount++;
        }
      } else {
        // Create new role
        await Role.create({
          name: roleName.toLowerCase(),
          permissions,
          description,
          isSystemRole: true, // Mark as system role
          isActive: true,
        });
        createdCount++;
        if (!silent) {
          logger.info(`Created role: ${roleName}`);
        }
      }
    }

    if (createdCount > 0 || updatedCount > 0) {
      logger.info(`Roles seed completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`);
    } else if (!silent) {
      logger.info(`Roles seed completed: All roles up to date (${skippedCount} skipped)`);
    }
  } catch (error) {
    logger.error('Error seeding roles:', error);
    throw error;
  }
};

/**
 * Run seed script directly (for CLI usage)
 */
const runSeed = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url);
    logger.info('Connected to MongoDB');

    // Run seed
    await seedRoles();

    // Close connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    logger.error('Seed script failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runSeed().catch((error) => {
    console.error('Unhandled error in seed script:', error);
    process.exit(1);
  });
}

export default seedRoles;

