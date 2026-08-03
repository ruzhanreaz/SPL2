import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { complaintAPI } from "../../utils/api";
import DashboardLayout from "../../components/DashboardLayout";
import {
  AlertCircle,
  MessageSquare,
  Plus,
  Minus,
  SendHorizontal,
} from "lucide-react";

// Standardized UI components
import PageHeader from "../../components/ui/PageHeader";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import PageEmptyState from "../../components/ui/PageEmptyState";

export default function PatientComplaints() {
  const { token } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const fetchComplaints = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await complaintAPI.getMyComplaints(token);
      setComplaints(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch complaints");
      console.error("Error fetching complaints:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (!formData.title.trim() || !formData.message.trim()) {
      setError("Title and message are required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const result = await complaintAPI.submitComplaint(
        formData.title,
        formData.message,
        token,
      );
      setComplaints((prev) => [result, ...prev]);
      setFormData({ title: "", message: "" });
      setSuccess("Your complaint has been submitted to admin successfully.");
      setShowForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit complaint");
      console.error("Error submitting complaint:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const pendingCount = complaints.filter((c) => c.status === "PENDING").length;
  const reviewedCount = complaints.filter(
    (c) => c.status === "REVIEWED",
  ).length;

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoadingState message="Loading complaints..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageErrorState message={error} onRetry={fetchComplaints} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Complaints and Feedback"
        actions={
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-full transition-colors text-sm"
          >
            {showForm ? (
              <Minus className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {showForm ? "Hide Form" : "New Complaint"}
          </button>
        }
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {complaints.length}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Pending
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-800">
              {pendingCount}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Reviewed
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {reviewedCount}
            </p>
          </div>
        </div>

        {success && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Submit a Complaint
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Include a clear subject and details so admin can investigate
              faster.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                  maxLength={150}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  required
                  maxLength={2000}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-full text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50"
                >
                  <SendHorizontal className="w-4 h-4" />
                  {submitting ? "Submitting..." : "Submit Complaint"}
                </button>
              </div>
            </form>
          </div>
        )}

        {complaints.length === 0 ? (
          <PageEmptyState
            icon={MessageSquare}
            title="No complaints yet"
            description="You haven't submitted any complaints. Use the 'New Complaint' button to reach out to admin."
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {complaints.map((complaint) => (
              <div key={complaint.complaintId} className="p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {complaint.title}
                  </h3>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      complaint.status === "REVIEWED"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {complaint.status === "REVIEWED" ? "Reviewed" : "Pending"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {complaint.message}
                </p>
                <p className="text-xs text-gray-400">
                  Ticket #{complaint.complaintId} • Submitted{" "}
                  {formatDate(complaint.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
