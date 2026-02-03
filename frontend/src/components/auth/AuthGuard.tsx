import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "../../lib/auth";

type AuthGuardProps = {
  children: ReactNode;
};

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};
