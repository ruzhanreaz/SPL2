import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  User,
  UserPlus,
  AlertCircle,
  Loader2,
  LogIn,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import usePageMeta from "../hooks/usePageMeta";
import { trackEvent } from "../utils/analytics";

const PASSWORD_REQUIREMENTS = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/, /.{8,}/];

export default function Register() {
  usePageMeta({
    title: "Create Account | VitaBridge",
    description:
      "Create your VitaBridge account to book doctor appointments and manage your healthcare journey online.",
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [otpNotice, setOtpNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};

    // First name validation
    const firstName = form.firstName.trim();
    if (!firstName) {
      e.firstName = "First name is required";
    } else if (firstName.length < 2) {
      e.firstName = "First name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
      e.firstName =
        "First name can only contain letters, spaces, hyphens, and apostrophes";
    }

    // Last name validation
    const lastName = form.lastName.trim();
    if (!lastName) {
      e.lastName = "Last name is required";
    } else if (lastName.length < 2) {
      e.lastName = "Last name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
      e.lastName =
        "Last name can only contain letters, spaces, hyphens, and apostrophes";
    }

    // Email validation
    if (!form.email.trim()) {
      e.email = "Email is required";
    } else if (
      !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(form.email)
    ) {
      e.email = "Enter a valid email address";
    }

    // Phone validation
    if (!form.phone.trim()) {
      e.phone = "Phone number is required";
    } else {
      const cleanedPhone = form.phone.replace(/[\s()-]/g, "");
      if (!/^\+?[1-9]\d{6,14}$/.test(cleanedPhone)) {
        e.phone =
          "Enter a valid phone number (7-15 digits, optionally starting with +)";
      }
    }

    // Password validation
    if (!form.password) {
      e.password = "Password is required";
    } else if (!PASSWORD_REQUIREMENTS.every((req) => req.test(form.password))) {
      e.password =
        "Password must contain 8+ chars, uppercase, lowercase, number, and special character";
    }

    // Confirm password validation
    if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }

    return e;
  };

  const handleChange = (k) => (ev) => {
    setForm((s) => ({ ...s, [k]: ev.target.value }));
    // Clear error for this field when user starts typing
    if (errors[k]) {
      setErrors((e) => {
        const newErrors = { ...e };
        delete newErrors[k];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();

    if (otpSent) {
      const otpErrors = {};
      if (!/^\d{6}$/.test(otpCode)) {
        otpErrors.otp = "Enter the 6-digit OTP from your email";
      }
      setErrors(otpErrors);
      if (Object.keys(otpErrors).length) return;

      setOtpLoading(true);
      try {
        const response = await auth.verifyRegistrationOtp(
          pendingRegistration,
          otpCode,
        );

        const role = response.role;
        const dashboardRoutes = {
          ADMIN: "/admin/dashboard",
          PATIENT: "/patient/dashboard",
          DOCTOR: "/doctor/dashboard",
          ASSISTANT: "/assistant/dashboard",
        };
        const redirectPath = dashboardRoutes[role] || "/patient/dashboard";
        navigate(redirectPath, { replace: true });
        trackEvent("register_success", { role: role || "unknown" });
      } catch (error) {
        trackEvent("register_error");
        setErrors({
          otp: error.message || "Invalid or expired OTP. Please try again.",
        });
      } finally {
        setOtpLoading(false);
      }
      return;
    }

    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);

    try {
      const registerPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      };

      await auth.registerWithOtp(registerPayload);
      setPendingRegistration(registerPayload);
      setOtpSent(true);
      setOtpCode("");
      setOtpNotice("A 6-digit code was sent to your email. Enter it below.");
      setErrors({});
    } catch (error) {
      trackEvent("register_error");
      // Handle validation errors from backend
      if (error.details) {
        setErrors(error.details);
      } else {
        setErrors({
          submit: error.message || "Registration failed. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const email = pendingRegistration?.email || form.email.trim();
    if (!email) {
      setErrors({ otp: "Email is missing. Please fill registration details." });
      return;
    }

    setResendingOtp(true);
    try {
      await auth.resendRegistrationOtp(email);
      setOtpNotice("A new OTP has been sent to your email.");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.otp;
        return next;
      });
    } catch (error) {
      setErrors({ otp: error.message || "Failed to resend OTP" });
    } finally {
      setResendingOtp(false);
    }
  };

  const handleEditDetails = () => {
    setOtpSent(false);
    setOtpCode("");
    setPendingRegistration(null);
    setOtpNotice("");
    setErrors({});
  };

  const getPasswordStrength = () => {
    if (!form.password) return { color: "bg-gray-200", text: "" };
    if (form.password.length < 4)
      return { color: "bg-error-500", text: "Weak" };
    if (form.password.length < 8)
      return { color: "bg-warning-500", text: "Medium" };
    return { color: "bg-success-500", text: "Set" };
  };

  const strength = getPasswordStrength();

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
            <h1 className="app-page-title mb-6">Create Account</h1>
            {/* Global Error Alert */}
            {errors.submit && (
              <div className="mb-5 rounded-lg border-2 border-error-300 bg-error-50 p-3 text-error-800 transition-all duration-300">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{errors.submit}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-xs font-semibold text-gray-700 mb-1.5"
                  >
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="firstName"
                      type="text"
                      value={form.firstName}
                      onChange={handleChange("firstName")}
                      placeholder="John"
                      className={`block w-full pl-10 pr-4 py-2.5 text-sm border ${
                        errors.firstName
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      disabled={loading || otpLoading || otpSent}
                      aria-invalid={errors.firstName ? "true" : "false"}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-2 flex items-center text-sm text-error-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.firstName}
                    </p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-xs font-semibold text-gray-700 mb-1.5"
                  >
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="lastName"
                      type="text"
                      value={form.lastName}
                      onChange={handleChange("lastName")}
                      placeholder="Doe"
                      className={`block w-full pl-10 pr-4 py-2.5 text-sm border ${
                        errors.lastName
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      disabled={loading || otpLoading || otpSent}
                      aria-invalid={errors.lastName ? "true" : "false"}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-2 flex items-center text-sm text-error-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email Input */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-gray-700 mb-1.5"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange("email")}
                      placeholder="john.doe@example.com"
                      className={`block w-full pl-10 pr-4 py-2.5 text-sm border ${
                        errors.email
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      autoComplete="email"
                      disabled={loading || otpLoading || otpSent}
                      aria-invalid={errors.email ? "true" : "false"}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 flex items-center text-sm text-error-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone Input */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-xs font-semibold text-gray-700 mb-1.5"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange("phone")}
                      placeholder="+1234567890 or 1234567890"
                      className={`block w-full pl-10 pr-4 py-2.5 text-sm border ${
                        errors.phone
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      autoComplete="tel"
                      disabled={loading || otpLoading || otpSent}
                      aria-invalid={errors.phone ? "true" : "false"}
                    />
                  </div>
                  {errors.phone && (
                    <p className="mt-2 flex items-center text-sm text-error-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Password Input */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-gray-700 mb-1.5"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange("password")}
                      placeholder="Enter a strong password"
                      className={`block w-full pl-10 pr-12 py-2.5 text-sm border ${
                        errors.password
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      autoComplete="new-password"
                      disabled={loading || otpLoading || otpSent}
                      aria-invalid={errors.password ? "true" : "false"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || otpLoading || otpSent}
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

                  {/* Password Strength Indicator */}
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${strength.color} transition-all duration-300`}
                            style={{
                              width: `${
                                (PASSWORD_REQUIREMENTS.filter((req) =>
                                  req.test(form.password),
                                ).length /
                                  PASSWORD_REQUIREMENTS.length) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        {strength.text && (
                          <span className="text-xs font-medium text-gray-600">
                            {strength.text}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-xs text-gray-600">
                    Password must contain 8+ chars, uppercase, lowercase,
                    number, and special character.
                  </p>

                  {errors.password && (
                    <p className="mt-2 flex items-center text-sm text-error-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold text-gray-700 mb-1.5"
                  >
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={handleChange("confirmPassword")}
                      placeholder="Re-enter your password"
                      className={`block w-full pl-10 pr-12 py-2.5 text-sm border ${
                        errors.confirmPassword
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      autoComplete="new-password"
                      disabled={loading || otpLoading || otpSent}
                      aria-invalid={errors.confirmPassword ? "true" : "false"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || otpLoading || otpSent}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-2 flex items-center text-sm text-error-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              {otpSent && (
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 space-y-3">
                  <p className="text-sm text-primary-800 font-medium">
                    {otpNotice ||
                      "Enter the OTP sent to your email to complete registration."}
                  </p>
                  <div>
                    <label
                      htmlFor="registrationOtp"
                      className="block text-xs font-semibold text-gray-700 mb-1.5"
                    >
                      6-digit OTP <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="registrationOtp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(ev) => {
                        const value = ev.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setOtpCode(value);
                        if (errors.otp) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.otp;
                            return next;
                          });
                        }
                      }}
                      placeholder="123456"
                      className={`block w-full px-4 py-2.5 text-sm border ${
                        errors.otp
                          ? "border-error-300 focus:ring-error-500 focus:border-error-500"
                          : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      } rounded-lg bg-white focus:outline-none focus:ring-2 transition-all duration-200`}
                    />
                    {errors.otp && (
                      <p className="mt-2 flex items-center text-sm text-error-600">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.otp}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendingOtp || otpLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border border-gray-300 hover:border-primary-600 bg-white hover:bg-primary-50 text-gray-700 hover:text-primary-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {resendingOtp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {resendingOtp ? "Resending..." : "Resend OTP"}
                    </button>
                    <button
                      type="button"
                      onClick={handleEditDetails}
                      disabled={otpLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border border-gray-300 hover:border-gray-400 bg-white text-gray-700 disabled:opacity-70"
                    >
                      Edit Details
                    </button>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all duration-200 shadow-sm"
                  disabled={loading || otpLoading}
                >
                  {loading || otpLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {otpSent ? "Verifying OTP..." : "Sending OTP..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>
                        {otpSent ? "Verify OTP & Create Account" : "Send OTP"}
                      </span>
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

            {/* Login Link */}
            <Link
              to="/login"
              onClick={() => trackEvent("register_signin_click")}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm border border-gray-300 hover:border-primary-600 bg-white hover:bg-primary-50 text-gray-600 hover:text-primary-700 font-semibold rounded-full transition-all duration-200"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Link>

            <p className="mt-5 text-center text-xs text-gray-400">
              By creating an account, you agree to our terms of service and
              privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
