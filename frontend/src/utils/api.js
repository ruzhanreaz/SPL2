// Use an explicit API URL when provided, otherwise stay on the current origin.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

const parseApiError = async (response, fallbackMessage) => {
  let message = fallbackMessage;
  let errorCode = null;
  let errorDetails = null;

  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorBody = await response.json();
      errorCode = errorBody?.error || null;
      errorDetails = errorBody?.details || null;
      if (errorBody?.message) {
        message = errorBody.message;
      } else if (
        errorBody?.error === "VALIDATION_ERROR" &&
        errorBody?.details
      ) {
        const validationMessages = Object.entries(errorBody.details)
          .map(([field, fieldMessage]) => `${field}: ${fieldMessage}`)
          .join("; ");
        if (validationMessages) {
          message = validationMessages;
        }
      }
    } else {
      const text = await response.text();
      if (text && text.trim()) {
        message = text.trim();
      }
    }
  } catch {
    // Keep fallback message when error response can't be parsed.
  }

  const error = new Error(message);
  error.status = response.status;
  error.code = errorCode;
  error.details = errorDetails;
  return error;
};

export const authAPI = {
  login: async (identifier, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });

      // Parse JSON response for both success and error cases
      let data = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (e) {
          console.error("Failed to parse response:", e);
        }
      }

      if (!response.ok) {
        // Handle structured error responses from backend
        if (data && data.error) {
          const error = new Error(data.message || "Login failed");
          error.error = data.error;
          error.details = data.details;
          throw error;
        }

        // Fallback for non-structured errors
        if (response.status === 401) {
          throw new Error("Invalid credentials. Please try again.");
        } else if (response.status === 403) {
          throw new Error("Access denied.");
        } else if (response.status === 423) {
          throw new Error("Account locked. Please try again later.");
        } else if (response.status === 500) {
          throw new Error(
            data?.message || "Server error. Please try again later.",
          );
        }
        throw new Error(data?.message || "Login failed. Please try again.");
      }

      return data;
    } catch (error) {
      // If it's already an Error object we created, rethrow it
      if (error instanceof Error) {
        throw error;
      }
      // Network or other errors
      console.error("Network error during login:", error);
      throw new Error(
        "Unable to connect to the server. Please check your connection.",
      );
    }
  },

  register: async (registerData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      // Handle structured error responses from backend
      if (data && data.error) {
        const error = new Error(data.message || "Registration failed");
        error.error = data.error;
        error.details = data.details;
        throw error;
      }

      // Fallback for non-structured errors
      if (response.status === 401) {
        throw new Error("Unauthorized. Please check your credentials.");
      } else if (response.status === 403) {
        throw new Error("Access denied.");
      } else if (response.status === 409) {
        throw new Error(
          data?.message ||
            "An account with this email or phone number already exists.",
        );
      }
      throw new Error(data?.message || "Registration failed");
    }

    return data;
  },

  registerWithOtp: async (registerData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      if (data && data.error) {
        const error = new Error(data.message || "Failed to send OTP");
        error.error = data.error;
        error.details = data.details;
        throw error;
      }
      throw new Error(data?.message || "Failed to send OTP");
    }

    return data;
  },

  verifyRegistrationOtp: async (registerData, otp) => {
    const response = await fetch(
      `${API_BASE_URL}/auth/verify-registration-otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OTP": String(otp || "").trim(),
        },
        body: JSON.stringify(registerData),
      },
    );

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      if (data && data.error) {
        const error = new Error(data.message || "OTP verification failed");
        error.error = data.error;
        error.details = data.details;
        throw error;
      }
      throw new Error(data?.message || "OTP verification failed");
    }

    return data;
  },

  resendRegistrationOtp: async (email) => {
    const response = await fetch(
      `${API_BASE_URL}/auth/resend-registration-otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, purpose: "REGISTRATION" }),
      },
    );

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      if (data && data.error) {
        const error = new Error(data.message || "Failed to resend OTP");
        error.error = data.error;
        error.details = data.details;
        throw error;
      }
      throw new Error(data?.message || "Failed to resend OTP");
    }

    return data;
  },
};

