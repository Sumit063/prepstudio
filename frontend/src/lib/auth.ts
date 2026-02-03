const ACCESS_TOKEN_KEY = "prepstudio.accessToken";
const REFRESH_TOKEN_KEY = "prepstudio.refreshToken";
const USERNAME_KEY = "prepstudio.username";

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

export const isAuthenticated = () => Boolean(getAccessToken());
