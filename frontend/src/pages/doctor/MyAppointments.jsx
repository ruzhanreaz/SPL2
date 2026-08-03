import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  X,
  Check,
  Users,
  CircleX,
  FileText,
  Share2,
  Pill,
  Timer,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { appointmentAPI, queueAPI, assistantAPI } from "../../utils/api";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthProvider";
import PageHeader from "../../components/ui/PageHeader";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import PageEmptyState from "../../components/ui/PageEmptyState";

const DoctorMyAppointments = ({ isAssistantMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelModal, setCancelModal] = useState({
    show: false,
    appointmentId: null,
  });
  const [rejectModal, setRejectModal] = useState({
    show: false,
    appointmentId: null,
  });
  const [cancelReason, setCancelReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [detailsModal, setDetailsModal] = useState({
    show: false,
    appointment: null,
  });
  const [cancelling, setCancelling] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmingAppointmentId, setConfirmingAppointmentId] = useState(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null);
  const [autoTimeoutModalOpen, setAutoTimeoutModalOpen] = useState(false);
  const [autoTimeoutMinutes, setAutoTimeoutMinutes] = useState(0);
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileSettingsPosition, setMobileSettingsPosition] = useState({
    top: 0,
    left: 0,
  });
  const filterBarRef = useRef(null);
  const mobileSettingsButtonRef = useRef(null);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  const autoEndingRef = useRef(new Set());
  const getAppointmentTimestamp = useCallback((appointment) => {
    if (!appointment?.appointmentDate) return null;
    const appointmentTime = appointment.appointmentTime || "00:00:00";
    const timestamp = new Date(
      `${appointment.appointmentDate}T${appointmentTime}`,
    ).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }, []);

  const todayQueueCount = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.appointmentDate === today &&
          [
            "PENDING",
            "CONFIRMED",
            "IN_PROGRESS",
            "PAYMENT_PENDING",
            "SCHEDULED",
          ].includes(appointment.status),
      ).length,
    [appointments, today],
  );

  const timeoutStorageKey = useMemo(
    () =>
      `doctor_auto_timeout_${user?.doctorId || user?.assistantId || user?.userId || "default"}`,
    [user?.assistantId, user?.doctorId, user?.userId],
  );

  const filterCounts = useMemo(() => {
    const nowTs = Date.now();
    return appointments.reduce(
      (acc, apt) => {
        const aptTs = getAppointmentTimestamp(apt);
        acc.all += 1;

        if (apt.status === "PENDING" || apt.status === "PAYMENT_PENDING") {
          acc.pending += 1;
        }
        if (
          (apt.status === "CONFIRMED" ||
            apt.status === "SCHEDULED" ||
            apt.status === "PENDING" ||
            apt.status === "PAYMENT_PENDING") &&
          aptTs != null &&
          aptTs >= nowTs
        ) {
          acc.upcoming += 1;
        }
        if (
          aptTs != null &&
          aptTs < nowTs &&
          apt.status !== "CANCELLED" &&
          apt.status !== "REJECTED"
        ) {
          acc.past += 1;
        }
        if (apt.status === "CANCELLED" || apt.status === "REJECTED") {
          acc.cancelled += 1;
        }

        return acc;
      },
      { all: 0, pending: 0, upcoming: 0, past: 0, cancelled: 0 },
    );
  }, [appointments, getAppointmentTimestamp]);

  const fetchAppointments = useCallback(async () => {
    if (!token) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await (isAssistantMode
        ? assistantAPI.getDoctorAppointments(token)
        : appointmentAPI.getDoctorAppointments(token));
      setAppointments(data);
    } catch (err) {
      if (err?.status === 401) {
        setAppointments([]);
        setError(null);
        return;
      }
      setError(err.message || "Failed to load appointments");
      console.error("Error fetching appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [isAssistantMode, token]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

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
    const savedValue = window.localStorage.getItem(timeoutStorageKey);
    const parsed = Number(savedValue);
    setAutoTimeoutMinutes(Number.isFinite(parsed) ? parsed : 0);
  }, [timeoutStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(timeoutStorageKey, String(autoTimeoutMinutes));
  }, [autoTimeoutMinutes, timeoutStorageKey]);

  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      toast.warning("Please provide a reason for cancellation");
      return;
    }

    try {
      setCancelling(true);
      if (isAssistantMode) {
        await assistantAPI.cancelInPersonAppointment(
          cancelModal.appointmentId,
          cancelReason,
          token,
        );
      } else {
        await appointmentAPI.cancelAppointment(
          cancelModal.appointmentId,
          cancelReason,
          token,
        );
      }
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

  const handleConfirmAppointment = async (appointmentId) => {
    try {
      setConfirmingAppointmentId(appointmentId);
      await (isAssistantMode
        ? assistantAPI.confirmAppointment(appointmentId, token)
        : appointmentAPI.confirmAppointment(appointmentId, token));
      toast.success("Appointment confirmed successfully");
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || "Failed to confirm appointment");
    } finally {
      setConfirmingAppointmentId(null);
    }
  };

  const handleConfirmPayment = async (appointmentId) => {
    try {
      setConfirmingPaymentId(appointmentId);
      await (isAssistantMode
        ? assistantAPI.confirmPayment(appointmentId, token)
        : appointmentAPI.confirmPayment(appointmentId, token));
      toast.success("Payment and appointment confirmed successfully");
      setDetailsModal({ show: false, appointment: null });
      fetchAppointments();
      navigate(
        isAssistantMode ? "/assistant/appointments" : "/doctor/appointments",
        {
          replace: true,
        },
      );
    } catch (err) {
      toast.error(err.message || "Failed to confirm payment");
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleRejectAppointment = async () => {
    if (!rejectReason.trim()) {
      toast.warning("Please provide a reason for rejection");
      return;
    }

    try {
      setRejecting(true);
      await (isAssistantMode
        ? assistantAPI.rejectAppointment(
            rejectModal.appointmentId,
            rejectReason,
            token,
          )
        : appointmentAPI.rejectAppointment(
            rejectModal.appointmentId,
            rejectReason,
            token,
          ));
      setRejectModal({ show: false, appointmentId: null });
      setRejectReason("");
      toast.success("Appointment rejected");
      fetchAppointments();
      navigate(
        isAssistantMode ? "/assistant/appointments" : "/doctor/appointments",
        {
          replace: true,
        },
      );
    } catch (err) {
      toast.error(err.message || "Failed to reject appointment");
    } finally {
      setRejecting(false);
    }
  };

  const handleJoinConsultation = useCallback(
    (appointmentId) => {
      if (isAssistantMode) {
        toast.warning("Assistants cannot join consultations.");
        return;
      }
      if (!appointmentId) return;
      navigate(`/doctor/telemedicine?appointmentId=${appointmentId}`);
    },
    [isAssistantMode, navigate, toast],
  );

  const handleOpenOfflineActions = useCallback(
    (appointmentId, tab = "documents") => {
      if (isAssistantMode || !appointmentId) return;
      const returnTo = `${location.pathname}${location.search}`;
      const params = new URLSearchParams({
        tab,
        returnTo,
      });
      navigate(
        `/doctor/appointments/${appointmentId}/offline?${params.toString()}`,
        {
          state: { from: returnTo },
        },
      );
    },
    [isAssistantMode, location.pathname, location.search, navigate],
  );

  useEffect(() => {
    if (!token || autoTimeoutMinutes <= 0 || appointments.length === 0) return;

    const checkAndAutoEnd = async () => {
      const now = Date.now();
      const eligibleStatuses = ["CONFIRMED", "SCHEDULED", "IN_PROGRESS"];

      const eligibleAppointments = appointments.filter((appointment) => {
        if (!eligibleStatuses.includes(appointment.status)) return false;
        if (!appointment.appointmentDate || !appointment.appointmentTime)
          return false;

        const startAt = new Date(
          `${appointment.appointmentDate}T${appointment.appointmentTime}`,
        ).getTime();

        if (Number.isNaN(startAt)) return false;
        return now >= startAt + autoTimeoutMinutes * 60 * 1000;
      });

      let endedCount = 0;

      for (const appointment of eligibleAppointments) {
        const id = appointment.appointmentId;
        if (!id || autoEndingRef.current.has(id)) continue;

        autoEndingRef.current.add(id);
        try {
          await (isAssistantMode
            ? assistantAPI.markAsCompleted(id, token)
            : queueAPI.markCompleted(id, token));
          endedCount += 1;
        } catch {
          // Ignore single-item failures; next interval may retry.
        } finally {
          autoEndingRef.current.delete(id);
        }
      }

      if (endedCount > 0) {
        toast.success(
          `${endedCount} appointment${endedCount > 1 ? "s" : ""} auto-ended by timeout`,
        );
        fetchAppointments();
      }
    };

    const interval = window.setInterval(checkAndAutoEnd, 30000);
    checkAndAutoEnd();

    return () => window.clearInterval(interval);
  }, [
    appointments,
    autoTimeoutMinutes,
    isAssistantMode,
    token,
    toast,
    fetchAppointments,
  ]);

  const getFilteredAppointments = () => {
    const nowTs = Date.now();
    return appointments.filter((apt) => {
      const aptTs = getAppointmentTimestamp(apt);

      switch (filter) {
        case "pending":
          return apt.status === "PENDING" || apt.status === "PAYMENT_PENDING";
        case "upcoming":
          return (
            (apt.status === "CONFIRMED" ||
              apt.status === "SCHEDULED" ||
              apt.status === "PENDING" ||
              apt.status === "PAYMENT_PENDING") &&
            aptTs != null &&
            aptTs >= nowTs
          );
        case "past":
          return (
            aptTs != null &&
            aptTs < nowTs &&
            apt.status !== "CANCELLED" &&
            apt.status !== "REJECTED"
          );
        case "cancelled":
          return apt.status === "CANCELLED" || apt.status === "REJECTED";
        default:
          return true;
      }
    });
  };

  const getSortedAppointments = (items) => {
    if (!sortConfig.key) return items;

    return [...items].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case "patientName":
          aValue = a.patientName || "";
          bValue = b.patientName || "";
          break;
        case "patientPhone":
          aValue = a.patientPhone || "";
          bValue = b.patientPhone || "";
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
        apt.patientName,
        apt.patientPhone,
        apt.patientEmail,
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
    status
      .toLowerCase()
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");

  const getStatusBadge = (status) => {
    const badges = {
      PAYMENT_PENDING: "bg-amber-100 text-amber-800",
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
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  const timeoutDurationLabel =
    autoTimeoutMinutes >= 60
      ? `${autoTimeoutMinutes / 60}h`
      : `${autoTimeoutMinutes}m`;
  const isTimeoutEnabled = autoTimeoutMinutes > 0;

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
        <PageHeader
          title="My Appointments"
          actions={
            <div className="hidden">
              {
                <button
                  onClick={() =>
                    navigate(
                      isAssistantMode
                        ? "/assistant/live-queue"
                        : "/doctor/live-queue",
                    )
                  }
                  className="inline-flex items-center gap-1.5 font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-center leading-tight transition-colors text-xs sm:text-sm border bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Live Queue
                  {todayQueueCount > 0 ? (
                    <span className="text-xs rounded-full px-1.5 py-0.5 leading-none bg-primary-100 text-primary-700">
                      {todayQueueCount}
                    </span>
                  ) : null}
                </button>
              }
              {
                <button
                  onClick={() => setAutoTimeoutModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 border font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-center leading-tight transition-colors text-xs sm:text-sm ${
                    isTimeoutEnabled
                      ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  }`}
                >
                  <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {isTimeoutEnabled
                    ? `Time Out: ${timeoutDurationLabel}`
                    : "Time Out"}
                </button>
              }
            </div>
          }
        />

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
                    className="fixed w-[min(92vw,22rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-40 p-3 space-y-3"
                    style={{
                      top: `${mobileSettingsPosition.top}px`,
                      left: `${mobileSettingsPosition.left}px`,
                    }}
                  >
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
                          <option value="patientName">Patient name</option>
                          <option value="appointmentDate">
                            Appointment date
                          </option>
                          <option value="appointmentType">Type</option>
                          <option value="status">Status</option>
                          <option value="payment">Payment</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setSortConfig((prev) => ({
                              key: prev.key,
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
                              key: prev.key,
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

              {
                <button
                  onClick={() =>
                    navigate(
                      isAssistantMode
                        ? "/assistant/live-queue"
                        : "/doctor/live-queue",
                    )
                  }
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
              }

              {
                <button
                  onClick={() => setAutoTimeoutModalOpen(true)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-2 text-[11px] font-semibold leading-tight transition-colors sm:text-xs ${
                    isTimeoutEnabled
                      ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  }`}
                >
                  <Timer className="h-3.5 w-3.5" />
                  {isTimeoutEnabled
                    ? `Time Out: ${timeoutDurationLabel}`
                    : "Time Out"}
                </button>
              }
            </div>
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <PageEmptyState
            icon={Calendar}
            title={`No ${filter !== "all" ? filter : ""} appointments found`.trim()}
            description="Try another filter or check back later for schedule updates."
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="lg:hidden p-2.5 space-y-2 bg-gray-50/50">
              {filteredAppointments.map((appointment) => {
                const paymentInfo = getPaymentInfo(appointment);
                const isJoinableOnline =
                  !isAssistantMode &&
                  appointment.appointmentType === "ONLINE" &&
                  [
                    "PENDING",
                    "PAYMENT_PENDING",
                    "CONFIRMED",
                    "SCHEDULED",
                    "IN_PROGRESS",
                  ].includes(appointment.status);
                return (
                  <div
                    key={appointment.appointmentId}
                    className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {appointment.patientName || "Unknown patient"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {appointment.patientPhone || "N/A"}
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
                      <div>
                        <span className="inline-flex px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                          {appointment.serialNumber != null
                            ? `#${appointment.serialNumber}`
                            : "Not assigned"}
                        </span>
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
                      {isJoinableOnline && (
                        <button
                          onClick={() =>
                            handleJoinConsultation(appointment.appointmentId)
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join
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
                      onClick={() => handleSort("patientName")}
                    >
                      <div className="flex items-center gap-2">
                        Patient
                        {sortConfig.key === "patientName" && (
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
                          {appointment.patientName || "Unknown patient"}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {appointment.patientPhone || "N/A"}
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
                    {detailsModal.appointment.patientName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {detailsModal.appointment.patientEmail ||
                      "Email not available"}
                    {detailsModal.appointment.patientPhone
                      ? ` · ${detailsModal.appointment.patientPhone}`
                      : ""}
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
                          {detailsModal.appointment.serialNumber ??
                            "Not assigned"}
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
                  const isPaymentPending =
                    detailsModal.appointment.status === "PAYMENT_PENDING";
                  const isConfirmable = ["PENDING"].includes(
                    detailsModal.appointment.status,
                  );
                  const isRejectablePending =
                    detailsModal.appointment.status === "PENDING" ||
                    detailsModal.appointment.status === "PAYMENT_PENDING";
                  const isCancellable = [
                    "CONFIRMED",
                    "SCHEDULED",
                    "IN_PROGRESS",
                    "PENDING",
                  ].includes(detailsModal.appointment.status);
                  const isJoinableOnline =
                    !isAssistantMode &&
                    !isPaymentPending &&
                    detailsModal.appointment.appointmentType === "ONLINE" &&
                    [
                      "PENDING",
                      "PAYMENT_PENDING",
                      "CONFIRMED",
                      "SCHEDULED",
                      "IN_PROGRESS",
                    ].includes(detailsModal.appointment.status);
                  const isConsultationActionable =
                    !isAssistantMode &&
                    !isPaymentPending &&
                    !["CANCELLED", "REJECTED"].includes(
                      detailsModal.appointment.status,
                    );
                  const canManageAppointment = true;

                  if (
                    !isJoinableOnline &&
                    !isConsultationActionable &&
                    !isConfirmable &&
                    !isRejectablePending &&
                    !isCancellable
                  ) {
                    return null;
                  }

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {isConsultationActionable && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenOfflineActions(
                              detailsModal.appointment.appointmentId,
                              "documents",
                            )
                          }
                          className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Share2 className="w-4 h-4" />
                          Access Docs
                        </button>
                      )}
                      {isConsultationActionable && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/doctor/appointments/${detailsModal.appointment.appointmentId}/prescription`,
                              {
                                state: {
                                  from: `${location.pathname}${location.search}`,
                                },
                              },
                            )
                          }
                          className="inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Pill className="w-4 h-4" />
                          Prescription
                        </button>
                      )}
                      {isJoinableOnline && (
                        <button
                          type="button"
                          onClick={() =>
                            handleJoinConsultation(
                              detailsModal.appointment.appointmentId,
                            )
                          }
                          className="inline-flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Video className="w-4 h-4" />
                          Join Consultation
                        </button>
                      )}
                      {canManageAppointment &&
                        detailsModal.appointment.status ===
                          "PAYMENT_PENDING" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleConfirmPayment(
                                detailsModal.appointment.appointmentId,
                              )
                            }
                            disabled={
                              confirmingPaymentId ===
                              detailsModal.appointment.appointmentId
                            }
                            className="inline-flex items-center gap-2 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                          >
                            <Check className="w-4 h-4" />
                            Confirm Payment
                          </button>
                        )}
                      {canManageAppointment && isConfirmable && (
                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmAppointment(
                              detailsModal.appointment.appointmentId,
                            )
                          }
                          disabled={
                            confirmingAppointmentId ===
                            detailsModal.appointment.appointmentId
                          }
                          className="inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Check className="w-4 h-4" />
                          Confirm Appointment
                        </button>
                      )}
                      {canManageAppointment && isRejectablePending && (
                        <button
                          type="button"
                          onClick={() => {
                            setDetailsModal({
                              show: false,
                              appointment: null,
                            });
                            setRejectModal({
                              show: true,
                              appointmentId:
                                detailsModal.appointment.appointmentId,
                            });
                          }}
                          className="inline-flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <CircleX className="w-4 h-4" />
                          Reject Appointment
                        </button>
                      )}
                      {canManageAppointment && isCancellable && (
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
                          className="inline-flex items-center gap-2 bg-gray-700 text-white hover:bg-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <X className="w-4 h-4" />
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

        {autoTimeoutModalOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Auto Session Timeout
                </h2>
                <button
                  onClick={() => setAutoTimeoutModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                Set one global timeout in minutes for all sessions. If not ended
                manually, appointments will auto-end after this duration from
                their appointment start time.
              </p>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Timeout in minutes
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={autoTimeoutMinutes}
                onChange={(e) => {
                  const nextValue = Number(e.target.value);
                  setAutoTimeoutMinutes(
                    Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0,
                  );
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter minutes, or 0 to turn off"
              />

              <p className="text-xs text-gray-500 mt-2">
                Examples: 30 for half an hour, 60 for one hour, 120 for two
                hours.
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setAutoTimeoutModalOpen(false)}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

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

        {rejectModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Reject Appointment
                </h2>
                <button
                  onClick={() => {
                    setRejectModal({ show: false, appointmentId: null });
                    setRejectReason("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 mb-4">
                Please provide a reason for rejecting this appointment request:
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason (e.g., not available, schedule conflict)..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                rows="4"
              />

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setRejectModal({ show: false, appointmentId: null });
                    setRejectReason("");
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={rejecting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectAppointment}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                  disabled={rejecting}
                >
                  {rejecting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorMyAppointments;
