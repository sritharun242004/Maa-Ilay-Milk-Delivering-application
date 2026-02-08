/**
 * API Configuration
 * Returns the correct API base URL based on environment
 */

// Get API base URL from environment variable or use relative path for development
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Helper function to construct full API URLs
 * @param path - API endpoint path (e.g., '/api/auth/login')
 * @returns Full API URL
 */
export function getApiUrl(path: string): string {
  // If path already starts with http/https, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // If no base URL is set (development), return relative path
  if (!API_BASE_URL) {
    return path;
  }

  // Remove trailing slash from base URL and leading slash from path if present
  const base = API_BASE_URL.replace(/\/$/, '');
  const endpoint = path.startsWith('/') ? path : `/${path}`;

  return `${base}${endpoint}`;
}