// Document API
export const documentAPI = {
  uploadDocument: async (file, documentType, documentName, token, issuedAt) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    if (documentName && documentName.trim()) {
      formData.append("documentName", documentName.trim());
    }
    if (issuedAt) {
      formData.append("issuedAt", issuedAt);
    }

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to upload document");
    }

    return response.json();
  },

  getDocuments: async (documentType, token) => {
    const params = documentType ? `?documentType=${documentType}` : "";
    const response = await fetch(`${API_BASE_URL}/documents${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch documents");
    }

    return response.json();
  },

  getDocumentsQuery: async (query, token) => {
    const params = new URLSearchParams();

    if (query?.documentType && query.documentType !== "ALL") {
      params.set("documentType", query.documentType);
    }
    if (query?.q) params.set("q", query.q);
    if (query?.uploadedFrom) params.set("uploadedFrom", query.uploadedFrom);
    if (query?.uploadedTo) params.set("uploadedTo", query.uploadedTo);
    if (query?.issuedFrom) params.set("issuedFrom", query.issuedFrom);
    if (query?.issuedTo) params.set("issuedTo", query.issuedTo);

    params.set("page", String(query?.page ?? 0));
    params.set("size", String(query?.size ?? 20));
    params.set("sortField", query?.sortField || "uploadedAt");
    params.set("sortOrder", query?.sortOrder || "desc");

    const response = await fetch(
      `${API_BASE_URL}/documents/query?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch documents");
    }

    return response.json();
  },

  getStorageInfo: async (token) => {
    const response = await fetch(`${API_BASE_URL}/documents/storage-info`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch storage info");
    }

    return response.json();
  },

  deleteDocument: async (documentId, token) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to delete document");
    }

    return response.json();
  },

  getDownloadUrl: async (documentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/documents/${documentId}/download-url`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      let errorMessage = "Failed to get download URL";
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        console.error("Error parsing error response:", e);
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  getDocumentContent: async (documentId, token, { download = false } = {}) => {
    const response = await fetch(
      `${API_BASE_URL}/documents/${documentId}/content?download=${download ? "true" : "false"}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to load document content");
    }

    const contentTypeHeader = response.headers.get("content-type") || "";
    const contentDisposition =
      response.headers.get("content-disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const fileName = fileNameMatch?.[1] || `document-${documentId}`;
    const blob = await response.blob();

    if (!blob || blob.size === 0) {
      throw new Error("Document is empty or unavailable");
    }

    return {
      blob,
      fileName,
      contentType: contentTypeHeader || blob.type,
    };
  },

  updateDocumentMetadata: async (documentId, payload, token) => {
    const response = await fetch(
      `${API_BASE_URL}/documents/${documentId}/metadata`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload || {}),
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to update document metadata");
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return null;
  },
};

export const apiClient = {
  get: async (endpoint, token) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized. Please login again.");
      } else if (response.status === 403) {
        throw new Error("You do not have permission to access this resource.");
      }
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },

  post: async (endpoint, data, token) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized. Please login again.");
      } else if (response.status === 403) {
        throw new Error("You do not have permission to perform this action.");
      }
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },

  put: async (endpoint, data, token) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized. Please login again.");
      } else if (response.status === 403) {
        throw new Error("You do not have permission to perform this action.");
      }
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },

  delete: async (endpoint, token) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized. Please login again.");
      } else if (response.status === 403) {
        throw new Error("You do not have permission to perform this action.");
      }
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },

  patch: async (endpoint, data, token) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized. Please login again.");
      } else if (response.status === 403) {
        throw new Error("You do not have permission to perform this action.");
      }
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },
};

