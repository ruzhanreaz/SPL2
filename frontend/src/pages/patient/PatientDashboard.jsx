import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import {
  Bell,
  Calendar,
  Clock3,
  Edit2,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { appointmentAPI, notificationAPI } from "../../utils/api";
import LiveQueueWidget from "../../components/LiveQueueWidget";

const ACTIVE_TODAY_STATUSES = new Set(["PENDING", "CONFIRMED", "IN_PROGRESS"]);
const UPCOMING_STATUSES = new Set([
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

const PatientDashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      appointmentAPI.getPatientAppointments(token),
      notificationAPI.getUnreadCount(token),
    ])
      .then(([appointmentData, unreadCount]) => {
        setAppointments(Array.isArray(appointmentData) ? appointmentData : []);
        setUnreadNotifications(Number(unreadCount) || 0);
      })
      .catch(() => {
        setAppointments([]);
        setUnreadNotifications(0);
      });
  }, [token, today]);

  const todayApts = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.appointmentDate === today && ACTIVE_TODAY_STATUSES.has(a.status),
      ),
    [appointments, today],
  );
  const upcomingCount = useMemo(
    () =>
      appointments.filter(
        (a) =>
          UPCOMING_STATUSES.has(a.status) && String(a.appointmentDate) >= today,
      ).length,
    [appointments, today],
  );
  const pendingCount = useMemo(
    () =>
      appointments.filter(
        (a) => a.status === "PENDING" || a.status === "PAYMENT_PENDING",
      ).length,
    [appointments],
  );
  const completedTodayCount = useMemo(
    () =>
      appointments.filter(
        (a) => a.appointmentDate === today && a.status === "COMPLETED",
      ).length,
    [appointments, today],
  );
  const todayActivity = useMemo(
    () =>
      appointments
        .filter((a) => a.appointmentDate === today)
        .sort(
          (left, right) =>
            new Date(
              `${left.appointmentDate}T${left.appointmentTime || "00:00:00"}`,
            ).getTime() -
            new Date(
              `${right.appointmentDate}T${right.appointmentTime || "00:00:00"}`,
            ).getTime(),
        )
        .slice(0, 5),
    [appointments, today],
  );

  const nextAppointment = todayActivity[0] || null;
  const queueAppointment = todayApts[0] || null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Welcome, {user?.firstName}
            </h1>
            <p className="text-gray-500 mt-1">
              Track your care journey and appointments.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/patient/find-doctor")}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition flex items-center gap-2"
            >
              <Stethoscope className="w-4 h-4 text-primary-600" /> Find Doctor
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
              label: "Active Today",
              val: todayApts.length,
              icon: Calendar,
              color: "text-indigo-600",
            },
            {
              label: "Upcoming",
              val: upcomingCount,
              icon: Clock3,
              color: "text-amber-600",
            },
            {
              label: "Pending",
              val: pendingCount,
              icon: Clock3,
              color: "text-blue-600",
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

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Appointments */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Today&apos;s Appointments
              </h2>
              <button
                onClick={() => navigate("/patient/appointments")}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden divide-y divide-gray-100">
              {todayActivity.length > 0 ? (
                <>
                  {nextAppointment && (
                    <div className="p-6 bg-indigo-50/50">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">
                        Next
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            Dr.{" "}
                            {nextAppointment.doctorName || "Assigned Doctor"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatTime(nextAppointment.appointmentTime)} ·{" "}
                            {nextAppointment.appointmentType}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-white border border-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                          {formatStatus(nextAppointment.status)}
                        </span>
                      </div>
                    </div>
                  )}
                  {todayActivity.map((apt) => (
                    <div
                      key={apt.appointmentId}
                      className="p-6 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          Dr. {apt.doctorName || "Assigned Doctor"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatTime(apt.appointmentTime)} ·{" "}
                          {apt.appointmentType}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        {formatStatus(apt.status)}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  No appointments scheduled for today.
                </div>
              )}
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
              <h3 className="font-semibold text-gray-900 mb-4">Live Queue</h3>
              {queueAppointment ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">
                      Dr. {queueAppointment.doctorName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Serial #{queueAppointment.serialNumber ?? "-"} ·{" "}
                      {queueAppointment.appointmentType}
                    </p>
                  </div>
                  <LiveQueueWidget
                    doctorId={queueAppointment.doctorId}
                    date={today}
                    role="patient"
                    patientSerialNumber={queueAppointment.serialNumber}
                    compact={true}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No active queue for today.
                </p>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
              <h3 className="font-semibold text-gray-900 mb-4">
                Care Snapshot
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Completed today", value: completedTodayCount },
                  { label: "Pending actions", value: pendingCount },
                  { label: "Upcoming visits", value: upcomingCount },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="font-semibold text-gray-900">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate("/patient/telemedicine")}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition"
              >
                Open Consultations
              </button>
              <button
                onClick={() => navigate("/notifications")}
                className="w-full py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Check Notifications
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
