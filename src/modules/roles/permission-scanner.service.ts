import * as fs from 'fs';
import * as path from 'path';

import { ApiError } from '../errors';
import httpStatus from 'http-status';

interface ApiEndpoint {
  method: string;
  path: string;
  fullPath: string;
  routeFile: string;
  permissions: string[];
}

/**
 * Scan all route files to find APIs using a specific permission
 */
export const findApisByPermission = async (permission: string): Promise<ApiEndpoint[]> => {
  try {
    // Resolve routes directory - handle both src (dev) and dist (compiled) paths
    let routesDir: string;
    if (__dirname.includes('dist')) {
      // Running from compiled dist folder
      const projectRoot = process.cwd();
      routesDir = path.join(projectRoot, 'src', 'routes', 'v1');
    } else {
      // Running from src folder (development)
      routesDir = path.join(__dirname, '../../../routes/v1');
    }

    const routesIndexFile = path.join(routesDir, 'index.ts');
    const basePath = '/v1';

    // Check if routes directory exists
    if (!fs.existsSync(routesDir)) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Routes directory not found: ${routesDir}`);
    }

    // Check if index file exists
    if (!fs.existsSync(routesIndexFile)) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Routes index file not found: ${routesIndexFile}`);
    }

    const endpoints: ApiEndpoint[] = [];

    // Read the index.ts file to get all route mappings
    const indexContent = fs.readFileSync(routesIndexFile, 'utf-8');

    // Extract route mappings from index.ts
    const routeMappings: Array<{ path: string; file: string }> = [];

    // First, extract all imports to build a mapping
    const importMap: Record<string, string> = {};
    const importPattern = /import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g;
    let importMatch;

    while ((importMatch = importPattern.exec(indexContent)) !== null) {
      const routeVar = importMatch[1];
      const importPath = importMatch[2];
      if (routeVar && importPath) {
        importMap[routeVar] = importPath;
      }
    }

    // Match patterns like: { path: '/admin', route: adminRoute }
    const routePattern = /path:\s*['"]([^'"]+)['"],\s*route:\s*(\w+)/g;
    let match;

    while ((match = routePattern.exec(indexContent)) !== null) {
      const routePath = match[1];
      const routeVar = match[2];

      if (!routePath || !routeVar) continue;

      // Find the import path from our import map
      const importPath = importMap[routeVar];
      if (importPath) {
        const fileName = importPath.endsWith('.route.ts') ? importPath : `${importPath.replace(/\.route$/, '')}.route.ts`;
        const filePath = path.join(routesDir, fileName);

        if (fs.existsSync(filePath)) {
          routeMappings.push({
            path: routePath,
            file: filePath,
          });
        }
      }
    }

    // Scan each route file
    for (const mapping of routeMappings) {
      if (!fs.existsSync(mapping.file)) {
        continue;
      }

      const fileContent = fs.readFileSync(mapping.file, 'utf-8');
      const fileEndpoints = parseRouteFile(
        fileContent,
        mapping.path || '',
        basePath,
        path.basename(mapping.file),
        permission
      );
      endpoints.push(...fileEndpoints);
    }

    // Remove duplicates based on method + fullPath combination
    const uniqueEndpoints = new Map<string, ApiEndpoint>();
    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.fullPath}`;
      if (!uniqueEndpoints.has(key)) {
        uniqueEndpoints.set(key, endpoint);
      }
    }

    // Filter to only include endpoints where the searched permission is in the permissions array
    const filteredEndpoints = Array.from(uniqueEndpoints.values()).filter((endpoint) => {
      return endpoint.permissions && endpoint.permissions.length > 0 && endpoint.permissions.includes(permission);
    });

    return filteredEndpoints;
  } catch (error: any) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    // Wrap any unexpected errors in ApiError
    console.error('Error scanning routes:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to scan routes for permission: ${error?.message || 'Unknown error'}`
    );
  }
};

/**
 * Parse a route file to extract endpoints using a specific permission
 * Approach: Split by router.route() blocks, then check each block for the permission
 */
