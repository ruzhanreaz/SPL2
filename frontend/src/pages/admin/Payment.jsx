import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { adminAPI } from "../../utils/api";
import { adminUi } from "../../constants/adminUi";
import { SlidersHorizontal } from "lucide-react";

export default function AdminPayment() {
  const { token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(false);
  const filterBarRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const data = await adminAPI.getAllPayments(token);
        if (!ignore) {
          setPayments(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (e) {
        if (!ignore) setError(e.message || "Failed to load payments");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [token]);

  const totalRevenue = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments],
  );

  const statusSummary = useMemo(() => {
    return payments.reduce((acc, p) => {
      const s = p.status || "UNKNOWN";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
  }, [payments]);

  const visiblePayments = payments.filter((p) => {
    const statusMatch = statusFilter === "ALL" || p.status === statusFilter;
    const q = query.toLowerCase().trim();
    const textMatch =
      !q ||
      p.transactionId?.toLowerCase().includes(q) ||
      p.patientName?.toLowerCase().includes(q) ||
      p.doctorName?.toLowerCase().includes(q);
    return statusMatch && textMatch;
  });

  const filterOptions = useMemo(
    () => [
      { key: "ALL", label: `All: ${payments.length}` },
      ...Object.entries(statusSummary).map(([status, count]) => ({
        key: status,
        label: `${status}: ${count}`,
      })),
    ],
    [payments.length, statusSummary],
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
            <h1 className="app-page-title">App Payments</h1>
          </div>
        </div>

        <div
          ref={filterBarRef}
          className="w-full mb-4 md:mb-6 flex flex-wrap items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transaction, patient, doctor..."
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
              aria-label="Open payment filters"
              title="Filter payments"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {openDropdown && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,20rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Payment Filters
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

          <div className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 whitespace-nowrap">
            BDT {totalRevenue.toFixed(2)}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading payments...</div>
          </div>
        ) : (
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto max-h-[500px] overflow-y-auto">
            {visiblePayments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {query || statusFilter !== "ALL"
                  ? "No payments match your filters"
                  : "No payments found"}
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Doctor</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayments.map((payment) => (
                    <tr
                      key={payment.appointmentId}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {payment.transactionId || "N/A"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {payment.patientName || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {payment.doctorName || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {payment.amount ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                          {payment.status || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && (
          <div className="md:hidden rounded-lg border border-gray-200 bg-white shadow-sm p-4 text-center text-sm text-gray-500">
            Use a larger screen to browse the full payments table.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