// Admin API
export const adminAPI = {
  normalizeReportArgs: (dateOrToken, tokenOrDoctorId, maybeDoctorId) => {
    // Backward compatibility: allow getDailyReport(token) while supporting getDailyReport(date, token, doctorId).
    const looksLikeJwt =
      typeof dateOrToken === "string" &&
      dateOrToken.split(".").length === 3 &&
      !tokenOrDoctorId;

    if (looksLikeJwt) {
      return { date: null, token: dateOrToken, doctorId: undefined };
    }

    return {
      date: dateOrToken,
      token: tokenOrDoctorId,
      doctorId: maybeDoctorId,
    };
  },

  createAdmin: async (adminData, token) => {
    const response = await fetch(`${API_BASE_URL}/admin/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(adminData),
    });

    if (!response.ok) {
      throw await parseApiError(response, "Failed to create admin");
    }

    return response.json();
  },

  getAllUsers: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }

    return response.json();
  },

  toggleUserStatus: async (userId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/admin/users/${userId}/toggle-status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to update user status");
    }

    return data;
  },

  deleteUser: async (userId, token) => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to delete user");
    }

    return data;
  },

  getAllAppointments: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/appointments`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch appointments");
    }

    return response.json();
  },

  getAllPayments: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/payments`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }

    return response.json();
  },

  getDailyReport: async (dateOrToken, tokenOrDoctorId, maybeDoctorId) => {
    const { date, token, doctorId } = adminAPI.normalizeReportArgs(
      dateOrToken,
      tokenOrDoctorId,
      maybeDoctorId,
    );

    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (doctorId != null && doctorId !== "") params.set("doctorId", doctorId);

    const query = params.toString();
    const response = await fetch(
      `${API_BASE_URL}/admin/reports/daily${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch daily report");
    }

    return response.json();
  },

  getDailyReportPdf: async (dateOrToken, tokenOrDoctorId, maybeDoctorId) => {
    const { date, token, doctorId } = adminAPI.normalizeReportArgs(
      dateOrToken,
      tokenOrDoctorId,
      maybeDoctorId,
    );

    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (doctorId != null && doctorId !== "") params.set("doctorId", doctorId);

    const query = params.toString();
    const response = await fetch(
      `${API_BASE_URL}/admin/reports/daily/pdf${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to generate report PDF");
    }

    return response.blob();
  },
};

// Change password API
export const passwordAPI = {
  changePassword: async (passwordData, token) => {
    const response = await fetch(`${API_BASE_URL}/profile/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(passwordData),
    });

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to change password");
    }

    return data;
  },

  initiateChangePasswordOtp: async (token) => {
    const response = await fetch(
      `${API_BASE_URL}/profile/initiate-password-change`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to send OTP");
    }

    return data;
  },

  changePasswordWithOtp: async (passwordData, token) => {
    const response = await fetch(
      `${API_BASE_URL}/profile/change-password-with-otp`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwordData),
      },
    );

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to change password");
    }

    return data;
  },
};

// Doctor/Assistant management API
export const doctorAssistantAPI = {
  getAssistants: async (token) => {
    const response = await fetch(`${API_BASE_URL}/doctor/assistants`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch assistants");
    }

    return response.json();
  },

  createAssistant: async (assistantData, token) => {
    const response = await fetch(`${API_BASE_URL}/doctor/assistants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(assistantData),
    });

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to add assistant");
    }

    return data;
  },

  toggleAssistantStatus: async (assistantId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/doctor/assistants/${assistantId}/toggle-status`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to toggle assistant status");
    }

    return response.json();
  },

  deleteAssistant: async (assistantId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/doctor/assistants/${assistantId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete assistant");
    }

    return response.json();
  },
};

