import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import DashboardLayout from "../components/DashboardLayout";
import {
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Settings,
} from "lucide-react";
import { profileAPI, passwordAPI } from "../utils/api";
import { useToast } from "../components/ToastProvider";
import { useLocation } from "react-router-dom";
import AvatarCircle from "../components/AvatarCircle";
import { resolveProfileImageUrl } from "../utils/profileImage";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const resizeImageToDataUrl = (file, maxDimension = 512) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.width, image.height),
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to process selected image."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.onerror = () => reject(new Error("Failed to load selected image."));
      image.src = reader.result;
    };
    reader.onerror = () =>
      reject(new Error("Failed to read selected image file."));
    reader.readAsDataURL(file);
  });

const buildFormData = (data) => {
  if (!data) return {};

  const baseData = {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || "",
    phoneNumber: data.phoneNumber || "",
  };

  if (data.role === "doctor" || data.role === "DOCTOR") {
    return {
      ...baseData,
      specialization: data.specialization || "",
      yearOfExperience: data.yearOfExperience || "",
      location: data.location || "",
      consultationFee: data.consultationFee || "",
      qualifications: data.qualifications || "",
      languages: data.languages || "",
      hospitalAffiliation: data.hospitalAffiliation || "",
      about: data.about || "",
    };
  }

  if (data.role === "patient" || data.role === "PATIENT") {
    return {
      ...baseData,
      dateOfBirth: data.dateOfBirth || "",
      gender: data.gender || "",
      weight: data.weight || "",
      height: data.height || "",
      bloodGroup: data.bloodGroup || "",
      condition: data.condition || "",
      emergencyContacts: Array.isArray(data.emergencyContacts)
        ? data.emergencyContacts.map((contact) => ({
            name: contact?.name || "",
            phone: contact?.phone || "",
            relation: contact?.relation || "",
          }))
        : [],
    };
  }

  return baseData;
};

const getSectionTabsByRole = (role) => {
  if (role === "PATIENT") {
    return [
      { key: "personal", label: "Personal Info" },
      { key: "emergency", label: "Emergency Contact" },
      { key: "medical", label: "Medical Info" },
      { key: "security", label: "Security" },
    ];
  }

  if (role === "DOCTOR") {
    return [
      { key: "personal", label: "Personal Info" },
      { key: "professional", label: "Professional Info" },
      { key: "security", label: "Security" },
    ];
  }

  if (role === "ASSISTANT") {
    return [
      { key: "personal", label: "Personal Info" },
      { key: "assistant-work", label: "Work Profile" },
      { key: "security", label: "Security" },
    ];
  }

  if (role === "ADMIN") {
    return [
      { key: "personal", label: "Personal Info" },
      { key: "security", label: "Security" },
    ];
  }

  return [
    { key: "personal", label: "Personal Info" },
    { key: "security", label: "Security" },
  ];
};

const SUPPORTED_PROFILE_ROLES = new Set([
  "PATIENT",
  "DOCTOR",
  "ASSISTANT",
  "ADMIN",
]);

const normalizeRole = (role) => {
  const normalized = (role || "").toUpperCase();
  return SUPPORTED_PROFILE_ROLES.has(normalized) ? normalized : "UNKNOWN";
};

