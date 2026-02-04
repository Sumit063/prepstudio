import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { clearAuthTokens, getAccessToken, getRefreshToken, isTokenExpired } from "../../lib/auth";
import { refreshAuthTokens } from "../../lib/api";

type AuthGuardProps = {
  children: ReactNode;
};

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        if (active) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      if (!isTokenExpired(accessToken)) {
        if (active) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

      const refreshToken = getRefreshToken();
      if (!refreshToken || isTokenExpired(refreshToken, 0)) {
        clearAuthTokens();
        if (active) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      const refreshed = await refreshAuthTokens();
      if (active) {
        setAllowed(Boolean(refreshed?.access));
        setChecking(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const checkExpiry = () => {
      const refreshToken = getRefreshToken();
      if (refreshToken && isTokenExpired(refreshToken, 0)) {
        clearAuthTokens();
        navigate("/login", { replace: true, state: { from: location.pathname } });
      }
    };
    checkExpiry();
    const timer = window.setInterval(checkExpiry, 60000);
    return () => window.clearInterval(timer);
  }, [location.pathname, navigate]);

  if (checking) {
    return null;
  }

  if (!allowed) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};