function parseRouteFile(
  content: string,
  routeBasePath: string,
  apiBasePath: string,
  fileName: string,
  permission: string
): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];

  // Check if router.use(auth('permission')) is used for the entire file
  const fileWideAuthMatch = content.match(/router\.use\s*\(\s*auth\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/);
  const fileWideAuth = fileWideAuthMatch && fileWideAuthMatch[1] === permission;

  // Split content by router.route() patterns
  // This regex matches: router.route('/path') or router.route('/path') with potential whitespace
  const routeBlocks = splitByRouteBlocks(content);

  for (const block of routeBlocks) {
    // Extract route path from router.route('/path')
    const routePathMatch = block.match(/router\.route\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (!routePathMatch || !routePathMatch[1]) {
      continue;
    }

    const routePath = routePathMatch[1];

    // Find all HTTP methods in this block (.get(), .post(), .put(), .patch(), .delete())
    const httpMethodMatches = block.matchAll(/\.(get|post|put|patch|delete)\s*\(/g);
    const httpMethods: Array<{ method: string; startIndex: number; endIndex: number }> = [];

    for (const methodMatch of httpMethodMatches) {
      if (methodMatch.index === undefined || !methodMatch[1]) continue;
      
      const method = methodMatch[1].toUpperCase();
      const methodStart = methodMatch.index;
      
      // Find the end of this method's middleware chain (controller call or next method)
      let methodEnd = methodStart;
      const remainingBlock = block.substring(methodStart);
      const controllerMatch = remainingBlock.match(/(Controller\.|Controller,|Controller\))/);
      const nextMethodMatch = remainingBlock.substring(methodMatch[0].length).match(/\.(get|post|put|patch|delete)\s*\(/);
      
      if (controllerMatch && controllerMatch.index !== undefined) {
        methodEnd = methodStart + controllerMatch.index + controllerMatch[0].length;
      } else if (nextMethodMatch && nextMethodMatch.index !== undefined) {
        methodEnd = methodStart + methodMatch[0].length + nextMethodMatch.index;
      } else {
        // End of block or semicolon
        const semicolonMatch = remainingBlock.match(/;/);
        if (semicolonMatch && semicolonMatch.index !== undefined) {
          methodEnd = methodStart + semicolonMatch.index + 1;
        } else {
          methodEnd = block.length;
        }
      }

      httpMethods.push({
        method,
        startIndex: methodStart,
        endIndex: methodEnd,
      });
    }

    // If no HTTP methods found, skip this block
    if (httpMethods.length === 0) {
      continue;
    }

    // Check each HTTP method for the permission
    for (const httpMethod of httpMethods) {
      const methodBlock = block.substring(httpMethod.startIndex, httpMethod.endIndex);
      const permissions = extractPermissionsFromBlock(methodBlock, fileWideAuth ? permission : null);

      // Only include if the searched permission is in the permissions array
      if (permissions.includes(permission)) {
        const fullPath = `${apiBasePath}${routeBasePath}${routePath}`.replace(/\/+/g, '/');
        endpoints.push({
          method: httpMethod.method,
          path: routePath,
          fullPath,
          routeFile: fileName,
          permissions,
        });
      }
    }
  }

  return endpoints;
}

/**
 * Split content by router.route() blocks
 * Returns array of route blocks, each containing one router.route() definition
 */
function splitByRouteBlocks(content: string): string[] {
  const blocks: string[] = [];
  const lines = content.split('\n');

  let currentBlock: string[] = [];
  let inRouteBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check if this line starts a new router.route() block
    const routeStartMatch = line.match(/router\.route\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    const routerOnlyMatch = line.trim() === 'router' || line.trim().startsWith('router');

    if (routeStartMatch && routeStartMatch[1]) {
      // If we were in a block, save it
      if (inRouteBlock && currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
      }
      // Start new block
      currentBlock = [line];
      inRouteBlock = true;
    } else if (routerOnlyMatch && !inRouteBlock) {
      // Check if next line has .route()
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.match(/\.route\s*\(\s*['"]([^'"]+)['"]\s*\)/)) {
          // Start new block
          if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
          }
          currentBlock = [line];
          inRouteBlock = true;
          continue;
        }
      }
    } else if (inRouteBlock) {
      // Continue current block
      currentBlock.push(line);

      // Check if this block ends (new router declaration or end of chained methods)
      // Block ends when we hit a line that starts with 'router' (not chained) or a blank line followed by router
      if (line.trim() === '' && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine && (nextLine.trim().startsWith('router') || nextLine.trim().startsWith('export'))) {
          // End of block
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
          inRouteBlock = false;
        }
      } else if (line && line.trim().startsWith('router') && !line.includes('.')) {
        // New router declaration (not chained)
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inRouteBlock = false;
      } else if (line && line.trim().endsWith(';') && !line.includes('Controller')) {
        // Might be end of block, but check next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && (nextLine.trim().startsWith('router') || nextLine.trim().startsWith('export'))) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
            inRouteBlock = false;
          }
        }
      }
    }
  }

  // Add last block if exists
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks;
}

/**
 * Extract all permissions from a method block using regex
 */
function extractPermissionsFromBlock(block: string, fileWidePermission: string | null): string[] {
  const permissions: string[] = [];

  // Add file-wide permission if exists
  if (fileWidePermission) {
    permissions.push(fileWidePermission);
  }

  // Find all auth('permission') patterns
  const singleAuthPattern = /auth\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let singleMatch;
  while ((singleMatch = singleAuthPattern.exec(block)) !== null) {
    if (singleMatch[1] && !permissions.includes(singleMatch[1])) {
      permissions.push(singleMatch[1]);
    }
  }

  // Find all auth(['permission1', 'permission2']) patterns
  const arrayAuthPattern = /auth\s*\(\s*\[([^\]]+)\]\s*\)/g;
  let arrayMatch;
  while ((arrayMatch = arrayAuthPattern.exec(block)) !== null) {
    if (arrayMatch[1]) {
      const perms = arrayMatch[1]
        .split(',')
        .map((p) => p.trim().replace(/['"]/g, ''))
        .filter((p) => p.length > 0);
      perms.forEach((perm) => {
        if (!permissions.includes(perm)) {
          permissions.push(perm);
        }
      });
    }
  }

  return permissions;
}
