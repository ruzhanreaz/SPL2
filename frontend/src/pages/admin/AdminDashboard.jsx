import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import { adminAPI, complaintAPI } from "../../utils/api";
import {
  AlertTriangle,
  Calendar,
  Wallet,
  FileBarChart,
  Clock3,
  RefreshCcw
} from "lucide-react";

const AdminDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dailyReport, setDailyReport] = useState(null);
  const [complaintStats, setComplaintStats] = useState({ total: 0, pending: 0, reviewed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [reportData, statsData] = await Promise.all([
        adminAPI.getDailyReport(null, token),
        complaintAPI.getStats(token),
      ]);
      setDailyReport(reportData);
      setComplaintStats(statsData);
    } catch {
      setError("Failed to load administrative data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <DashboardLayout><PageLoadingState /></DashboardLayout>;
  if (error) return <DashboardLayout><PageErrorState message={error} onRetry={fetchData} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 pb-12">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Overview</h1>
            <p className="text-gray-500 mt-1">System status and administrative operations.</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pending Apps", val: dailyReport?.pendingAppointments || 0, icon: Clock3, color: "text-amber-600" },
            { label: "Active Payments", val: dailyReport?.activePayments || 0, icon: Wallet, color: "text-emerald-600" },
            { label: "Pending Issues", val: complaintStats?.pending || 0, icon: AlertTriangle, color: "text-red-600" },
            { label: "System Reports", val: dailyReport?.totalReports || 0, icon: FileBarChart, color: "text-indigo-600" },
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Daily System Summary</h2>
              {/* Add your detailed reports or charts here */}
              <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-100 rounded-xl">
                Detailed system reports content area.
              </div>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200/60">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-3">
                <button onClick={() => navigate("/admin/complaints")} className="w-full py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition text-left px-4">
                  Review Complaints ({complaintStats?.pending ?? 0})
                </button>
                <button onClick={() => navigate("/admin/appointments")} className="w-full py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition text-left px-4">
                  Pending Appointments ({dailyReport?.pendingAppointments ?? 0})
                </button>
                <button onClick={() => navigate("/admin/payments")} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-left px-4">
                  Review Payments
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;