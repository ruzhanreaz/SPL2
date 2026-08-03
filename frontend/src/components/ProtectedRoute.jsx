import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();
  const location = useLocation();

  const inferredAllowedRoles = (() => {
    if (allowedRoles) return allowedRoles;
    if (location.pathname.startsWith("/admin")) return ["ADMIN"];
    if (location.pathname.startsWith("/doctor")) return ["DOCTOR"];
    if (location.pathname.startsWith("/assistant")) return ["ASSISTANT"];
    if (location.pathname.startsWith("/patient")) return ["PATIENT"];
    return null;
  })();

  // Wait for authentication check to complete
  if (auth?.loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!auth?.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control
  if (inferredAllowedRoles && !inferredAllowedRoles.includes(auth.user?.role)) {
    const dashboardRoutes = {
      ADMIN: "/admin/dashboard",
      PATIENT: "/patient/dashboard",
      DOCTOR: "/doctor/dashboard",
      ASSISTANT: "/assistant/dashboard",
    };
    return <Navigate to={dashboardRoutes[auth.user?.role] || "/"} replace />;
  }

  return children;
}