const Profile = () => {
  const { updateUser, token, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({});
  const [activeSection, setActiveSection] = useState("personal");
  const [editingSection, setEditingSection] = useState(null);
  const [sectionErrors, setSectionErrors] = useState({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordOtpRequested, setPasswordOtpRequested] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const handledProfileSearchRef = useRef("");
  const profileImageInputRef = useRef(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileAPI.getProfile(token);
      setProfileData(data);
      setFormData(buildFormData(data));
    } catch (err) {
      setError(err.message || "Failed to load profile");
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const role = normalizeRole(profileData?.role);
  const hasUnknownRole = role === "UNKNOWN";

  const displayName =
    `${profileData?.firstName || ""} ${profileData?.lastName || ""}`.trim() ||
    profileData?.fullName ||
    profileData?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.fullName ||
    user?.name ||
    "User Name";

  const headerName =
    displayName && displayName.trim() !== ""
      ? displayName
      : (profileData?.email || user?.email || "")
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .trim() || "User Name";

  const hasProfileImage = Boolean(resolveProfileImageUrl(profileData || user));

  const sectionTabs = useMemo(() => getSectionTabsByRole(role), [role]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-section-switcher")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (sectionTabs.length === 0) return;
    const isValidSection = sectionTabs.some((tab) => tab.key === activeSection);
    if (!isValidSection) {
      setActiveSection(sectionTabs[0].key);
      setEditingSection(null);
    }
  }, [role, activeSection, sectionTabs]);

  useEffect(() => {
    if (!profileData || sectionTabs.length === 0) return;

    const searchKey = location.search || "";
    if (handledProfileSearchRef.current === searchKey) return;

    const params = new URLSearchParams(searchKey);
    const targetSection = params.get("section");
    const shouldEdit = params.get("edit") === "1";
    const focusField = params.get("focus");

    if (!targetSection) {
      handledProfileSearchRef.current = searchKey;
      return;
    }

    const isValidTarget = sectionTabs.some((tab) => tab.key === targetSection);
    if (!isValidTarget) {
      handledProfileSearchRef.current = searchKey;
      return;
    }

    if (activeSection !== targetSection) {
      setActiveSection(targetSection);
    }

    if (shouldEdit && targetSection !== "security") {
      setEditingSection(targetSection);
      setSectionErrors({});
      setFormData(buildFormData(profileData));
    }

    if (shouldEdit && focusField) {
      window.setTimeout(() => {
        const input = document.querySelector(`input[name="${focusField}"]`);
        if (input && typeof input.focus === "function") {
          input.focus();
          if (typeof input.select === "function") {
            input.select();
          }
        }
      }, 120);
    }
    handledProfileSearchRef.current = searchKey;
  }, [location.search, profileData, sectionTabs, activeSection]);

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age -= 1;
    }

    return age;
  };

  const startSectionEdit = (sectionKey) => {
    setEditingSection(sectionKey);
    setSectionErrors({});
    setFormData(buildFormData(profileData));
  };

  const cancelSectionEdit = () => {
    setEditingSection(null);
    setSectionErrors({});
    setFormData(buildFormData(profileData));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (sectionErrors[name]) {
      setSectionErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (passwordErrors[name]) {
      setPasswordErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validatePasswordData = () => {
    const errors = {};

    if (!passwordOtpRequested) {
      return errors;
    }

    if (!/^\d{6}$/.test(passwordData.otp || "")) {
      errors.otp = "Enter the 6-digit OTP sent to your email";
    }

    if (!passwordData.newPassword) {
      errors.newPassword = "New password is required";
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    return errors;
  };

  const resetPasswordForm = () => {
    setPasswordData({
      otp: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordErrors({});
    setPasswordOtpRequested(false);
    setShowPasswords({
      new: false,
      confirm: false,
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!passwordOtpRequested) {
      setPasswordLoading(true);
      try {
        await passwordAPI.initiateChangePasswordOtp(token);
        setPasswordOtpRequested(true);
        setPasswordErrors({});
        toast.success("OTP sent to your email address.");
      } catch (err) {
        toast.error(err.message || "Failed to send OTP");
      } finally {
        setPasswordLoading(false);
      }
      return;
    }

    const errors = validatePasswordData();
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setPasswordLoading(true);
    try {
      await passwordAPI.changePasswordWithOtp(
        {
          otp: passwordData.otp,
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword,
        },
        token,
      );
      toast.success("Password changed successfully!");
      resetPasswordForm();
      await fetchProfile();
    } catch (err) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const markEmergencyDirty = () => {
    if (editingSection !== "emergency") {
      setEditingSection("emergency");
    }
  };

  const handleEmergencyContactChange = (index, field, value) => {
    markEmergencyDirty();
    setFormData((prev) => {
      const updatedContacts = [...(prev.emergencyContacts || [])];
      updatedContacts[index] = {
        ...updatedContacts[index],
        [field]: value,
      };

      return {
        ...prev,
        emergencyContacts: updatedContacts,
      };
    });

    if (sectionErrors.emergencyContacts) {
      setSectionErrors((prev) => {
        const next = { ...prev };
        delete next.emergencyContacts;
        return next;
      });
    }
  };

  const handleAddEmergencyContact = () => {
    markEmergencyDirty();
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: [
        ...(prev.emergencyContacts || []),
        { name: "", phone: "", relation: "" },
      ],
    }));

    if (sectionErrors.emergencyContacts) {
      setSectionErrors((prev) => {
        const next = { ...prev };
        delete next.emergencyContacts;
        return next;
      });
    }
  };

  const handleRemoveEmergencyContact = (index) => {
    markEmergencyDirty();
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: (prev.emergencyContacts || []).filter(
        (_, contactIndex) => contactIndex !== index,
      ),
    }));

    if (sectionErrors.emergencyContacts) {
      setSectionErrors((prev) => {
        const next = { ...prev };
        delete next.emergencyContacts;
        return next;
      });
    }
  };

  const buildSectionPayload = (sectionKey) => {
    if (sectionKey === "personal") {
      const payload = {
        firstName: (formData.firstName || "").trim(),
        lastName: (formData.lastName || "").trim(),
        phoneNumber: (formData.phoneNumber || "").trim(),
      };

      if (role === "PATIENT") {
        payload.dateOfBirth = formData.dateOfBirth || null;
        payload.gender = formData.gender || null;
      }

      return payload;
    }

    if (sectionKey === "emergency") {
      const contacts = Array.isArray(formData.emergencyContacts)
        ? formData.emergencyContacts
        : [];

      return {
        emergencyContacts: contacts
          .filter(
            (contact) =>
              (contact?.name || "").trim() !== "" ||
              (contact?.phone || "").trim() !== "" ||
              (contact?.relation || "").trim() !== "",
          )
          .map((contact) => ({
            name: (contact.name || "").trim(),
            phone: (contact.phone || "").trim(),
            relation: (contact.relation || "").trim() || null,
          })),
      };
    }

    if (sectionKey === "medical") {
      return {
        weight: formData.weight || null,
        height: formData.height || null,
        bloodGroup: formData.bloodGroup || null,
        condition: (formData.condition || "").trim() || null,
      };
    }

    if (sectionKey === "professional") {
      return {
        specialization: (formData.specialization || "").trim() || null,
        yearOfExperience: formData.yearOfExperience || null,
        location: (formData.location || "").trim() || null,
        consultationFee: formData.consultationFee || null,
        qualifications: (formData.qualifications || "").trim() || null,
        languages: (formData.languages || "").trim() || null,
        hospitalAffiliation:
          (formData.hospitalAffiliation || "").trim() || null,
        about: (formData.about || "").trim() || null,
      };
    }

    return {};
  };

  const validateSectionData = (sectionKey, payload) => {
    const errors = {};

    if (sectionKey === "personal") {
      if (!payload.firstName) {
        errors.firstName = "First name is required";
      }

      if (!payload.lastName) {
        errors.lastName = "Last name is required";
      }

      if (!payload.phoneNumber) {
        errors.phoneNumber = "Phone number is required";
      } else if (!/^[+]?[0-9\s()-]{7,20}$/.test(payload.phoneNumber)) {
        errors.phoneNumber = "Enter a valid phone number";
      }

      if (role === "PATIENT" && payload.dateOfBirth) {
        const selectedDob = new Date(payload.dateOfBirth);
        const now = new Date();
        if (!Number.isNaN(selectedDob.getTime()) && selectedDob > now) {
          errors.dateOfBirth = "Date of birth cannot be in the future";
        }
      }
    }

    if (sectionKey === "emergency") {
      const contacts = payload.emergencyContacts || [];
      const hasIncompleteContacts = contacts.some(
        (contact) => !contact.name || !contact.phone,
      );

      if (hasIncompleteContacts) {
        errors.emergencyContacts =
          "Each emergency contact must include both name and phone number.";
      }
    }

    if (sectionKey === "medical") {
      if (payload.weight != null && payload.weight !== "") {
        const weight = Number(payload.weight);
        if (Number.isNaN(weight) || weight <= 0) {
          errors.weight = "Weight must be a number greater than 0";
        }
      }

      if (payload.height != null && payload.height !== "") {
        const height = Number(payload.height);
        if (Number.isNaN(height) || height <= 0) {
          errors.height = "Height must be a number greater than 0";
        }
      }
    }

    if (sectionKey === "professional") {
      if (!payload.specialization) {
        errors.specialization = "Specialization is required";
      }

      if (payload.yearOfExperience != null && payload.yearOfExperience !== "") {
        const years = Number(payload.yearOfExperience);
        if (Number.isNaN(years) || years < 0) {
          errors.yearOfExperience =
            "Years of experience must be a valid non-negative number";
        }
      }

      if (payload.consultationFee != null && payload.consultationFee !== "") {
        const fee = Number(payload.consultationFee);
        if (Number.isNaN(fee) || fee < 0) {
          errors.consultationFee =
            "Consultation fee must be a valid non-negative number";
        }
      }

      if (payload.about && payload.about.length > 2000) {
        errors.about = "About section must be within 2000 characters";
      }
    }

    return errors;
  };

  const handleSaveSection = async (sectionKey) => {
    try {
      const payload = buildSectionPayload(sectionKey);
      const errors = validateSectionData(sectionKey, payload);
      setSectionErrors(errors);

      if (Object.keys(errors).length > 0) {
        toast.error("Please fix the highlighted fields and try again.");
        return;
      }

      const updatedProfile = await profileAPI.updateProfile(payload, token);
      setProfileData(updatedProfile);
      setFormData(buildFormData(updatedProfile));
      setSectionErrors({});
      updateUser(updatedProfile);
      setEditingSection(null);

      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
      console.error("Error updating profile:", err);
    }
  };

  const updateProfileImage = async (nextProfileImageUrl, successMessage) => {
    try {
      setAvatarUploading(true);
      const updatedProfile = await profileAPI.updateProfile(
        { profileImageUrl: nextProfileImageUrl },
        token,
      );
      setProfileData(updatedProfile);
      setFormData(buildFormData(updatedProfile));
      updateUser(updatedProfile);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.message || "Failed to update profile image");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file.");
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      toast.error("Profile image must be 5MB or smaller.");
      return;
    }

    try {
      const optimizedImageDataUrl = await resizeImageToDataUrl(file);
      await updateProfileImage(optimizedImageDataUrl, "Profile photo updated.");
    } catch (err) {
      toast.error(err.message || "Failed to process profile image.");
    }
  };

  const handleRemoveProfileImage = async () => {
    await updateProfileImage("", "Profile photo removed.");
  };

  const renderField = (
    label,
    name,
    type = "text",
    editable = false,
    readOnly = false,
  ) => (
    <div className="flex flex-col">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      {editable && !readOnly ? (
        <input
          type={type}
          name={name}
          value={formData[name] || ""}
          onChange={handleChange}
          className={`px-3 py-2.5 border rounded-md focus:ring-2 transition-colors bg-white text-gray-900 ${
            sectionErrors[name]
              ? "border-red-500 focus:ring-red-200 focus:border-red-500"
              : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
          }`}
          placeholder={`Enter ${label.toLowerCase()}`}
          aria-invalid={Boolean(sectionErrors[name])}
          aria-describedby={sectionErrors[name] ? `${name}-error` : undefined}
        />
      ) : (
        <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-sm font-medium text-gray-900">
            {profileData?.[name] || "Not provided"}
          </p>
        </div>
      )}
      {sectionErrors[name] && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
          {sectionErrors[name]}
        </p>
      )}
    </div>
  );

  const renderSectionActions = (sectionKey, showEditIcon = true) => {
    const isEditing = editingSection === sectionKey;

    return (
      <div className="flex items-center justify-end gap-2 mb-4">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={() => handleSaveSection(sectionKey)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-primary-600 hover:bg-primary-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={cancelSectionEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        ) : (
          showEditIcon && (
            <button
              type="button"
              onClick={() => startSectionEdit(sectionKey)}
              className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              aria-label={`Edit ${sectionKey} info`}
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>
    );
  };

  const renderPersonalSection = () => {
    const isEditing = editingSection === "personal";

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
        {renderSectionActions("personal", false)}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField("First Name", "firstName", "text", isEditing)}
          {renderField("Last Name", "lastName", "text", isEditing)}
          {renderField("Email Address", "email", "email", false, true)}
          {renderField("Phone Number", "phoneNumber", "tel", isEditing)}

          {role === "PATIENT" && (
            <>
              {renderField("Date of Birth", "dateOfBirth", "date", isEditing)}

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Age
                </label>
                <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-sm font-medium text-gray-900">
                    {(() => {
                      const dob = isEditing
                        ? formData.dateOfBirth
                        : profileData?.dateOfBirth;
                      const age = profileData?.age ?? calculateAge(dob);
                      return age != null ? `${age} years` : "Not provided";
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Gender
                </label>
                {isEditing ? (
                  <select
                    name="gender"
                    value={formData.gender || ""}
                    onChange={handleChange}
                    className={`px-3 py-2.5 border rounded-md focus:ring-2 transition-colors bg-white text-gray-900 ${
                      sectionErrors.gender
                        ? "border-red-500 focus:ring-red-200 focus:border-red-500"
                        : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                    }`}
                    aria-invalid={Boolean(sectionErrors.gender)}
                    aria-describedby={
                      sectionErrors.gender ? "gender-error" : undefined
                    }
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {profileData?.gender || "Not provided"}
                    </p>
                  </div>
                )}
                {sectionErrors.gender && (
                  <p id="gender-error" className="mt-1 text-xs text-red-600">
                    {sectionErrors.gender}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderEmergencySection = () => {
    if (role !== "PATIENT") {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-900">
            Not applicable for this account type
          </p>
        </div>
      );
    }

    const contacts = formData.emergencyContacts || [];
    const isEditing = editingSection === "emergency";

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-end gap-2 mb-4">
          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveSection("emergency")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-primary-600 hover:bg-primary-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={cancelSectionEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddEmergencyContact}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-primary-600 hover:bg-primary-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Contact
          </button>
        </div>

        {sectionErrors.emergencyContacts && (
          <p className="mb-4 text-xs text-red-600">
            {sectionErrors.emergencyContacts}
          </p>
        )}

        <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          {contacts.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No emergency contacts added yet.
            </div>
          ) : (
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Relation
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contacts.map((contact, index) => (
                  <tr key={`contact-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap align-middle">
                      <input
                        type="text"
                        value={contact.name || ""}
                        onChange={(e) =>
                          handleEmergencyContactChange(
                            index,
                            "name",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                        placeholder="Contact name"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-middle">
                      <input
                        type="tel"
                        value={contact.phone || ""}
                        onChange={(e) =>
                          handleEmergencyContactChange(
                            index,
                            "phone",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                        placeholder="Phone number"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-middle">
                      <input
                        type="text"
                        value={contact.relation || ""}
                        onChange={(e) =>
                          handleEmergencyContactChange(
                            index,
                            "relation",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                        placeholder="Relation"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right align-middle">
                      <button
                        type="button"
                        onClick={() => handleRemoveEmergencyContact(index)}
                        className="inline-flex items-center justify-center p-1 rounded-full hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                        aria-label="Remove emergency contact"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="md:hidden space-y-3">
          {contacts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">
              No emergency contacts added yet.
            </div>
          ) : (
            contacts.map((contact, index) => (
              <div
                key={`contact-mobile-${index}`}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
              >
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={contact.name || ""}
                    onChange={(e) =>
                      handleEmergencyContactChange(
                        index,
                        "name",
                        e.target.value,
                      )
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                    placeholder="Contact name"
                  />
                  <input
                    type="tel"
                    value={contact.phone || ""}
                    onChange={(e) =>
                      handleEmergencyContactChange(
                        index,
                        "phone",
                        e.target.value,
                      )
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                    placeholder="Phone number"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={contact.relation || ""}
                      onChange={(e) =>
                        handleEmergencyContactChange(
                          index,
                          "relation",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                      placeholder="Relation"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEmergencyContact(index)}
                      className="inline-flex items-center justify-center p-2 rounded-full hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                      aria-label="Remove emergency contact"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderMedicalSection = () => {
    const isEditing = editingSection === "medical";

    if (role !== "PATIENT") {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-900">
            Not applicable for this account type
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
        {renderSectionActions("medical", false)}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField("Weight (kg)", "weight", "number", isEditing)}
          {renderField("Height (cm)", "height", "number", isEditing)}

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Blood Group
            </label>
            {isEditing ? (
              <select
                name="bloodGroup"
                value={formData.bloodGroup || ""}
                onChange={handleChange}
                className={`px-3 py-2.5 border rounded-md focus:ring-2 transition-colors bg-white text-gray-900 ${
                  sectionErrors.bloodGroup
                    ? "border-red-500 focus:ring-red-200 focus:border-red-500"
                    : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                }`}
                aria-invalid={Boolean(sectionErrors.bloodGroup)}
                aria-describedby={
                  sectionErrors.bloodGroup ? "bloodGroup-error" : undefined
                }
              >
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-sm font-medium text-gray-900">
                  {profileData?.bloodGroup || "Not provided"}
                </p>
              </div>
            )}
            {sectionErrors.bloodGroup && (
              <p id="bloodGroup-error" className="mt-1 text-xs text-red-600">
                {sectionErrors.bloodGroup}
              </p>
            )}
          </div>

          {renderField("Medical Condition", "condition", "text", isEditing)}
        </div>
      </div>
    );
  };

  const renderDoctorProfessionalSection = () => {
    const isEditing = editingSection === "professional";
    const missingProfessionalInfo =
      !profileData?.specialization &&
      !profileData?.yearOfExperience &&
      !profileData?.location &&
      !profileData?.consultationFee &&
      !profileData?.qualifications &&
      !profileData?.languages &&
      !profileData?.hospitalAffiliation &&
      !profileData?.about;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
        {renderSectionActions("professional", false)}

        {!isEditing && missingProfessionalInfo && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Complete your professional profile so patients can quickly
            understand your expertise.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField("Specialization", "specialization", "text", isEditing)}
          {renderField(
            "Years of Experience",
            "yearOfExperience",
            "number",
            isEditing,
          )}
          {renderField("Location", "location", "text", isEditing)}
          {renderField(
            "Consultation Fee",
            "consultationFee",
            "number",
            isEditing,
          )}
          {renderField("Qualifications", "qualifications", "text", isEditing)}
          {renderField("Languages", "languages", "text", isEditing)}
          {renderField(
            "Hospital Affiliation",
            "hospitalAffiliation",
            "text",
            isEditing,
          )}
          {renderField("About", "about", "text", isEditing)}
        </div>
      </div>
    );
  };

  const renderAssistantWorkSection = () => {
    const missingAssignedDoctor =
      !profileData?.doctorName && !profileData?.doctorId;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Role
            </label>
            <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-sm font-medium text-gray-900">Assistant</p>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Assistant ID
            </label>
            <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-sm font-medium text-gray-900">
                {profileData?.assistantId || profileData?.id || "Not provided"}
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Assigned Doctor
            </label>
            <div className="px-3 py-2.5 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-sm font-medium text-gray-900">
                {profileData?.doctorName ||
                  profileData?.doctorId ||
                  "Not provided"}
              </p>
            </div>
          </div>
        </div>

        {missingAssignedDoctor && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No doctor is assigned yet. Contact an administrator to link your
            assistant profile.
          </div>
        )}
      </div>
    );
  };

  const renderSecuritySection = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
        <form onSubmit={handlePasswordSubmit}>
          <div className="grid grid-cols-1 gap-4">
            {!passwordOtpRequested ? (
              <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-3 text-sm text-primary-900">
                Request a one-time OTP to your registered email, then verify it
                to update your password.
              </div>
            ) : (
              <>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    OTP Code
                  </label>
                  <input
                    type="text"
                    name="otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={passwordData.otp}
                    onChange={(e) => {
                      const onlyDigits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setPasswordData((prev) => ({
                        ...prev,
                        otp: onlyDigits,
                      }));

                      if (passwordErrors.otp) {
                        setPasswordErrors((prev) => {
                          const next = { ...prev };
                          delete next.otp;
                          return next;
                        });
                      }
                    }}
                    disabled={passwordLoading}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                    placeholder="Enter 6-digit OTP"
                  />
                  {passwordErrors.otp && (
                    <p className="mt-1 text-xs text-red-600">
                      {passwordErrors.otp}
                    </p>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordInputChange}
                      disabled={passwordLoading}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("new")}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      aria-label={
                        showPasswords.new
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      {showPasswords.new ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.newPassword && (
                    <p className="mt-1 text-xs text-red-600">
                      {passwordErrors.newPassword}
                    </p>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordInputChange}
                      disabled={passwordLoading}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("confirm")}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      aria-label={
                        showPasswords.confirm
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">
                      {passwordErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {passwordLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {passwordLoading
                ? "Processing"
                : passwordOtpRequested
                  ? "Verify OTP & Update Password"
                  : "Send OTP"}
            </button>
            <button
              type="button"
              onClick={resetPasswordForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderSectionContent = () => {
    if (activeSection === "personal") return renderPersonalSection();
    if (activeSection === "emergency") return renderEmergencySection();
    if (activeSection === "medical") return renderMedicalSection();
    if (activeSection === "professional")
      return renderDoctorProfessionalSection();
    if (activeSection === "assistant-work") return renderAssistantWorkSection();
    return renderSecuritySection();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchProfile}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <AvatarCircle
                  profile={profileData || user}
                  sizeClassName="w-14 h-14 sm:w-16 sm:h-16"
                  textClassName="text-lg sm:text-xl"
                  alt="Profile photo"
                />
                {avatarUploading && (
                  <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-base sm:text-lg font-semibold text-gray-900 leading-tight truncate">
                  {headerName}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {profileData?.email || "No email provided"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageSelect}
                  />
                  <button
                    type="button"
                    onClick={() => profileImageInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white transition-colors"
                  >
                    {hasProfileImage ? "Change Photo" : "Upload Photo"}
                  </button>
                  {hasProfileImage && (
                    <button
                      type="button"
                      onClick={handleRemoveProfileImage}
                      disabled={avatarUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-60"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-section-switcher relative md:hidden inline-flex items-center gap-2 shrink-0">
              {activeSection !== "security" && (
                <button
                  type="button"
                  onClick={() => {
                    if (editingSection === activeSection) {
                      cancelSectionEdit();
                      return;
                    }
                    startSectionEdit(activeSection);
                  }}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                    editingSection === activeSection
                      ? "border-primary-300 bg-primary-50 text-primary-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-label="Edit active profile section"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "profileSections"
                      ? null
                      : "profileSections",
                  )
                }
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                  activeSection !== sectionTabs[0]?.key
                    ? "border-primary-300 bg-primary-50 text-primary-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
                aria-label="Open profile sections"
                title="Profile sections"
              >
                <Settings className="h-4 w-4" />
              </button>

              {openDropdown === "profileSections" && (
                <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,18rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-xs font-semibold text-gray-700">
                    Sections
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {sectionTabs.map((tab) => {
                      const isActive = activeSection === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setActiveSection(tab.key);
                            setOpenDropdown(null);
                          }}
                          className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                            isActive
                              ? "border-primary-300 bg-primary-50 text-primary-700"
                              : "border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasUnknownRole && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Some profile sections are hidden because your account role is not
            recognized.
          </div>
        )}

        <div className="mb-4 md:mb-6">
          <div className="hidden md:flex items-center justify-between gap-3">
            <div className="flex gap-2 flex-wrap items-center">
              {sectionTabs.map((tab) => {
                const isActive = activeSection === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSection(tab.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-primary-50 border-primary-300 text-primary-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    aria-label={`Open ${tab.label} section`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeSection !== "security" && (
              <button
                type="button"
                onClick={() => {
                  if (editingSection === activeSection) {
                    cancelSectionEdit();
                    return;
                  }
                  startSectionEdit(activeSection);
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  editingSection === activeSection
                    ? "border-primary-300 bg-primary-50 text-primary-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
                aria-label="Edit active profile section"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {renderSectionContent()}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
