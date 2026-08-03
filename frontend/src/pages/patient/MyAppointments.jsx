import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  X,
  Plus,
  Users,
  CircleX,
  FileText,
  Share2,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { appointmentAPI, documentAPI } from "../../utils/api";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthProvider";
import PageHeader from "../../components/ui/PageHeader";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import PageEmptyState from "../../components/ui/PageEmptyState";
import StarRating from "../../components/StarRating";

const PENDING_STATUSES = new Set(["PENDING", "PAYMENT_PENDING"]);
const UPCOMING_STATUSES = new Set([
  "CONFIRMED",
  "SCHEDULED",
  "PENDING",
  "PAYMENT_PENDING",
]);
const CANCELLABLE_STATUSES = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "SCHEDULED",
]);
const JOINABLE_STATUSES = new Set(["CONFIRMED", "SCHEDULED", "IN_PROGRESS"]);
const CANCELLED_STATUSES = new Set(["CANCELLED", "REJECTED"]);

const PAYMENT_FAILURE_MESSAGES = {
  payment_failed: "Your payment could not be processed. Please try again.",
  payment_pending:
    "This transaction is not confirmed yet. Please complete payment from a fresh checkout session.",
  cancelled: "You cancelled the payment. Your appointment has been removed.",
  validation_failed:
    "Payment could not be verified. Please contact support if this continues.",
  missing_transaction:
    "Payment callback was missing a transaction ID. Please contact support.",
  error: "An unexpected payment error occurred. Please contact support.",
};

