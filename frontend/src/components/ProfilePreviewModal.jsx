import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { profileAPI } from "../utils/api";
import { X, ArrowRight, Mail, Phone } from "lucide-react";
import AvatarCircle from "./AvatarCircle";

const ProfilePreviewModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  const fetchProfilePreview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await profileAPI.getProfile(token);
      setProfileData(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && token) {
      fetchProfilePreview();
    }
  }, [isOpen, token, fetchProfilePreview]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleViewProfile = () => {
    navigate("/profile");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4 md:pr-6">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-lg w-full max-w-sm border border-gray-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading profile...</div>
            </div>
          ) : profileData ? (
            <>
              {/* User Info */}
              <div className="space-y-3">
                {/* Name */}
                <div className="flex items-center gap-3">
                  <AvatarCircle
                    profile={profileData}
                    sizeClassName="w-10 h-10"
                    textClassName="text-xs"
                    className="flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">
                      {`${profileData.firstName || ""} ${profileData.lastName || ""}`.trim() ||
                        "N/A"}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900 truncate">
                      {profileData.email || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Phone */}
                {profileData.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">
                        {profileData.phoneNumber}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* View Full Profile Button */}
              <button
                onClick={handleViewProfile}
                className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                View Full Profile
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load profile
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePreviewModal;