export const doctorAPI = {
  getAllDoctors: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/doctors`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch doctors");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  deleteDoctor: async (doctorId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/doctors/${doctorId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to delete doctor");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  toggleDoctorStatus: async (doctorId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/doctors/${doctorId}/toggle-status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to toggle doctor status");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  addDoctor: async (doctorData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/doctors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(doctorData),
      });

      if (!response.ok) {
        throw await parseApiError(response, "Failed to add doctor");
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },
};

// Complaint API
export const complaintAPI = {
  submitComplaint: async (title, message, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/complaints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, message }),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to submit complaint");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  getMyComplaints: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/my`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch complaints");
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  getAllComplaints: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/complaints`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch complaints");
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  getStats: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch complaint stats");
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  markReviewed: async (complaintId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/complaints/${complaintId}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(
            error.message || "Failed to mark complaint as reviewed",
          );
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  deleteComplaint: async (complaintId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/complaints/${complaintId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to delete complaint");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },
};

export const scheduleAPI = {
  getSchedule: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/doctor/schedule`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch schedule");
      }

      return response.json();
    } catch (error) {
      console.error("Error fetching schedule:", error);
      throw error;
    }
  },

  addWeeklySchedule: async (scheduleData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/doctor/schedule/weekly`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        throw new Error("Failed to add weekly schedule");
      }

      return response.json();
    } catch (error) {
      console.error("Error adding weekly schedule:", error);
      throw error;
    }
  },

  updateWeeklyScheduleAvailability: async (
    weeklyScheduleId,
    isAvailable,
    token,
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/doctor/schedule/weekly/${weeklyScheduleId}?isAvailable=${isAvailable}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update weekly schedule availability");
      }

      return response.json();
    } catch (error) {
      console.error("Error updating weekly schedule availability:", error);
      throw error;
    }
  },

  deleteWeeklySchedule: async (weeklyScheduleId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/doctor/schedule/weekly/${weeklyScheduleId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete weekly schedule");
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response.text();
    } catch (error) {
      console.error("Error deleting weekly schedule:", error);
      throw error;
    }
  },

  addScheduleOverride: async (overrideData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/doctor/schedule/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(overrideData),
      });

      if (!response.ok) {
        throw new Error("Failed to add schedule override");
      }

      return response.json();
    } catch (error) {
      console.error("Error adding schedule override:", error);
      throw error;
    }
  },

  deleteScheduleOverride: async (overrideId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/doctor/schedule/override/${overrideId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete schedule override");
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response.text();
    } catch (error) {
      console.error("Error deleting schedule override:", error);
      throw error;
    }
  },

  getScheduleOverrides: async (doctorId, startDate, endDate, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/doctor/schedule/${doctorId}/overrides?startDate=${startDate}&endDate=${endDate}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch schedule overrides");
      }

      return response.json();
    } catch (error) {
      console.error("Error fetching schedule overrides:", error);
      throw error;
    }
  },
};

export const patientAPI = {
  getActiveDoctors: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/patient/doctors`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch doctors");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  getDoctorById: async (doctorId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/patient/doctors/${doctorId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch doctor details");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  getDoctorSchedule: async (doctorId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/patient/doctors/${doctorId}/schedule`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch doctor schedule");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  getAiDoctorSuggestions: async (payload, token) => {
    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const normalizedPayload =
        typeof payload === "string" ? { symptoms: payload } : payload || {};

      const response = await fetch(
        `${LAB_ANALYTICS_BASE_URL}/patient/ai-health-checker/suggestions`,
        {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            symptoms: normalizedPayload.symptoms || "",
            conversation: Array.isArray(normalizedPayload.conversation)
              ? normalizedPayload.conversation
              : [],
            sessionId: normalizedPayload.sessionId || null,
            mode: normalizedPayload.mode || "auto",
          }),
        },
      );

      if (!response.ok) {
        const error = await parseApiError(
          response,
          "Failed to get AI doctor suggestions",
        );
        throw error;
      }

      const result = await response.json();

      const confidenceScore = Number(
        result?.confidence ?? result?.confidence_score,
      );
      const confidencePercent = Number.isFinite(confidenceScore)
        ? confidenceScore <= 1
          ? Math.max(1, Math.min(100, Math.round(confidenceScore * 100)))
          : Math.max(1, Math.min(100, Math.round(confidenceScore)))
        : 60;

      const isNeedsReview = Boolean(result?.needsMoreInfo);
      const warning =
        typeof result?.nextQuestion === "string"
          ? result.nextQuestion.trim()
          : typeof result?.escalation_warning === "string"
            ? result.escalation_warning.trim()
            : "";
      const reasoning =
        typeof result?.assistantMessage === "string"
          ? result.assistantMessage.trim()
          : typeof result?.reasoning === "string"
            ? result.reasoning.trim()
            : "";
      const assistantMessage = [reasoning, warning].filter(Boolean).join(" ");
      const doctors = Array.isArray(result?.doctors) ? result.doctors : [];

      return {
        field:
          result?.field || result?.suggested_specialty || "General Medicine",
        confidence: confidencePercent,
        experience: result?.experience || "4+ years",
        related: [],
        doctors,
        source: result?.source || "triage-api",
        needsMoreInfo: isNeedsReview,
        answerAccepted: true,
        nextQuestion: isNeedsReview
          ? warning || "Please consult a licensed medical professional."
          : null,
        questionType: isNeedsReview ? "FOLLOW_UP" : null,
        assistantMessage: assistantMessage || "Triage completed.",
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("AI triage timed out. Please try again.");
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },

  getAiDoctorStatus: async () => {
    try {
      const response = await fetch(
        `${LAB_ANALYTICS_BASE_URL}/patient/ai-health-checker/status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const error = await parseApiError(
          response,
          "Failed to get AI engine status",
        );
        throw error;
      }

      const health = await response.json();
      const available = health?.status === "ok";

      return {
        provider: "triage-api",
        model: "cloud-llm",
        endpoint: `${LAB_ANALYTICS_BASE_URL}/triage`,
        available,
        activeSource: available ? "triage-api" : "unavailable",
        fallbackEnabled: true,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },
};