const formatLocalDate = (dateString) => {
  if (!dateString) return "-";

  const [year, month, day] = String(dateString).split("-").map(Number);
  if (!year || !month || !day) return dateString;

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatPaymentEstimateTime = (timeString) => {
  if (!timeString) return "--";
  const [hours = "00", minutes = "00"] = String(timeString).split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return "--";
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const PatientMyAppointments = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelModal, setCancelModal] = useState({
    show: false,
    appointmentId: null,
  });
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [detailsModal, setDetailsModal] = useState({
    show: false,
    appointment: null,
  });
  const [accessModal, setAccessModal] = useState({
    show: false,
    appointmentId: null,
  });
  const [accessDurationMinutes, setAccessDurationMinutes] = useState(60);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [shareHealthAnalysis, setShareHealthAnalysis] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileSettingsPosition, setMobileSettingsPosition] = useState({
    top: 0,
    left: 0,
  });
  const [ratingModal, setRatingModal] = useState({
    show: false,
    appointmentId: null,
    doctorName: "",
  });
  const [ratingValue, setRatingValue] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [payingAppointmentId, setPayingAppointmentId] = useState(null);
  const [paymentSuccessPopup, setPaymentSuccessPopup] = useState({
    show: false,
    serial: "--",
    time: "--",
  });
  const [paymentFailurePopup, setPaymentFailurePopup] = useState({
    show: false,
    message: PAYMENT_FAILURE_MESSAGES.error,
  });
  const filterBarRef = useRef(null);
  const mobileSettingsButtonRef = useRef(null);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

  const getAppointmentTimestamp = useCallback((appointment) => {
    if (!appointment?.appointmentDate) return null;
    const appointmentTime = appointment.appointmentTime || "00:00:00";
    const timestamp = new Date(
      `${appointment.appointmentDate}T${appointmentTime}`,
    ).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }, []);

  const filterCounts = useMemo(() => {
    const nowTs = Date.now();
    return appointments.reduce(
      (acc, apt) => {
        const aptTs = getAppointmentTimestamp(apt);
        acc.all += 1;

        if (PENDING_STATUSES.has(apt.status)) acc.pending += 1;
        if (
          UPCOMING_STATUSES.has(apt.status) &&
          aptTs != null &&
          aptTs >= nowTs
        )
          acc.upcoming += 1;
        if (
          aptTs != null &&
          aptTs < nowTs &&
          !CANCELLED_STATUSES.has(apt.status)
        )
          acc.past += 1;
        if (CANCELLED_STATUSES.has(apt.status)) acc.cancelled += 1;

        return acc;
      },
      { all: 0, pending: 0, upcoming: 0, past: 0, cancelled: 0 },
    );
  }, [appointments, getAppointmentTimestamp]);

  const todayQueueCount = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.appointmentDate === today &&
          appointment.doctorId != null &&
          appointment.serialNumber != null &&
          (PENDING_STATUSES.has(appointment.status) ||
            JOINABLE_STATUSES.has(appointment.status)),
      ).length,
    [appointments, today],
  );

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentAPI.getPatientAppointments(token);
      setAppointments(data);
    } catch (err) {
      setError(err.message || "Failed to load appointments");
      console.error("Error fetching appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    const paymentFlag = searchParams.get("payment");
    if (paymentFlag === "success") {
      setPaymentSuccessPopup({
        show: true,
        serial: searchParams.get("serial") || "--",
        time: formatPaymentEstimateTime(searchParams.get("time")),
      });
      return;
    }

    if (paymentFlag === "failed") {
      const reason = searchParams.get("reason") || "error";
      setPaymentFailurePopup({
        show: true,
        message:
          PAYMENT_FAILURE_MESSAGES[reason] || PAYMENT_FAILURE_MESSAGES.error,
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const rateFlag = searchParams.get("rate");
    const appointmentIdParam = searchParams.get("appointmentId");

    if (rateFlag !== "1" || !appointmentIdParam) {
      return;
    }

    if (!appointments.length) {
      return;
    }

    const targetAppointmentId = Number(appointmentIdParam);
    if (!Number.isFinite(targetAppointmentId)) {
      const cleanedParams = new URLSearchParams(searchParams);
      cleanedParams.delete("rate");
      cleanedParams.delete("appointmentId");
      setSearchParams(cleanedParams, { replace: true });
      return;
    }

    const targetAppointment = appointments.find(
      (appointment) => appointment.appointmentId === targetAppointmentId,
    );

    const isRateEligible =
      targetAppointment?.status === "COMPLETED" && !targetAppointment?.rating;

    if (targetAppointment && isRateEligible) {
      setRatingModal({
        show: true,
        appointmentId: targetAppointment.appointmentId,
        doctorName: targetAppointment.doctorName || "",
      });
      setRatingValue(0);
      setReviewText("");
    } else if (targetAppointment) {
      toast.info?.("This appointment is not eligible for rating right now.");
    } else {
      toast.info?.("Appointment not found for rating.");
    }

    const cleanedParams = new URLSearchParams(searchParams);
    cleanedParams.delete("rate");
    cleanedParams.delete("appointmentId");
    setSearchParams(cleanedParams, { replace: true });
  }, [appointments, searchParams, setSearchParams, toast]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterBarRef.current &&
        !filterBarRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateMobileSettingsPosition = useCallback(() => {
    const button = mobileSettingsButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const popupWidth = Math.min(window.innerWidth - 16, 352);
    const computedLeft = Math.max(
      8,
      Math.min(rect.right - popupWidth, window.innerWidth - popupWidth - 8),
    );

    setMobileSettingsPosition({
      top: rect.bottom + 6,
      left: computedLeft,
    });
  }, []);

  const closePaymentSuccessPopup = useCallback(() => {
    setPaymentSuccessPopup((prev) => ({ ...prev, show: false }));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("payment");
    nextParams.delete("serial");
    nextParams.delete("time");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const closePaymentFailurePopup = useCallback(() => {
    setPaymentFailurePopup((prev) => ({ ...prev, show: false }));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("payment");
    nextParams.delete("reason");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (openDropdown !== "mobileSettings") return;

    updateMobileSettingsPosition();
    window.addEventListener("resize", updateMobileSettingsPosition);
    window.addEventListener("scroll", updateMobileSettingsPosition, true);

    return () => {
      window.removeEventListener("resize", updateMobileSettingsPosition);
      window.removeEventListener("scroll", updateMobileSettingsPosition, true);
    };
  }, [openDropdown, updateMobileSettingsPosition]);

  useEffect(() => {
    const loadDocumentsForAccess = async () => {
      if (!accessModal.show || !token) {
        return;
      }

      try {
        setDocumentsLoading(true);
        setShareHealthAnalysis(true);
        const docs = await documentAPI.getDocuments(null, token);
        const normalized = Array.isArray(docs) ? docs : [];
        setAvailableDocuments(normalized);
        setSelectedDocumentIds([]);
      } catch (err) {
        setAvailableDocuments([]);
        setSelectedDocumentIds([]);
        toast.error(err.message || "Failed to load your documents");
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadDocumentsForAccess();
  }, [accessModal.show, token, toast]);

  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      toast.warning("Please provide a reason for cancellation");
      return;
    }

    try {
      setCancelling(true);
      await appointmentAPI.cancelAppointment(
        cancelModal.appointmentId,
        cancelReason,
        token,
      );
      setCancelModal({ show: false, appointmentId: null });
      setCancelReason("");
      toast.success("Appointment cancelled successfully");
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || "Failed to cancel appointment");
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      toast.warning("Please select a star rating before submitting");
      return;
    }
    try {
      setSubmittingRating(true);
      const updated = await appointmentAPI.submitRating(
        ratingModal.appointmentId,
        ratingValue,
        reviewText.trim() || null,
        token,
      );
      setAppointments((prev) =>
        prev.map((a) =>
          a.appointmentId === updated.appointmentId ? updated : a,
        ),
      );
      toast.success("Thank you for your rating!");
      setRatingModal({ show: false, appointmentId: null, doctorName: "" });
      setRatingValue(0);
      setReviewText("");
    } catch (err) {
      toast.error(err.message || "Failed to submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleGrantDocumentAccess = async () => {
    if (!accessModal.appointmentId) return;
    if (selectedDocumentIds.length === 0 && !shareHealthAnalysis) {
      toast.warning("Select at least one item to share");
      return;
    }

    try {
      setGrantingAccess(true);
      await appointmentAPI.grantDocumentAccess(
        accessModal.appointmentId,
        Number.isFinite(accessDurationMinutes)
          ? Math.max(0, accessDurationMinutes)
          : 0,
        selectedDocumentIds,
        token,
        { shareHealthAnalysis },
      );
      toast.success("Secure access granted for documents and health trends");
      window.localStorage.setItem("patientDocAccessAttention", "1");
      window.dispatchEvent(new Event("patient-doc-access-updated"));
      setAccessModal({ show: false, appointmentId: null });
      setSelectedDocumentIds([]);
      setAvailableDocuments([]);
    } catch (err) {
      toast.error(err.message || "Failed to grant document access");
    } finally {
      setGrantingAccess(false);
    }
  };

  const handlePayAppointment = async (appointmentId) => {
    if (!appointmentId) return;

    try {
      setPayingAppointmentId(appointmentId);
      const result = await appointmentAPI.initiatePayment(
        appointmentId,
        window.location.origin,
        token,
      );

      if (result?.paymentUrl) {
        window.location.href = result.paymentUrl;
        return;
      }

      toast.error("Payment link is unavailable right now. Please try again.");
    } catch (err) {
      toast.error(err.message || "Failed to start payment");
    } finally {
      setPayingAppointmentId(null);
    }
  };

  const toggleSelectedDocument = (documentId) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const handleSelectAllDocuments = () => {
    setSelectedDocumentIds(availableDocuments.map((doc) => doc.documentId));
  };

  const handleClearSelectedDocuments = () => {
    setSelectedDocumentIds([]);
  };

  const getFilteredAppointments = () => {
    const nowTs = Date.now();
    return appointments.filter((apt) => {
      const aptTs = getAppointmentTimestamp(apt);

      switch (filter) {
        case "pending":
          return PENDING_STATUSES.has(apt.status);
        case "upcoming":
          return (
            UPCOMING_STATUSES.has(apt.status) && aptTs != null && aptTs >= nowTs
          );
        case "past":
          return (
            aptTs != null &&
            aptTs < nowTs &&
            !CANCELLED_STATUSES.has(apt.status)
          );
        case "cancelled":
          return CANCELLED_STATUSES.has(apt.status);
        default:
          return true;
      }
    });
  };

  const getSortedAppointments = (items) => {
    if (!sortConfig.key) return items;

    return [...items].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "doctorName":
          aValue = a.doctorName || "";
          bValue = b.doctorName || "";
          break;
        case "doctorSpecialization":
          aValue = a.doctorSpecialization || "";
          bValue = b.doctorSpecialization || "";
          break;
        case "appointmentDate":
          aValue = a.appointmentDate || "";
          bValue = b.appointmentDate || "";
          break;
        case "appointmentTime":
          aValue = a.appointmentTime || "";
          bValue = b.appointmentTime || "";
          break;
        case "serialNumber":
          aValue = a.serialNumber ?? Infinity;
          bValue = b.serialNumber ?? Infinity;
          break;
        case "appointmentType":
          aValue = a.appointmentType || "";
          bValue = b.appointmentType || "";
          break;
        case "status":
          aValue = a.status || "";
          bValue = b.status || "";
          break;
        case "payment":
          aValue = getPaymentInfo(a).isPaid ? 1 : 0;
          bValue = getPaymentInfo(b).isPaid ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };

  const getSearchedAppointments = (items) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;

    return items.filter((apt) => {
      const paymentInfo = getPaymentInfo(apt);
      const searchableText = [
        apt.doctorName,
        apt.doctorSpecialization,
        apt.appointmentDate,
        apt.appointmentTime,
        apt.serialNumber != null ? String(apt.serialNumber) : "",
        apt.appointmentType,
        apt.status,
        paymentInfo.isPaid ? "paid" : "pending",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const filteredAppointments = getSortedAppointments(
    getSearchedAppointments(getFilteredAppointments()),
  );

  const formatStatusLabel = (status) =>
    (status || "UNKNOWN")
      .toLowerCase()
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");

  const getStatusBadge = (status) => {
    const badges = {
      PAYMENT_PENDING: "bg-orange-100 text-orange-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      CONFIRMED: "bg-green-100 text-green-800",
      SCHEDULED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      CANCELLED: "bg-gray-100 text-gray-800",
      COMPLETED: "bg-primary-100 text-primary-800",
      NO_SHOW: "bg-gray-100 text-gray-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString) => {
    return formatLocalDate(dateString);
  };

  const formatTime = (timeString) => {
    if (!timeString) return "Time TBD";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const canRateAppointment = (appointment) => {
    if (!appointment) return false;
    return appointment.status === "COMPLETED" && !appointment.rating;
  };

  const getPaymentInfo = (appointment) => {
    const isPaid = appointment?.status !== "PAYMENT_PENDING";
    const paidAt =
      appointment?.paidAt ||
      appointment?.paymentConfirmedAt ||
      appointment?.paymentDate ||
      appointment?.paymentCompletedAt ||
      (isPaid ? appointment?.updatedAt : null);

    return {
      isPaid,
      paidAt,
    };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoadingState message="Loading appointments..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageErrorState message={error} onRetry={fetchAppointments} />
      </DashboardLayout>
    );
  }

  const pageActions = (
    <div className="hidden">
      <button
        onClick={() => navigate("/patient/live-queue")}
        className="inline-flex items-center gap-1.5 font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-center leading-tight transition-colors text-xs sm:text-sm border bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        <Users className="w-4 h-4" />
        Live Queue
        {todayQueueCount > 0 ? (
          <span className="text-xs rounded-full px-1.5 py-0.5 leading-none bg-primary-100 text-primary-700">
            {todayQueueCount}
          </span>
        ) : null}
      </button>
      <button
        onClick={() => navigate("/patient/find-doctor")}
        className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-3 sm:px-5 py-1.5 sm:py-2 rounded-full transition-colors inline-flex items-center gap-1.5 sm:gap-2 justify-center text-xs sm:text-sm text-center leading-tight"
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Book</span>
      </button>
    </div>
  );

  const filterTabs = [
    {
      value: "all",
      label: "All",
      count: filterCounts.all,
      showCount: true,
    },
    {
      value: "pending",
      label: "Pending",
      count: filterCounts.pending,
      showCount: filterCounts.pending > 0,
    },
    {
      value: "upcoming",
      label: "Upcoming",
      count: filterCounts.upcoming,
      showCount: filterCounts.upcoming > 0,
    },
    {
      value: "past",
      label: "Past",
      count: filterCounts.past,
      showCount: filterCounts.past > 0,
    },
    {
      value: "cancelled",
      label: "Cancelled",
      count: filterCounts.cancelled,
      showCount: filterCounts.cancelled > 0,
    },
  ];

  return (
    <DashboardLayout>
      <div>
        {paymentSuccessPopup.show && (
          <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-emerald-100 bg-white shadow-2xl px-5 py-4 relative">
              <button
                type="button"
                onClick={closePaymentSuccessPopup}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                aria-label="Close payment success popup"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-gray-900 pr-8">
                Payment Successful!
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Your appointment is confirmed.
              </p>

              <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                  Queue Token
                </p>
                <p className="mt-1 text-4xl font-black text-primary-700 leading-none">
                  {paymentSuccessPopup.serial}
                </p>
                <p className="mt-3 text-sm text-gray-700">
                  Estimated time: {paymentSuccessPopup.time}
                </p>
              </div>
            </div>
          </div>
        )}

        {paymentFailurePopup.show && (
          <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-rose-100 bg-white shadow-2xl px-5 py-4 relative">
              <button
                type="button"
                onClick={closePaymentFailurePopup}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                aria-label="Close payment failure popup"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-gray-900 pr-8">
                Payment Failed
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {paymentFailurePopup.message}
              </p>

              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-700">
                  No charge was confirmed. You can try booking and payment
                  again.
                </p>
              </div>
            </div>
          </div>
        )}

        <PageHeader title="My Appointments" actions={pageActions} />

        <div ref={filterBarRef} className="w-full mb-4 md:mb-6">
          <div>
            <div className="flex flex-nowrap md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible pb-1">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search appointments..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  ref={mobileSettingsButtonRef}
                  type="button"
                  onClick={() => {
                    if (openDropdown === "mobileSettings") {
                      setOpenDropdown(null);
                      return;
                    }
                    updateMobileSettingsPosition();
                    setOpenDropdown("mobileSettings");
                  }}
                  className={`h-9 w-9 rounded-full border inline-flex items-center justify-center transition-colors ${
                    filter !== "all" || sortConfig.key
                      ? "border-primary-300 bg-primary-50 text-primary-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-label="Open appointment filters and sorting"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                {openDropdown === "mobileSettings" && (
                  <div
                    className="fixed w-[min(92vw,22rem)] max-w-[calc(100vw-32px)] bg-white border border-gray-200 rounded-xl shadow-lg z-40 p-3 space-y-3"
                    style={{
                      top: `${mobileSettingsPosition.top}px`,
                      left: `${mobileSettingsPosition.left}px`,
                    }}
                  >
                    {/* --- Filter Section --- */}
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Filter
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {filterTabs.map((tab) => {
                          const isActive = filter === tab.value;
                          return (
                            <button
                              key={tab.value}
                              type="button"
                              onClick={() => setFilter(tab.value)}
                              className={`rounded-lg border px-2 py-1.5 text-xs font-medium text-left transition-colors ${
                                isActive
                                  ? "border-primary-300 bg-primary-50 text-primary-700"
                                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {tab.label}
                              {tab.showCount ? ` (${tab.count})` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* --- Sort Section --- */}
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Sort
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={sortConfig.key || "none"}
                          onChange={(event) => {
                            const nextKey = event.target.value;
                            if (nextKey === "none") {
                              setSortConfig({ key: null, direction: "asc" });
                              return;
                            }
                            setSortConfig((prev) => ({
                              key: nextKey,
                              direction:
                                prev.key === nextKey ? prev.direction : "asc",
                            }));
                          }}
                          className="col-span-2 border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="none">No sorting</option>
                          <option value="doctorName">Doctor name</option>
                          <option value="appointmentDate">
                            Appointment date
                          </option>
                          <option value="appointmentType">Type</option>
                          <option value="status">Status</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setSortConfig((prev) => ({
                              ...prev,
                              direction: "asc",
                            }))
                          }
                          disabled={!sortConfig.key}
                          className="rounded-lg border px-2 py-1.5 text-xs font-medium border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Ascending
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSortConfig((prev) => ({
                              ...prev,
                              direction: "desc",
                            }))
                          }
                          disabled={!sortConfig.key}
                          className="rounded-lg border px-2 py-1.5 text-xs font-medium border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Descending
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate("/patient/live-queue")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white border-gray-300 px-2.5 py-2 text-[11px] font-semibold leading-tight text-gray-700 transition-colors hover:bg-gray-50 sm:text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                Live Queue
                {todayQueueCount > 0 ? (
                  <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] leading-none text-primary-700">
                    {todayQueueCount}
                  </span>
                ) : null}
              </button>

              <button
                onClick={() => navigate("/patient/find-doctor")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-2.5 py-2 text-[11px] font-semibold leading-tight text-white transition-colors hover:bg-primary-700 sm:text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Book
              </button>
            </div>
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <PageEmptyState
            icon={Calendar}
            title={`No ${filter !== "all" ? filter : ""} appointments found`.trim()}
            description="Adjust filters or book a new appointment to get started."
            action={
              <button
                onClick={() => navigate("/patient/find-doctor")}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 sm:px-5 py-2 rounded-full transition-colors text-sm"
              >
                Book
              </button>
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="lg:hidden p-2.5 space-y-2 bg-gray-50/50">
              {filteredAppointments.map((appointment) => {
                const paymentInfo = getPaymentInfo(appointment);
                const canJoin =
                  appointment.appointmentType === "ONLINE" &&
                  JOINABLE_STATUSES.has(appointment.status);
                const canPay = appointment.status === "PAYMENT_PENDING";

                return (
                  <div
                    key={appointment.appointmentId}
                    className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          Dr. {appointment.doctorName || "Unknown doctor"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {appointment.doctorSpecialization || "N/A"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadge(appointment.status)}`}
                      >
                        {formatStatusLabel(appointment.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-700">
                      <div className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>{formatDate(appointment.appointmentDate)}</span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{formatTime(appointment.appointmentTime)}</span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        {appointment.appointmentType === "ONLINE" ? (
                          <Video className="w-4 h-4 text-gray-500" />
                        ) : (
                          <MapPin className="w-4 h-4 text-gray-500" />
                        )}
                        <span>
                          {appointment.appointmentType === "ONLINE"
                            ? "Online"
                            : "In-Person"}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        {CANCELLED_STATUSES.has(appointment.status) ? (
                          <span className="inline-flex px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-semibold">
                            Released
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                            {appointment.serialNumber != null
                              ? `#${appointment.serialNumber}`
                              : "Not assigned"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs">
                      <p className="font-semibold text-gray-700">
                        Payment: {paymentInfo.isPaid ? "Paid" : "Pending"}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        ID #{appointment.appointmentId}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setDetailsModal({
                            show: true,
                            appointment,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Details
                      </button>
                      {canJoin && (
                        <button
                          onClick={() =>
                            navigate(
                              `/patient/telemedicine?appointmentId=${appointment.appointmentId}`,
                            )
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join
                        </button>
                      )}
                      {canPay && (
                        <button
                          type="button"
                          onClick={() =>
                            handlePayAppointment(appointment.appointmentId)
                          }
                          disabled={
                            payingAppointmentId === appointment.appointmentId
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {payingAppointmentId === appointment.appointmentId
                            ? "Redirecting..."
                            : "Pay"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-[760px] w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("doctorName")}
                    >
                      <div className="flex items-center gap-2">
                        Doctor
                        {sortConfig.key === "doctorName" && (
                          <ArrowUpDown
                            className="w-3.5 h-3.5"
                            style={{
                              transform:
                                sortConfig.direction === "desc"
                                  ? "rotate(180deg)"
                                  : "",
                            }}
                          />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("appointmentDate")}
                    >
                      <div className="flex items-center gap-2">
                        Schedule
                        {sortConfig.key === "appointmentDate" && (
                          <ArrowUpDown
                            className="w-3.5 h-3.5"
                            style={{
                              transform:
                                sortConfig.direction === "desc"
                                  ? "rotate(180deg)"
                                  : "",
                            }}
                          />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("appointmentType")}
                    >
                      <div className="flex items-center gap-2">
                        Type
                        {sortConfig.key === "appointmentType" && (
                          <ArrowUpDown
                            className="w-3.5 h-3.5"
                            style={{
                              transform:
                                sortConfig.direction === "desc"
                                  ? "rotate(180deg)"
                                  : "",
                            }}
                          />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sortConfig.key === "status" && (
                          <ArrowUpDown
                            className="w-3.5 h-3.5"
                            style={{
                              transform:
                                sortConfig.direction === "desc"
                                  ? "rotate(180deg)"
                                  : "",
                            }}
                          />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAppointments.map((appointment) => (
                    <tr
                      key={appointment.appointmentId}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() =>
                        setDetailsModal({
                          show: true,
                          appointment,
                        })
                      }
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          Dr. {appointment.doctorName || "Unknown doctor"}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {appointment.doctorSpecialization || "N/A"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700 whitespace-nowrap">
                        <p>{formatDate(appointment.appointmentDate)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatTime(appointment.appointmentTime)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {appointment.appointmentType === "ONLINE" ? (
                            <Video className="w-3.5 h-3.5" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                          {appointment.appointmentType === "ONLINE"
                            ? "Online"
                            : "In-Person"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadge(appointment.status)}`}
                        >
                          {formatStatusLabel(appointment.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailsModal.show && detailsModal.appointment && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-5 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Appointment Details
                  </p>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">
                    Dr. {detailsModal.appointment.doctorName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {detailsModal.appointment.doctorSpecialization ||
                      "Specialization not provided"}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(detailsModal.appointment.status)}`}
                  >
                    {formatStatusLabel(detailsModal.appointment.status)}
                  </span>
                  <button
                    onClick={() =>
                      setDetailsModal({ show: false, appointment: null })
                    }
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {(() => {
                  const paymentInfo = getPaymentInfo(detailsModal.appointment);
                  const isCancelled = CANCELLED_STATUSES.has(
                    detailsModal.appointment.status,
                  );

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs text-gray-500">Appointment ID</p>
                        <p className="font-semibold">
                          #{detailsModal.appointment.appointmentId}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs text-gray-500">Queue Token</p>
                        <p className="font-semibold">
                          {isCancelled
                            ? "Released"
                            : (detailsModal.appointment.serialNumber ??
                              "Not assigned")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs text-gray-500">Payment Status</p>
                        <p className="font-semibold">
                          {paymentInfo.isPaid ? "Paid" : "Payment Pending"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs text-gray-500">Paid On</p>
                        <p className="font-semibold">
                          {paymentInfo.isPaid
                            ? formatDateTime(paymentInfo.paidAt)
                            : "Not paid yet"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs text-gray-500">
                          Consultation Fee
                        </p>
                        <p className="font-semibold">
                          {detailsModal.appointment.consultationFee != null
                            ? `${detailsModal.appointment.consultationFee}`
                            : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs text-gray-500">Booked On</p>
                        <p className="font-semibold">
                          {formatDateTime(detailsModal.appointment.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>
                      {formatDate(detailsModal.appointment.appointmentDate)}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>
                      {formatTime(detailsModal.appointment.appointmentTime)}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">
                    {detailsModal.appointment.appointmentType === "ONLINE" ? (
                      <Video className="w-4 h-4 text-gray-500" />
                    ) : (
                      <MapPin className="w-4 h-4 text-gray-500" />
                    )}
                    <span>
                      {detailsModal.appointment.appointmentType === "ONLINE"
                        ? "Online Consultation"
                        : "In-Person Visit"}
                    </span>
                  </div>
                </div>

                {(() => {
                  const canCancel = CANCELLABLE_STATUSES.has(
                    detailsModal.appointment.status,
                  );
                  const canJoin =
                    detailsModal.appointment.appointmentType === "ONLINE" &&
                    JOINABLE_STATUSES.has(detailsModal.appointment.status);
                  const canPay =
                    detailsModal.appointment.status === "PAYMENT_PENDING";
                  const canRate = canRateAppointment(detailsModal.appointment);
                  const canGrantDocumentAccess = !CANCELLED_STATUSES.has(
                    detailsModal.appointment.status,
                  );

                  if (
                    !canJoin &&
                    !canPay &&
                    !canCancel &&
                    !canGrantDocumentAccess &&
                    !canRate
                  )
                    return null;

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {canRate && (
                        <button
                          type="button"
                          onClick={() => {
                            setRatingModal({
                              show: true,
                              appointmentId:
                                detailsModal.appointment.appointmentId,
                              doctorName: detailsModal.appointment.doctorName,
                            });
                            setRatingValue(0);
                            setReviewText("");
                          }}
                          className="inline-flex items-center gap-2 bg-amber-600 text-white hover:bg-amber-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          Rate Doctor
                        </button>
                      )}
                      {canGrantDocumentAccess && (
                        <button
                          type="button"
                          onClick={() =>
                            setAccessModal({
                              show: true,
                              appointmentId:
                                detailsModal.appointment.appointmentId,
                            })
                          }
                          className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Share2 className="w-4 h-4" />
                          Share Docs
                        </button>
                      )}
                      {canJoin && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/patient/telemedicine?appointmentId=${detailsModal.appointment.appointmentId}`,
                            )
                          }
                          className="inline-flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Video className="w-4 h-4" />
                          Join Online Consultation
                        </button>
                      )}
                      {canPay && (
                        <button
                          type="button"
                          onClick={() =>
                            handlePayAppointment(
                              detailsModal.appointment.appointmentId,
                            )
                          }
                          disabled={
                            payingAppointmentId ===
                            detailsModal.appointment.appointmentId
                          }
                          className="inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {payingAppointmentId ===
                          detailsModal.appointment.appointmentId
                            ? "Redirecting..."
                            : "Pay"}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => {
                            setDetailsModal({
                              show: false,
                              appointment: null,
                            });
                            setCancelModal({
                              show: true,
                              appointmentId:
                                detailsModal.appointment.appointmentId,
                            });
                          }}
                          className="inline-flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <CircleX className="w-4 h-4" />
                          Cancel Appointment
                        </button>
                      )}
                    </div>
                  );
                })()}

                {detailsModal.appointment.notes && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Notes
                    </p>
                    <p className="text-sm text-gray-700">
                      {detailsModal.appointment.notes}
                    </p>
                  </div>
                )}

                {detailsModal.appointment.rating && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                      Your Rating
                    </p>
                    <div className="flex items-center gap-2">
                      <StarRating
                        rating={detailsModal.appointment.rating}
                        size="sm"
                      />
                      <span className="text-sm font-semibold text-amber-900">
                        {detailsModal.appointment.rating}/5
                      </span>
                    </div>
                    {detailsModal.appointment.reviewText && (
                      <p className="text-sm text-amber-900 mt-2">
                        {detailsModal.appointment.reviewText}
                      </p>
                    )}
                    <p className="text-xs text-amber-700 mt-1">
                      Rated on{" "}
                      {formatDateTime(detailsModal.appointment.ratedAt)}
                    </p>
                  </div>
                )}

                {(detailsModal.appointment.status === "CANCELLED" ||
                  detailsModal.appointment.status === "REJECTED") && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {detailsModal.appointment.cancellationReason && (
                      <p>
                        <span className="font-semibold">
                          Cancellation reason:
                        </span>{" "}
                        {detailsModal.appointment.cancellationReason}
                      </p>
                    )}
                    {detailsModal.appointment.rejectionReason && (
                      <p>
                        <span className="font-semibold">Rejection reason:</span>{" "}
                        {detailsModal.appointment.rejectionReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {ratingModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Rate Dr. {ratingModal.doctorName}
                </h2>
                <button
                  onClick={() => {
                    setRatingModal({
                      show: false,
                      appointmentId: null,
                      doctorName: "",
                    });
                    setRatingValue(0);
                    setReviewText("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  disabled={submittingRating}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 mb-3 text-sm">
                How was your appointment experience?
              </p>

              <div className="mb-4">
                <StarRating
                  rating={ratingValue || null}
                  onChange={setRatingValue}
                  size="lg"
                  showLabel
                />
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Review (optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write a short review..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                rows="4"
                maxLength={500}
                disabled={submittingRating}
              />
              <p className="text-xs text-gray-500 mb-4">
                {reviewText.length}/500 characters
              </p>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setRatingModal({
                      show: false,
                      appointmentId: null,
                      doctorName: "",
                    });
                    setRatingValue(0);
                    setReviewText("");
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={submittingRating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRating}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={submittingRating}
                >
                  {submittingRating ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Cancel Appointment
                </h2>
                <button
                  onClick={() => {
                    setCancelModal({ show: false, appointmentId: null });
                    setCancelReason("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 mb-4">
                Please provide a reason for cancelling this appointment:
              </p>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                rows="4"
              />

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setCancelModal({ show: false, appointmentId: null });
                    setCancelReason("");
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={cancelling}
                >
                  Keep Appointment
                </button>
                <button
                  onClick={handleCancelAppointment}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}

        {accessModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Grant Document Access
                </h2>
                <button
                  onClick={() =>
                    setAccessModal({ show: false, appointmentId: null })
                  }
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                Allow your doctor to view your documents for this in-person
                consultation.
              </p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Select documents to share
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllDocuments}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      disabled={
                        documentsLoading || availableDocuments.length === 0
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelectedDocuments}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-700"
                      disabled={
                        documentsLoading || selectedDocumentIds.length === 0
                      }
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1.5">
                  {documentsLoading ? (
                    <p className="text-xs text-gray-500 px-1 py-2">
                      Loading documents...
                    </p>
                  ) : availableDocuments.length === 0 ? (
                    <p className="text-xs text-gray-500 px-1 py-2">
                      No documents available to share.
                    </p>
                  ) : (
                    availableDocuments.map((doc) => (
                      <label
                        key={doc.documentId}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(doc.documentId)}
                          onChange={() =>
                            toggleSelectedDocument(doc.documentId)
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">
                            {doc.fileName || `Document #${doc.documentId}`}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {doc.documentType || "Document"}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {selectedDocumentIds.length} document
                  {selectedDocumentIds.length === 1 ? "" : "s"} selected
                  {shareHealthAnalysis ? " + health trends" : ""}
                </p>
              </div>

              <label className="mb-4 flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareHealthAnalysis}
                  onChange={() => setShareHealthAnalysis((prev) => !prev)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-primary-900">
                    Include Health Analysis Trends
                  </p>
                  <p className="text-[11px] text-primary-700 mt-0.5">
                    Doctor can view Current and Continuous trend pages during
                    this access window.
                  </p>
                </div>
              </label>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Auto-revoke timer (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={accessDurationMinutes}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setAccessDurationMinutes(
                    Number.isFinite(next) ? Math.max(0, next) : 0,
                  );
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                Set 0 to keep access until the consultation ends.
              </p>

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-5">
                <button
                  onClick={() =>
                    setAccessModal({ show: false, appointmentId: null })
                  }
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={grantingAccess}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGrantDocumentAccess}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={
                    grantingAccess ||
                    (selectedDocumentIds.length === 0 && !shareHealthAnalysis)
                  }
                >
                  {grantingAccess ? "Granting..." : "Grant Access"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientMyAppointments;
