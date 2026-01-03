/**
 * Security configuration for server-side operations
 * Controls which native APIs are allowed to execute on the server
 */

export interface SecurityConfig {
  /**
   * Allow execution of shell commands (shell.openPath, shell.openExternal, etc.)
   * WARNING: Only enable in trusted environments (e.g., local dev, controlled servers)
   * Default: false
   */
  allowShellExecution?: boolean;

  /**
   * Allow file system access (reading/writing files outside static dir)
   * WARNING: Only enable in trusted environments
   * Default: false
   */
  allowFileSystemAccess?: boolean;

  /**
   * Whitelist of allowed file system paths
   * When allowFileSystemAccess is true, only these paths (and subdirectories) are accessible
   * Use absolute paths. Empty array = no restrictions (dangerous!)
   * Default: []
   */
  allowedPaths?: string[];

  /**
   * Allow app.getPath() and similar system path queries
   * Generally safer than full filesystem access
   * Default: true
   */
  allowPathQueries?: boolean;

  /**
   * Custom validation function for shell commands
   * Return true to allow, false to deny
   * If not provided, all commands are allowed when allowShellExecution=true
   */
  validateShellCommand?: (command: string, args: string[]) => boolean;

  /**
   * Custom validation function for file paths
   * Return true to allow, false to deny
   * If not provided, allowedPaths whitelist is used
   */
  validateFilePath?: (path: string) => boolean;
}

/**
 * Default security configuration - everything disabled for safety
 */
export const DEFAULT_SECURITY_CONFIG: Required<SecurityConfig> = {
  allowShellExecution: false,
  allowFileSystemAccess: false,
  allowedPaths: [],
  allowPathQueries: true,
  validateShellCommand: () => false,
  validateFilePath: () => false,
};

/**
 * Example: Permissive configuration for trusted environments (like Auto-Claude)
 */
export const TRUSTED_SECURITY_CONFIG: SecurityConfig = {
  allowShellExecution: true,
  allowFileSystemAccess: true,
  allowedPaths: [], // No restrictions - trust all paths
  allowPathQueries: true,
};

/**
 * Merge user config with defaults
 */
export function mergeSecurityConfig(userConfig?: SecurityConfig): Required<SecurityConfig> {
  const config = { ...DEFAULT_SECURITY_CONFIG, ...userConfig };

  // If allowedPaths is empty and allowFileSystemAccess is true, set up custom validator
  if (config.allowedPaths.length === 0 && config.allowFileSystemAccess) {
    // Empty allowedPaths with allowFileSystemAccess=true means "allow all paths"
    config.validateFilePath = () => true;
  } else if (config.allowedPaths.length > 0) {
    // Set up path validator based on whitelist
    const allowedPaths = config.allowedPaths;
    config.validateFilePath = (path: string) => {
      const normalizedPath = path.replace(/\\/g, '/');
      return allowedPaths.some(allowedPath => {
        const normalizedAllowed = allowedPath.replace(/\\/g, '/');
        return normalizedPath.startsWith(normalizedAllowed);
      });
    };
  }

  // If shell execution is disabled, override validator
  if (!config.allowShellExecution) {
    config.validateShellCommand = () => false;
  } else if (!userConfig?.validateShellCommand) {
    // If enabled but no custom validator, allow all commands
    config.validateShellCommand = () => true;
  }

  return config;
}

/**
 * Security error thrown when operation is not allowed
 */
export class SecurityError extends Error {
  constructor(operation: string, reason: string) {
    super(`[Security] ${operation} not allowed: ${reason}`);
    this.name = 'SecurityError';
  }
}
