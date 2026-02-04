const ACCESS_TOKEN_KEY = "prepstudio.accessToken";
const REFRESH_TOKEN_KEY = "prepstudio.refreshToken";
const USERNAME_KEY = "prepstudio.username";

const decodeBase64 = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
};

const getTokenPayload = (token: string) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(decodeBase64(payload)) as { exp?: number };
  } catch {
    return null;
  }
};

export const getTokenExpiryMs = (token: string | null) => {
  if (!token) return null;
  const payload = getTokenPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
};

export const isTokenExpired = (token: string | null, skewSeconds = 30) => {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return true;
  return Date.now() + skewSeconds * 1000 >= expiryMs;
};

export const getAccessToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY);

export const getRefreshToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(REFRESH_TOKEN_KEY);

export const getUsername = () =>
  typeof window === "undefined" ? null : localStorage.getItem(USERNAME_KEY);

export const setAuthTokens = (access: string, refresh: string, username?: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  if (username) {
    localStorage.setItem(USERNAME_KEY, username);
  }
};

export const clearAuthTokens = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
};

export const isAuthenticated = () => !isTokenExpired(getAccessToken());
