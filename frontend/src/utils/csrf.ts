/**
 * CSRF Token Utility
 * Fetches and manages CSRF tokens for API requests
 */

import { getApiUrl } from '../config/api';

let cachedToken: string | null = null;

/**
 * Fetches a CSRF token from the server
 * @returns Promise<string> The CSRF token
 */
export async function fetchCsrfToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await fetch(getApiUrl('/api/csrf-token'), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }

    const data = await response.json();
    cachedToken = data.csrfToken;
    return cachedToken!;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Clears the cached CSRF token
 * Call this when you receive a CSRF error to fetch a fresh token
 */
export function clearCsrfToken(): void {
  cachedToken = null;
}

/**
 * Makes a fetch request with CSRF token included
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns Promise<Response>
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await fetchCsrfToken();

  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', token);

  const response = await fetch(getApiUrl(url), {
    ...options,
    credentials: 'include',
    headers,
  });

  // Auto-retry once on CSRF failure (handles stale tokens after external redirects)
  if (response.status === 403) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === 'CSRF_VALIDATION_FAILED' || data?.error?.includes('CSRF')) {
      clearCsrfToken();
      const freshToken = await fetchCsrfToken();
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set('X-CSRF-Token', freshToken);
      return fetch(getApiUrl(url), {
        ...options,
        credentials: 'include',
        headers: retryHeaders,
      });
    }
  }

  return response;
}
