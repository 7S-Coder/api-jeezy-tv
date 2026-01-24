/**
 * Color pools for user and VIP profiles
 * These colors are used when creating a new user account
 */

// Standard colors for regular users
export const USER_COLOR_POOL = [
  '#3498db', // Blue
  '#2ecc71', // Green
  '#e74c3c', // Red
  '#f39c12', // Orange
  '#9b59b6', // Purple
  '#1abc9c', // Turquoise
  '#34495e', // Dark Grey
  '#e67e22', // Dark Orange
  '#16a085', // Dark Turquoise
  '#8e44ad', // Dark Purple
  '#2980b9', // Darker Blue
  '#27ae60', // Darker Green
];

// Premium colors for VIP users (more beautiful/vibrant)
export const VIP_COLOR_POOL = [
  '#667eea', // Premium Blue/Purple
  '#764ba2', // Royal Purple
  '#f093fb', // Hot Pink
  '#4facfe', // Cyan Blue
  '#00f2fe', // Bright Cyan
  '#43e97b', // Bright Green
  '#fa709a', // Rose Pink
  '#fee140', // Golden Yellow
  '#30cfd0', // Turquoise
  '#330867', // Deep Purple
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
];

/**
 * Generate a random color from a specific pool
 * @param isVip - If true, uses VIP color pool; otherwise uses standard user pool
 * @returns A random color hex code from the selected pool
 */
export function generateUserColor(isVip: boolean = false): string {
  const colorPool = isVip ? VIP_COLOR_POOL : USER_COLOR_POOL;
  const randomIndex = Math.floor(Math.random() * colorPool.length);
  return colorPool[randomIndex];
}

/**
 * Get all available colors for a user type
 * @param isVip - If true, returns VIP color pool; otherwise returns standard user pool
 * @returns Array of color hex codes
 */
export function getColorPool(isVip: boolean = false): string[] {
  return isVip ? VIP_COLOR_POOL : USER_COLOR_POOL;
}
