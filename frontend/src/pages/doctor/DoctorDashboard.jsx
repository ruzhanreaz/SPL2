import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import { appointmentAPI, notificationAPI, queueAPI } from "../../utils/api";
import {
  Bell,
  Calendar,
  ClipboardList,
  Clock3,
  Edit2,
  Users,
  ArrowRight,
  X,
  Video,
  MapPin,
  Share2,
  Pill,
  Check,
  CircleX,
} from "lucide-react";
import LiveQueueWidget from "../../components/LiveQueueWidget";

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
]);

const formatStatus = (status = "") =>
  status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatTime = (timeValue) => {
  if (!timeValue) return "Time TBD";
  const [hourPart, minutePart = "00"] = String(timeValue).split(":");
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return "Time TBD";
  const normalizedHour = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minutePart} ${suffix}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getStatusBadge = (status) => {
  const badges = {
    PAYMENT_PENDING: "bg-amber-100 text-amber-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-green-100 text-green-800",
    SCHEDULED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
    COMPLETED: "bg-primary-100 text-primary-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    NO_SHOW: "bg-gray-100 text-gray-800",
  };
  return badges[status] || "bg-gray-100 text-gray-800";
};

const formatStatusLabel = (status) =>
  status
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const getPaymentInfo = (appointment) => {
  const isPaid = appointment?.status !== "PAYMENT_PENDING";
  const paidAt =
    appointment?.paidAt ||
    appointment?.paymentConfirmedAt ||
    appointment?.paymentDate ||
    appointment?.paymentCompletedAt ||
    (isPaid ? appointment?.updatedAt : null);

  return { isPaid, paidAt };
};

const DoctorDashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [queueSnapshot, setQueueSnapshot] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsModal, setDetailsModal] = useState({
    show: false,
    appointment: null,
  });
  const [cancelModal, setCancelModal] = useState({
    show: false,
    appointmentId: null,
  });
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [confirmingAppointmentId, setConfirmingAppointmentId] = useState(null);

  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [appData, count, qData] = await Promise.all([
          appointmentAPI.getDoctorAppointments(token),
          notificationAPI.getUnreadCount(token),
          queueAPI.getTodayQueue(token),
        ]);
        if (!mounted) return;
        setAppointments(Array.isArray(appData) ? appData : []);
        setUnreadNotifications(Number(count) || 0);
        setQueueSnapshot(qData || null);
      } catch (err) {
        if (mounted) setError(err?.message || "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleJoinConsultation = useCallback(
    (appointmentId) => {
      if (!appointmentId) return;
      navigate(`/doctor/telemedicine?appointmentId=${appointmentId}`);
    },
    [navigate],
  );

  const handleOpenOfflineActions = useCallback(
    (appointmentId, tab = "documents") => {
      if (!appointmentId) return;
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
    [location.pathname, location.search, navigate],
  );

  const handleCancelAppointment = useCallback(async () => {
    if (!cancelModal.appointmentId || !cancelReason.trim()) {
      toast.warning("Please provide a reason for cancellation");
      return;
    }

    setCancelling(true);
    try {
      await appointmentAPI.cancelAppointment(
        cancelModal.appointmentId,
        cancelReason,
        token,
      );
      toast.success("Appointment cancelled successfully");
      setCancelModal({ show: false, appointmentId: null });
      setCancelReason("");
      setDetailsModal({ show: false, appointment: null });
      // Refresh appointments
      const appData = await appointmentAPI.getDoctorAppointments(token);
      setAppointments(Array.isArray(appData) ? appData : []);
    } catch (err) {
      toast.error(err?.message || "Failed to cancel appointment");
    } finally {
      setCancelling(false);
    }
  }, [cancelModal.appointmentId, cancelReason, token, toast]);

  const handleConfirmAppointment = useCallback(
    async (appointmentId) => {
      if (!appointmentId) return;
      setConfirmingAppointmentId(appointmentId);
      try {
        await appointmentAPI.confirmAppointment(appointmentId, token);
        toast.success("Appointment confirmed successfully");
        // Refresh appointments
        const appData = await appointmentAPI.getDoctorAppointments(token);
        setAppointments(Array.isArray(appData) ? appData : []);
        setDetailsModal({ show: false, appointment: null });
      } catch (err) {
        toast.error(err?.message || "Failed to confirm appointment");
      } finally {
        setConfirmingAppointmentId(null);
      }
    },
    [token, toast],
  );

  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === today),
    [appointments, today],
  );
  const activeQueueCount = useMemo(
    () =>
      queueSnapshot?.queue?.filter((e) => ACTIVE_STATUSES.has(e.status))
        .length || 0,
    [queueSnapshot],
  );
  const upcoming = useMemo(
    () =>
      todayAppointments
        .filter((a) => ACTIVE_STATUSES.has(a.status))
        .sort((a, b) => a.appointmentTime?.localeCompare(b.appointmentTime))
        .slice(0, 5),
    [todayAppointments],
  );
  const doctorId = useMemo(() => user?.doctorId ?? null, [user?.doctorId]);

  if (loading)
    return (
      <DashboardLayout>
        <PageLoadingState />
      </DashboardLayout>
    );
  if (error)
    return (
      <DashboardLayout>
        <PageErrorState
          message={error}
          onRetry={() => window.location.reload()}
        />
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Welcome, Dr. {user?.firstName}
            </h1>
            <p className="text-gray-500 mt-1">
              Here is the status of your clinic today.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/doctor/schedule")}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              Schedule
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition"
            >
              Profile
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Today",
              val: todayAppointments.length,
              icon: Calendar,
              color: "text-indigo-600",
            },
            {
              label: "Active Queue",
              val: activeQueueCount,
              icon: Users,
              color: "text-blue-600",
            },
            {
              label: "Pending",
              val: todayAppointments.filter((a) => a.status === "PENDING")
                .length,
              icon: Clock3,
              color: "text-amber-600",
            },
            {
              label: "Alerts",
              val: unreadNotifications,
              icon: Bell,
              color: "text-violet-600",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <h3 className="text-3xl font-bold text-gray-900">{stat.val}</h3>
            </div>
          ))}
        </div>

        {/* Main Section: Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Appointments List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Upcoming Consultations
              </h2>
              <button
                onClick={() => navigate("/doctor/appointments")}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 divide-y divide-gray-100 overflow-hidden">
              {upcoming.length > 0 ? (
                upcoming.map((app) => (
                  <div
                    key={app.appointmentId}
                    onClick={() =>
                      setDetailsModal({ show: true, appointment: app })
                    }
                    className="p-5 flex items-center justify-between hover:bg-indigo-50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                        {app.patientName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {app.patientName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatTime(app.appointmentTime)} ·{" "}
                          {app.appointmentType}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      {formatStatus(app.status)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No appointments scheduled
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Queue & Actions */}
          <div className="space-y-6">
            {/* Live Queue Widget replaced Queue Control */}
            {doctorId && (
              <div className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
                <h3 className="font-semibold text-gray-900 mb-4 px-2">
                  Live Queue
                </h3>
                <LiveQueueWidget
                  doctorId={doctorId}
                  date={today}
                  role="doctor"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate("/doctor/telemedicine")}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition"
              >
                Start Consultation
              </button>
              <button
                onClick={() => navigate("/doctor/schedule")}
                className="w-full py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Manage Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Appointment Details Modal */}
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
                        <p className="text-xs text-gray-500">
                          Consultation Fee
                        </p>
                        <p className="font-semibold">
                          {detailsModal.appointment.consultationFee != null
                            ? `${detailsModal.appointment.consultationFee}`
                            : "N/A"}
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
                    <Clock3 className="w-4 h-4 text-gray-500" />
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
                  const isConfirmable = ["PENDING"].includes(
                    detailsModal.appointment.status,
                  );
                  const isCancellable = [
                    "CONFIRMED",
                    "SCHEDULED",
                    "IN_PROGRESS",
                    "PENDING",
                  ].includes(detailsModal.appointment.status);
                  const isJoinableOnline =
                    detailsModal.appointment.appointmentType === "ONLINE" &&
                    [
                      "PENDING",
                      "PAYMENT_PENDING",
                      "CONFIRMED",
                      "SCHEDULED",
                      "IN_PROGRESS",
                    ].includes(detailsModal.appointment.status);
                  const isConsultationActionable = ![
                    "CANCELLED",
                    "REJECTED",
                  ].includes(detailsModal.appointment.status);

                  if (
                    !isJoinableOnline &&
                    !isConsultationActionable &&
                    !isConfirmable &&
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
                          onClick={() => {
                            handleJoinConsultation(
                              detailsModal.appointment.appointmentId,
                            );
                          }}
                          className="inline-flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm text-center leading-tight"
                        >
                          <Video className="w-4 h-4" />
                          Join Consultation
                        </button>
                      )}
                      {isConfirmable && (
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
                      {isCancellable && (
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
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {cancelModal.show && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">
                  Cancel Appointment
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Cancellation
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please provide a reason..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => {
                    setCancelModal({ show: false, appointmentId: null });
                    setCancelReason("");
                  }}
                  disabled={cancelling}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Discard
                </button>
                <button
                  onClick={handleCancelAppointment}
                  disabled={cancelling || !cancelReason.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {cancelling ? "Cancelling..." : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