export const publicAPI = {
  getDoctorsBrief: async () => {
    const response = await fetch(`${API_BASE_URL}/public/doctors`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch doctors");
    }

    return response.json();
  },

  getDoctorProfile: async (doctorId) => {
    const response = await fetch(`${API_BASE_URL}/public/doctors/${doctorId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch doctor profile");
    }

    return response.json();
  },

  getDoctorSchedule: async (doctorId) => {
    const response = await fetch(
      `${API_BASE_URL}/public/doctors/${doctorId}/schedule`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch doctor schedule");
    }

    return response.json();
  },

  getDoctorReviews: async (doctorId) => {
    const response = await fetch(
      `${API_BASE_URL}/public/doctors/${doctorId}/reviews`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch doctor reviews");
    }

    return response.json();
  },
};

export const profileAPI = {
  getProfile: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch profile");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },

  updateProfile: async (profileData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || "Failed to update profile");
        } catch {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      return response.json();
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        "Network error: Unable to connect to server. Please ensure the backend is running.",
      );
    }
  },
};

export const appointmentAPI = {
  // Get patient's appointments
  getPatientAppointments: async (token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/patient/my-appointments`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        const err = new Error(error.message || "Failed to fetch appointments");
        err.status = response.status;
        throw err;
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Get doctor's appointments
  getDoctorAppointments: async (token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/doctor/my-appointments`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch appointments");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Book a new appointment
  bookAppointment: async (appointmentData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/appointments/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        throw await parseApiError(response, "Failed to book appointment");
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Initiate payment for an existing appointment (patient)
  initiatePayment: async (appointmentId, clientOrigin, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/pay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ clientOrigin }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate payment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Cancel an appointment
  cancelAppointment: async (appointmentId, reason, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/cancel`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel appointment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Get available time slots for a doctor on a specific date
  getAvailableTimeSlots: async (doctorId, date, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/available-slots?doctorId=${doctorId}&date=${date}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch available slots");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Confirm an appointment (doctor only)
  confirmAppointment: async (appointmentId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/confirm`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to confirm appointment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Confirm payment for an appointment (doctor only)
  confirmPayment: async (appointmentId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/confirm-payment`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to confirm payment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Reject an appointment (doctor only)
  rejectAppointment: async (appointmentId, reason, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject appointment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  getAppointmentMessages: async (appointmentId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/messages`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw await parseApiError(
          response,
          "Failed to load consultation messages",
        );
      }

      return response.json();
    } catch (error) {
      if (error?.message) throw error;
      const networkError = new Error(
        "Network error: Unable to connect to server.",
      );
      networkError.status = 0;
      throw networkError;
    }
  },

  sendAppointmentMessage: async (appointmentId, text, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) {
        throw await parseApiError(
          response,
          "Failed to send consultation message",
        );
      }

      return response.json();
    } catch (error) {
      if (error?.message) throw error;
      const networkError = new Error(
        "Network error: Unable to connect to server.",
      );
      networkError.status = 0;
      throw networkError;
    }
  },

  grantDocumentAccess: async (
    appointmentId,
    durationMinutes,
    selectedDocumentIds,
    token,
    options = {},
  ) => {
    const { shareHealthAnalysis = false } = options;
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/document-access/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          durationMinutes,
          selectedDocumentIds,
          shareHealthAnalysis,
        }),
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to grant document access");
    }

    return response.json();
  },

  revokeDocumentAccess: async (appointmentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/document-access/revoke`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to revoke document access");
    }

    return response.json();
  },

  getPatientDocumentAccessList: async (token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/patient/document-access`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(
        response,
        "Failed to load patient document access list",
      );
    }

    return response.json();
  },

  getPatientAccessStatusForDoctor: async (appointmentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/patient/access-status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to load access status");
    }

    return response.json();
  },

  getPatientDocumentsForDoctor: async (appointmentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/patient/documents`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to load patient documents");
    }

    const payload = await response.json();
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.documents)
        ? payload.documents
        : [];

    return list.map((doc) => {
      const downloadUrl =
        doc?.downloadUrl ||
        doc?.url ||
        doc?.fileUrl ||
        doc?.signedUrl ||
        doc?.presignedUrl ||
        doc?.accessUrl ||
        null;

      return {
        ...doc,
        downloadUrl,
      };
    });
  },

  openPatientDocumentForDoctor: async (appointmentId, documentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/patient/documents/${documentId}/open`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to open patient document");
    }

    const contentTypeHeader = response.headers.get("content-type") || "";
    const blob = await response.blob();

    if (contentTypeHeader.includes("application/json")) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed?.message || "Failed to open patient document");
      } catch (err) {
        if (err instanceof Error) throw err;
        throw new Error("Failed to open patient document");
      }
    }

    if (!blob || blob.size === 0) {
      throw new Error("Document is empty or unavailable");
    }

    const contentDisposition =
      response.headers.get("content-disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const fileName = fileNameMatch?.[1] || `document-${documentId}`;

    return {
      blob,
      fileName,
      contentType: contentTypeHeader || blob.type,
    };
  },

  createPrescription: async (appointmentId, payload, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/prescription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to create prescription");
    }

    return response.json();
  },

  previewPrescriptionPdf: async (appointmentId, payload, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/prescription/preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to preview prescription PDF");
    }

    return response.blob();
  },

  getPrescription: async (appointmentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${appointmentId}/prescription`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response, "Failed to load prescription");
    }

    return response.json();
  },

  submitRating: async (appointmentId, rating, reviewText, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/rate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, reviewText }),
        },
      );

      if (!response.ok) {
        const error = await parseApiError(response, "Failed to submit rating");
        throw error;
      }

      return response.json();
    } catch (error) {
      if (error?.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },
};

