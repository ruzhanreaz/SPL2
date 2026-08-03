import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { adminAPI } from "../../utils/api";
import { adminUi } from "../../constants/adminUi";
import { SlidersHorizontal } from "lucide-react";

export default function AdminAppointment() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(false);
  const filterBarRef = useRef(null);

  const statusSummary = useMemo(() => {
    return appointments.reduce((acc, appointment) => {
      const key = appointment.status || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [appointments]);

  useEffect(() => {
    if (!token) return;

    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const data = await adminAPI.getAllAppointments(token);
        if (!ignore) {
          setAppointments(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (e) {
        if (!ignore) setError(e.message || "Failed to load appointments");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [token]);

  const visibleAppointments = appointments.filter((appointment) => {
    const statusMatch =
      statusFilter === "ALL" || appointment.status === statusFilter;
    const q = query.toLowerCase().trim();
    const textMatch =
      !q ||
      appointment.patientName?.toLowerCase().includes(q) ||
      appointment.doctorName?.toLowerCase().includes(q) ||
      appointment.appointmentType?.toLowerCase().includes(q);
    return statusMatch && textMatch;
  });

  const filterOptions = useMemo(
    () => [
      { key: "ALL", label: `All: ${appointments.length}` },
      ...Object.entries(statusSummary).map(([status, count]) => ({
        key: status,
        label: `${status}: ${count}`,
      })),
    ],
    [appointments.length, statusSummary],
  );

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

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 relative">
          <div>
            <h1 className="app-page-title">App Appointments</h1>
          </div>
        </div>

        <div
          ref={filterBarRef}
          className="w-full mb-4 md:mb-6 flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search appointments..."
              className={adminUi.input}
            />
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => !prev)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                statusFilter !== "ALL"
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              aria-label="Open appointment filters"
              title="Filter appointments"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {openDropdown && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,20rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Appointment Filters
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option.key);
                        setOpenDropdown(false);
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        statusFilter === option.key
                          ? "border-primary-300 bg-primary-50 text-primary-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading appointments...</div>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto max-h-[500px] overflow-y-auto">
              {visibleAppointments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {query || statusFilter !== "ALL"
                    ? "No appointments match your filters"
                    : "No appointments found"}
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAppointments.map((appointment) => (
                      <tr
                        key={appointment.appointmentId}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {appointment.appointmentDate || "-"}{" "}
                          {appointment.appointmentTime || ""}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {appointment.patientName || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {appointment.doctorName || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {appointment.appointmentType || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                            {appointment.status || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="md:hidden space-y-2">
              {visibleAppointments.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 text-center text-sm text-gray-500">
                  {query || statusFilter !== "ALL"
                    ? "No appointments match your filters"
                    : "No appointments found"}
                </div>
              ) : (
                visibleAppointments.map((appointment) => (
                  <div
                    key={appointment.appointmentId}
                    className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {appointment.patientName || "-"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Dr. {appointment.doctorName || "-"}
                        </p>
                      </div>
                      <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700 text-center leading-tight">
                        {appointment.status || "-"}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-700">
                      <p>
                        <span className="font-semibold text-gray-600">
                          Date:
                        </span>{" "}
                        {appointment.appointmentDate || "-"}{" "}
                        {appointment.appointmentTime || ""}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">
                          Type:
                        </span>{" "}
                        {appointment.appointmentType || "-"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
