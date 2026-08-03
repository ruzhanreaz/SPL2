import React from "react";
import { Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";

const buildConsultationHref = (patientId) => {
  const normalized = String(patientId ?? "").trim();
  if (normalized) {
    return `/doctor/telemedicine?patientId=${encodeURIComponent(normalized)}`;
  }
  return "/doctor/telemedicine";
};

const ReturnToConsultationDashboardButton = ({
  patientId,
  className = "",
  label = "Consultation Dashboard",
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(buildConsultationHref(patientId));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 ${className}`.trim()}
    >
      <Stethoscope className="h-4 w-4" />
      {label}
    </button>
  );
};

export default ReturnToConsultationDashboardButton;
