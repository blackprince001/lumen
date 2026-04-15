import { logger } from '../logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  responseType?: 'json' | 'blob';
}

// Token getter — set by AuthContext so client can inject Bearer tokens
let tokenGetter: (() => string | null) | null = null;

export function setTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

/** Returns auth headers for raw fetch() calls that can't use the api client. */
export function getAuthHeaders(): Record<string, string> {
  const token = tokenGetter?.();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    return (data as { detail?: string })?.detail || `HTTP ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

// Tracks whether a refresh is already in flight to avoid concurrent refresh loops
let isRefreshing = false;

async function attemptSilentRefresh(): Promise<string | null> {
  if (isRefreshing) return null;
  isRefreshing = true;
  try {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  } finally {
    isRefreshing = false;
  }
}

// Endpoints that should never trigger silent-refresh / login-redirect on 401.
// These are the auth endpoints themselves — bootstrap refresh MUST be allowed to
// fail quietly so unauthenticated visitors can reach /login without a redirect loop.
const AUTH_BOOTSTRAP_PATHS = ['/auth/refresh', '/auth/me', '/auth/logout', '/auth/google', '/auth/admin/login'];

function isAuthBootstrapPath(endpoint: string): boolean {
  return AUTH_BOOTSTRAP_PATHS.some((p) => endpoint === p || endpoint.startsWith(`${p}?`));
}

export async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {},
  _isRetry = false
): Promise<T> {
  const { body, params, responseType = 'json', headers: customHeaders, credentials, ...restOptions } = options;

  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let url = `${baseUrl}${cleanEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
    const paramString = searchParams.toString();
    if (paramString) url += `?${paramString}`;
  }

  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Inject Bearer token if available
  const token = tokenGetter?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...restOptions,
    headers,
    // Always include credentials so the httpOnly refresh cookie rides along on
    // login, refresh, and logout. Harmless for other endpoints.
    credentials: credentials ?? 'include',
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  };

  logger.debug(`${config.method?.toUpperCase() || 'GET'} ${endpoint}`);

  try {
    const response = await fetch(url, config);

    if (response.status === 401 && !_isRetry) {
      // Never try to rescue the auth endpoints themselves — they're the ones
      // we'd call to rescue. Propagate the 401 and let AuthContext decide.
      if (isAuthBootstrapPath(cleanEndpoint)) {
        throw new ApiError(401, await extractErrorMessage(response));
      }

      // Attempt silent refresh once
      const newToken = await attemptSilentRefresh();
      if (newToken) {
        const captured = newToken;
        setTokenGetter(() => captured);
        return fetchApi<T>(endpoint, options, true);
      }

      // Refresh failed — let AuthContext handle the redirect via ProtectedRoute
      throw new ApiError(401, 'Session expired');
    }

    if (!response.ok) {
      const errorMessage = await extractErrorMessage(response);
      logger.error('Response error:', { url: endpoint, status: response.status });
      throw new ApiError(response.status, errorMessage);
    }

    logger.debug(`${response.status} ${config.method?.toUpperCase() || 'GET'} ${endpoint}`);

    if (responseType === 'blob') return response.blob() as Promise<T>;
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T;
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Network error:', error);
    throw new ApiError(0, 'Network error: Could not reach server');
  }
}

export const api = {
  get: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    fetchApi<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    fetchApi<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    fetchApi<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
