import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { Calendar, Clock3, Users, ArrowRight, ClipboardList, RefreshCcw } from "lucide-react";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import { assistantAPI, queueAPI } from "../../utils/api";

const ACTIVE_STATUSES = new Set(["PENDING", "CONFIRMED", "IN_PROGRESS"]);

const formatStatus = (status = "") =>
  status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const formatTime = (timeValue) => {
  if (!timeValue) return "Time TBD";
  const [hourPart, minutePart = "00"] = String(timeValue).split(":");
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return "Time TBD";
  const normalizedHour = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minutePart} ${suffix}`;
};

const AssistantDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [appData, queueData] = await Promise.all([
        assistantAPI.getDoctorAppointments(token),
        queueAPI.getAssistantTodayQueue(token),
      ]);
      setAppointments(Array.isArray(appData) ? appData : []);
      setQueue(queueData);
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeCount = useMemo(() => appointments.filter((a) => ACTIVE_STATUSES.has(a.status)).length, [appointments]);
  const pendingCount = useMemo(() => appointments.filter((a) => a.status === "PENDING").length, [appointments]);

  if (loading) return <DashboardLayout><PageLoadingState /></DashboardLayout>;
  if (error) return <DashboardLayout><PageErrorState message={error} onRetry={fetchData} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 pb-12">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Assistant Dashboard</h1>
            <p className="text-gray-500 mt-1">Managing clinic flow for {today}.</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <RefreshCcw className="w-4 h-4" /> Refresh Data
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Today", val: appointments.length, icon: Calendar, color: "text-indigo-600" },
            { label: "Active Appointments", val: activeCount, icon: Users, color: "text-blue-600" },
            { label: "Pending", val: pendingCount, icon: Clock3, color: "text-amber-600" },
            { label: "Current Queue", val: queue?.queue?.length || 0, icon: ClipboardList, color: "text-violet-600" }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <h3 className="text-3xl font-bold text-gray-900">{stat.val}</h3>
            </div>
          ))}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Today&apos;s Schedule</h2>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden divide-y divide-gray-100">
              {appointments.length > 0 ? appointments.map((apt) => (
                <div key={apt.appointmentId} className="p-5 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <p className="font-semibold text-gray-900">{apt.patientName}</p>
                    <p className="text-sm text-gray-500">{formatTime(apt.appointmentTime)} · Dr. {apt.doctorName}</p>
                  </div>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">{formatStatus(apt.status)}</span>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-500">No appointments found.</div>
              )}
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-3">
                <button onClick={() => navigate("/assistant/queue")} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">
                  Open Live Queue
                </button>
                <button onClick={() => navigate("/notifications")} className="w-full py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition">
                  Check Notifications
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AssistantDashboard;