import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  ShieldAlert,
  UserX,
  Loader2,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import usePageMeta from "../hooks/usePageMeta";
import { trackEvent } from "../utils/analytics";

/**
 * Professional Login Component
 *
 * Features:
 * - Email/phone + password authentication with JWT
 * - Comprehensive error handling with backend integration
 * - Role-based dashboard routing (ADMIN, PATIENT, DOCTOR, ASSISTANT)
 * - Account security features (lockout detection, inactive account handling)
 * - Professional UI matching VitaBridge design system
 * - Accessible form controls with proper ARIA labels
 * - Client-side validation before submission
 * - Loading states and visual feedback
 */
export default function Login() {
  usePageMeta({
    title: "Sign In | VitaBridge",
    description:
      "Sign in to VitaBridge to manage appointments, consultations, and health records securely.",
  });

  // Form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Hooks
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect path after successful login
  const from = location.state?.from?.pathname || null;

  /**
   * Validates identifier as email or phone number format
   * @param {string} val - The identifier to validate
   * @returns {boolean} True if valid email or phone
   */
  const validateIdentifier = (val) => {
    // Email validation: standard format
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

    // Phone validation: international format (7-15 digits, optional + prefix)
    const cleanedPhone = val.replace(/[\s()-]/g, "");
    const isPhone = /^\+?[1-9]\d{6,14}$/.test(cleanedPhone);

    return isEmail || isPhone;
  };

  /**
   * Client-side form validation
   * @returns {Object} Validation errors object
   */
  const validateForm = () => {
    const errors = {};

    // Identifier validation
    if (!identifier.trim()) {
      errors.identifier = "Email or phone number is required";
    } else if (!validateIdentifier(identifier.trim())) {
      errors.identifier = "Please enter a valid email address or phone number";
    }

    // Password validation
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 4) {
      errors.password = "Password must be at least 4 characters";
    }

    return errors;
  };

  /**
   * Handles login form submission
   * Validates input, authenticates with backend, and redirects to appropriate dashboard
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset error states
    setError("");
    setErrorType("");
    setValidationErrors({});

    // Client-side validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    try {
      // Authenticate via AuthProvider
      const response = await auth.login({
        identifier: identifier.trim(),
        password: password,
      });

      // Role-based dashboard routing
      const dashboardRoutes = {
        ADMIN: "/admin/dashboard",
        PATIENT: "/patient/dashboard",
        DOCTOR: "/doctor/dashboard",
        ASSISTANT: "/assistant/dashboard",
      };

      // Determine redirect path
      const redirectPath = from || dashboardRoutes[response.role] || "/";

      // Navigate to appropriate dashboard
      navigate(redirectPath, { replace: true });
      trackEvent("login_success", { role: response.role || "unknown" });
    } catch (err) {
      trackEvent("login_error", { code: err.error || "unknown" });
      // Handle backend error responses
      switch (err.error) {
        case "ACCOUNT_LOCKED":
          setErrorType("LOCKED");
          setError(
            "Your account has been temporarily locked due to multiple failed login attempts. Please try again in 30 minutes or contact support.",
          );
          break;

        case "ACCOUNT_INACTIVE":
          setErrorType("INACTIVE");
          setError(
            "Your account is inactive. Please contact support at vitabridge.healthcare.demo@gmail.com for assistance.",
          );
          break;

        case "INVALID_CREDENTIALS":
        case "AUTHENTICATION_FAILED":
          setErrorType("CREDENTIALS");
          setError(
            "Invalid email/phone number or password. Please check your credentials and try again.",
          );
          break;

        case "VALIDATION_ERROR":
          setErrorType("VALIDATION");
          setError("Please check your input and try again.");
          if (err.details) {
            setValidationErrors(err.details);
          }
          break;

        default:
          setErrorType("GENERAL");
          setError(
            err.message ||
            "An error occurred during login. Please try again later.",
          );
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Returns error alert styles based on error type
   * @returns {string} Tailwind CSS classes
   */
  const getErrorAlertStyles = () => {
    switch (errorType) {
      case "LOCKED":
        return "bg-warning-50 border-warning-300 text-warning-900";
      case "INACTIVE":
        return "bg-error-50 border-error-300 text-error-900";
      case "CREDENTIALS":
        return "bg-error-50 border-error-300 text-error-800";
      case "VALIDATION":
        return "bg-warning-50 border-warning-300 text-warning-900";
      default:
        return "bg-error-50 border-error-300 text-error-800";
    }
  };

  /**
   * Returns appropriate error icon based on error type
   * @returns {React.Component} Lucide icon component
   */
  const getErrorIcon = () => {
    switch (errorType) {
      case "LOCKED":
        return ShieldAlert;
      case "INACTIVE":
        return UserX;
      default:
        return AlertCircle;
    }
  };

  /**
   * Clears field-specific error when user starts typing
   * @param {string} field - Field name
   */
  const clearFieldError = (field) => {
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
    if (error) {
      setError("");
      setErrorType("");
    }
  };

  return (
    <div className="page-shell auth-graffiti-bg min-h-screen md:h-screen overflow-y-auto md:overflow-hidden flex items-center justify-center px-4 pt-20 pb-4">
      <div className="w-full max-w-5xl md:h-full">
        {/* Split Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl flex flex-col md:flex-row md:h-full md:max-h-[calc(100vh-6rem)]">
          {/* ── Left Branding Panel ── */}
          <div className="bg-primary-600 md:w-5/12 flex flex-col items-center justify-center px-8 py-10 text-white">
            <BrandLogo
              className="w-12 h-12 mb-5"
              strokeClassName="text-white/80"
            />
            <span className="text-3xl font-extrabold tracking-tight mb-2">
              VitaBridge
            </span>
            <p className="text-primary-200 text-sm text-center">
              Your trusted health companion
            </p>
          </div>

          {/* ── Right Form Panel ── */}
          <div className="md:w-7/12 flex flex-col justify-center px-8 py-8 overflow-visible md:overflow-hidden">
            <h1 className="app-page-title mb-6">Sign In</h1>

            {/* Error Alert */}
            {error && (
              <div
                className={`mb-5 p-3 rounded-lg border-2 ${getErrorAlertStyles()} transition-all duration-300`}
              >
                <div className="flex items-start">
                  {React.createElement(getErrorIcon(), {
                    className: "w-5 h-5 mr-3 flex-shrink-0 mt-0.5",
                  })}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email/Phone */}
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-semibold text-gray-700 mb-1.5"
                >
                  Email or Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      clearFieldError("identifier");
                    }}
                    placeholder="you@example.com or +1234567890"
                    className={`block w-full rounded-lg border bg-gray-50 py-2.5 pl-10 pr-4 text-sm transition-all duration-200 focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 ${validationErrors.identifier ? "border-error-300 focus:border-error-500 focus:ring-error-500" : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"}`}
                    autoComplete="username"
                    disabled={loading}
                    aria-invalid={
                      validationErrors.identifier ? "true" : "false"
                    }
                    aria-describedby={
                      validationErrors.identifier
                        ? "identifier-error"
                        : undefined
                    }
                  />
                </div>
                {validationErrors.identifier && (
                  <p
                    id="identifier-error"
                    className="mt-1.5 flex items-center gap-1 text-sm text-error-600"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors.identifier}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold text-gray-700"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError("password");
                    }}
                    placeholder="Enter your password"
                    className={`block w-full rounded-lg border bg-gray-50 py-2.5 pl-10 pr-12 text-sm transition-all duration-200 focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 ${validationErrors.password ? "border-error-300 focus:border-error-500 focus:ring-error-500" : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"}`}
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={validationErrors.password ? "true" : "false"}
                    aria-describedby={
                      validationErrors.password ? "password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <p
                    id="password-error"
                    className="mt-1.5 flex items-center gap-1 text-sm text-error-600"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all duration-200 shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Register Link */}
            <Link
              to="/register"
              onClick={() => trackEvent("login_create_account_click")}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm border border-gray-300 hover:border-primary-600 bg-white hover:bg-primary-50 text-gray-600 hover:text-primary-700 font-semibold rounded-full transition-all duration-200"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create an Account</span>
            </Link>

            <p className="mt-5 text-center text-xs text-gray-400">
              By signing in, you agree to our terms of service and privacy
              policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
