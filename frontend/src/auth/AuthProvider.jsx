import React, { createContext, useContext, useState } from "react";
import { authAPI } from "../utils/api";

const AuthContext = createContext(null);

const isInvalidToken = (token) => {
  if (token == null) return true;
  const normalized = String(token).trim().toLowerCase();
  return (
    normalized === "" || normalized === "null" || normalized === "undefined"
  );
};

const getInitialAuthData = () => {
  const token = localStorage.getItem("auth_token");
  const rawUser = localStorage.getItem("auth_user");

  if (
    isInvalidToken(token) ||
    !rawUser ||
    rawUser === "null" ||
    rawUser === "undefined"
  ) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    return { token: null, user: null };
  }

  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    return { token: null, user: null };
  }
};

export function AuthProvider({ children }) {
  const [initialAuth] = useState(() => getInitialAuthData());
  const [user, setUser] = useState(initialAuth.user);
  const [token, setToken] = useState(initialAuth.token);
  const loading = false;

  const applyAuthenticatedUser = (response) => {
    const userData = {
      userId: response.userId,
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName,
      profileImageUrl: response.profileImageUrl,
      role: response.role,
      phoneNumber: response.phoneNumber,
      doctorId: response.doctorId,
      patientId: response.patientId,
      assistantId: response.assistantId,
    };

    setToken(response.token);
    setUser(userData);
    localStorage.setItem("auth_token", response.token);
    localStorage.setItem("auth_user", JSON.stringify(userData));

    return userData;
  };

  const login = async ({ identifier, password }) => {
    const response = await authAPI.login(identifier, password);

    applyAuthenticatedUser(response);

    return response;
  };

  const register = async (registerData) => {
    const response = await authAPI.register(registerData);

    applyAuthenticatedUser(response);

    return response;
  };

  const registerWithOtp = async (registerData) => {
    return authAPI.registerWithOtp(registerData);
  };

  const verifyRegistrationOtp = async (registerData, otp) => {
    const response = await authAPI.verifyRegistrationOtp(registerData, otp);
    applyAuthenticatedUser(response);
    return response;
  };

  const resendRegistrationOtp = async (email) => {
    return authAPI.resendRegistrationOtp(email);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem("auth_user", JSON.stringify(merged));
      return merged;
    });
  };

  const value = {
    user,
    token,
    login,
    register,
    registerWithOtp,
    verifyRegistrationOtp,
    resendRegistrationOtp,
    logout,
    updateUser,
    isAuthenticated: !!token,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