export const notificationAPI = {
  // Get all user notifications
  getAllNotifications: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch notifications");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Get unread notifications
  getUnreadNotifications: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/unread`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || "Failed to fetch unread notifications",
        );
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Get unread notification count
  getUnreadCount: async (token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/notifications/unread/count`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        const err = new Error(error.message || "Failed to fetch unread count");
        err.status = response.status;
        throw err;
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Mark a notification as read
  markAsRead: async (notificationId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark notification as read");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark all as read");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },
};

export const assistantAPI = {
  // Get doctor's appointments (for assistant)
  getDoctorAppointments: async (token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/list`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to retrieve appointments");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Create appointment
  createAppointment: async (appointmentData, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(appointmentData),
        },
      );

      if (!response.ok) {
        throw await parseApiError(response, "Failed to create appointment");
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Confirm appointment
  confirmAppointment: async (appointmentId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/${appointmentId}/confirm`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to confirm appointment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Confirm payment
  confirmPayment: async (appointmentId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/${appointmentId}/confirm-payment`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to confirm payment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Reject appointment
  rejectAppointment: async (appointmentId, reason, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/${appointmentId}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject appointment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Cancel in-person appointment
  cancelInPersonAppointment: async (appointmentId, reason, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/${appointmentId}/cancel`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel appointment");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Mark appointment as completed
  markAsCompleted: async (appointmentId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/appointments/${appointmentId}/complete`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark as completed");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Get doctor's schedule
  getDoctorSchedule: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/assistant/schedule`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to retrieve schedule");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Add weekly schedule
  addWeeklySchedule: async (scheduleData, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/schedule/weekly`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(scheduleData),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add schedule");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Toggle weekly schedule availability
  toggleWeeklySchedule: async (weeklyScheduleId, isAvailable, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/schedule/weekly/${weeklyScheduleId}/toggle`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isAvailable }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update schedule");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Delete weekly schedule
  deleteWeeklySchedule: async (weeklyScheduleId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/schedule/weekly/${weeklyScheduleId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete schedule");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Add or update schedule override
  addScheduleOverride: async (overrideData, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/schedule/override`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(overrideData),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add schedule override");
      }

      return response.json();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },

  // Delete schedule override
  deleteScheduleOverride: async (overrideId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/schedule/override/${overrideId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete schedule override");
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response.text();
    } catch (error) {
      if (error.message) throw error;
      throw new Error("Network error: Unable to connect to server.");
    }
  },
};

export const queueAPI = {
  getQueueState: async (doctorId, date, token) => {
    const response = await fetch(`${API_BASE_URL}/queue/${doctorId}/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch queue");
    return response.json();
  },

  getTodayQueue: async (token) => {
    const response = await fetch(`${API_BASE_URL}/queue/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch today queue");
    return response.json();
  },

  getAssistantTodayQueue: async (token) => {
    const response = await fetch(`${API_BASE_URL}/queue/assistant/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch queue");
    return response.json();
  },

  startQueue: async (doctorId, date, token) => {
    const response = await fetch(
      `${API_BASE_URL}/queue/${doctorId}/${date}/start`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error("Failed to start queue");
    return response.json();
  },

  callNext: async (doctorId, date, token) => {
    const response = await fetch(
      `${API_BASE_URL}/queue/${doctorId}/${date}/next`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error("Failed to call next");
    return response.json();
  },

  setDelay: async (doctorId, date, delayMinutes, token) => {
    const response = await fetch(
      `${API_BASE_URL}/queue/${doctorId}/${date}/delay`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ delayMinutes }),
      },
    );
    if (!response.ok) throw new Error("Failed to set delay");
    return response.json();
  },

  skipPatient: async (appointmentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/queue/skip/${appointmentId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error("Failed to skip patient");
    return response.json();
  },

  markCompleted: async (appointmentId, token) => {
    const response = await fetch(
      `${API_BASE_URL}/queue/complete/${appointmentId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error("Failed to mark complete");
    return response.json();
  },

  getPatientQueueView: async (doctorId, date, token) => {
    const response = await fetch(
      `${API_BASE_URL}/queue/patient/${doctorId}/${date}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Failed to fetch queue");
    return response.json();
  },
};

// Lab Analytics API (separate Python FastAPI service)
const LAB_ANALYTICS_BASE_URL =
  import.meta.env.VITE_LAB_ANALYTICS_URL || `${window.location.origin}/api/v1`;

export const labAnalyticsAPI = {
  uploadReport: async (patientId, file, reportedAt = null) => {
    const formData = new FormData();
    formData.append("file", file);
    if (reportedAt) {
      const normalizedReportedAt = (() => {
        if (reportedAt instanceof Date) {
          return reportedAt.toISOString();
        }

        if (typeof reportedAt === "string") {
          const trimmed = reportedAt.trim();
          if (!trimmed) return null;

          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return `${trimmed}T00:00:00Z`;
          }

          return trimmed;
        }

        return null;
      })();

      if (normalizedReportedAt) {
        formData.append("reported_at", normalizedReportedAt);
      }
    }

    const response = await fetch(
      `${LAB_ANALYTICS_BASE_URL}/patients/${patientId}/reports/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload report");
    }

    return response.json();
  },

  getTrends: async (
    patientId,
    metric = null,
    fromDate = null,
    toDate = null,
    token = null,
  ) => {
    let url = `${LAB_ANALYTICS_BASE_URL}/patients/${patientId}/trends`;
    const params = new URLSearchParams();

    if (metric) params.append("metric", metric);
    if (fromDate) params.append("from_date", fromDate.toISOString());
    if (toDate) params.append("to_date", toDate.toISOString());

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const headers = token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined;

    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch trends");
    }

    return response.json();
  },

  addManualMeasurement: async (patientId, payload) => {
    const response = await fetch(
      `${LAB_ANALYTICS_BASE_URL}/patients/${patientId}/measurements/manual`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to add manual measurement");
    }

    return response.json();
  },

  getMeasurements: async (patientId) => {
    const response = await fetch(
      `${LAB_ANALYTICS_BASE_URL}/patients/${patientId}/measurements`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch measurements");
    }

    return response.json();
  },

  deleteMeasurement: async (patientId, measurementId) => {
    const response = await fetch(
      `${LAB_ANALYTICS_BASE_URL}/patients/${patientId}/measurements/${measurementId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete measurement");
    }

    return response.json();
  },

  updateMeasurement: async (patientId, measurementId, payload) => {
    const response = await fetch(
      `${LAB_ANALYTICS_BASE_URL}/patients/${patientId}/measurements/${measurementId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update measurement");
    }

    return response.json();
  },
};

// Backward-compatible helpers used by legacy page imports.
export const apiRequest = async (endpoint, options = {}) => {
  const { method = "GET", body, headers = {}, token } = options;

  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
};

export const getPublicStats = async () => {
  return apiRequest("/public/stats");
};
