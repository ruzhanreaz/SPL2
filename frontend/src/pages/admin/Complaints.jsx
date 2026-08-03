import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { complaintAPI } from "../../utils/api";
import DashboardLayout from "../../components/DashboardLayout";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { uiSizes } from "../../constants/uiSizes";

export default function AdminComplaints() {
  const { token } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const filterBarRef = useRef(null);

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await complaintAPI.getAllComplaints(token);
      setComplaints(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch complaints");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Handle click outside for mobile filter dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterBarRef.current &&
        !filterBarRef.current.contains(event.target)
      ) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filterCounts = useMemo(() => {
    return {
      ALL: complaints.length,
      PENDING: complaints.filter((c) => c.status === "PENDING").length,
      REVIEWED: complaints.filter((c) => c.status === "REVIEWED").length,
    };
  }, [complaints]);

  const filtered = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesFilter =
        activeFilter === "ALL" || complaint.status === activeFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        complaint.patientName?.toLowerCase().includes(q) ||
        complaint.title?.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [complaints, activeFilter, search]);

  const markReviewed = async (id) => {
    if (!token) return;
    try {
      const updated = await complaintAPI.markReviewed(id, token);
      setComplaints((prev) =>
        prev.map((c) => (c.complaintId === id ? updated : c)),
      );
    } catch (err) {
      setError(err.message || "Failed to mark as reviewed");
    }
  };

  const deleteComplaint = async (id) => {
    if (!token) return;
    try {
      await complaintAPI.deleteComplaint(id, token);
      setComplaints((prev) => prev.filter((c) => c.complaintId !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message || "Failed to delete complaint");
    }
  };

  const filterOptions = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "REVIEWED", label: "Reviewed" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 to-white p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Complaint Management
              </h1>
              <p className="text-sm text-gray-600">
                Review and resolve patient complaints from one place.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {filterCounts.ALL}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                Pending
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-800">
                {filterCounts.PENDING}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Reviewed
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-800">
                {filterCounts.REVIEWED}
              </p>
            </div>
          </div>
        </div>

        <div ref={filterBarRef} className="w-full flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by patient or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setOpenDropdown((prev) => !prev)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                activeFilter !== "ALL"
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              aria-label="Open complaint filters"
              title="Filter complaints"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {openDropdown && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,20rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Complaint Filters
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        setActiveFilter(f.key);
                        setOpenDropdown(false);
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        activeFilter === f.key
                          ? "border-primary-300 bg-primary-50 text-primary-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {f.label} ({filterCounts[f.key]})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setActiveFilter(option.key)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === option.key
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option.label} ({filterCounts[option.key]})
            </button>
          ))}
        </div>

        {error && (
          <div
            className={`${uiSizes.alertMd} border-red-100 bg-red-50 text-red-700`}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">
            Loading complaints...
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${uiSizes.cardMd} text-center py-10`}>
            <p className="text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {filtered.map((complaint) => (
              <div
                key={complaint.complaintId}
                className="p-4 sm:p-5 flex flex-col gap-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                      {complaint.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 break-words">
                      {complaint.patientName} • {complaint.patientEmail}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatDate(complaint.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      complaint.status === "REVIEWED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {complaint.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      setExpanded(
                        expanded === complaint.complaintId
                          ? null
                          : complaint.complaintId,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200"
                  >
                    <Eye className="w-3 h-3" />{" "}
                    {expanded === complaint.complaintId ? "Collapse" : "View"}
                  </button>
                  {complaint.status === "PENDING" && (
                    <button
                      onClick={() => markReviewed(complaint.complaintId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-medium hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Mark Reviewed
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(complaint.complaintId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-red-200 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>

                {expanded === complaint.complaintId && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                    {complaint.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">
              Delete Complaint?
            </h3>
            <p className="text-gray-600 text-sm mb-6 text-center">
              This will permanently delete the complaint. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteComplaint(confirmDeleteId)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
