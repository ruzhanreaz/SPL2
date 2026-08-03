import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { adminAPI, doctorAPI } from "../../utils/api";
import {
  BarChart3,
  CalendarDays,
  FileText,
  Layers3,
  Search,
  Users2,
} from "lucide-react";
import { adminUi } from "../../constants/adminUi";

export default function DailyReports() {
  const { token } = useAuth();
  const [reportDate, setReportDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const selectedDoctor = useMemo(
    () =>
      doctorOptions.find(
        (doctor) => String(doctor.doctorId) === String(selectedDoctorId),
      ) || null,
    [doctorOptions, selectedDoctorId],
  );

  const loadReport = useCallback(
    async (date, doctorId) => {
      try {
        setLoading(true);
        const data = await adminAPI.getDailyReport(date, token, doctorId);
        setReport(data);
        setError("");
      } catch (e) {
        setError(e.message || "Failed to fetch report");
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const loadDoctorOptions = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingDoctors(true);
      const doctors = await doctorAPI.getAllDoctors(token);
      const normalized = Array.isArray(doctors) ? doctors : [];
      const activeDoctors = normalized.filter((doctor) => doctor?.isActive);
      setDoctorOptions(activeDoctors);
    } catch (e) {
      setDoctorOptions([]);
      setError(e.message || "Failed to load doctors");
    } finally {
      setLoadingDoctors(false);
    }
  }, [token]);

  useEffect(() => {
    loadDoctorOptions();
  }, [loadDoctorOptions]);

  useEffect(() => {
    if (selectedDoctorId || doctorOptions.length === 0) return;
    setSelectedDoctorId(String(doctorOptions[0].doctorId));
  }, [doctorOptions, selectedDoctorId]);

  useEffect(() => {
    if (!token) return;
    if (!selectedDoctorId) {
      setReport(null);
      setLoading(false);
      return;
    }
    loadReport(reportDate, selectedDoctorId);
  }, [loadReport, reportDate, selectedDoctorId, token]);

  const downloadPdf = async () => {
    try {
      setPdfLoading(true);
      const blob = await adminAPI.getDailyReportPdf(
        reportDate,
        token,
        selectedDoctorId,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileDoctorId = selectedDoctor?.doctorId || selectedDoctorId;
      a.download = `daily-report-${reportDate}-doctor-${fileDoctorId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Failed to download PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const doctorWiseReport = useMemo(
    () =>
      Array.isArray(report?.doctorWiseReport) ? report.doctorWiseReport : [],
    [report],
  );

  const sectionTabs = [
    {
      key: "overview",
      label: "Overview",
      icon: Layers3,
      description: "Daily summary at a glance",
    },
    {
      key: "doctor-wise",
      label: "Doctor-wise",
      icon: Users2,
      description: "Performance by doctor",
    },
    {
      key: "financial",
      label: "Financial",
      icon: BarChart3,
      description: "Revenue and collection",
    },
    {
      key: "system",
      label: "System",
      icon: FileText,
      description: "Platform totals",
    },
  ];

  const summaryCards = [
    { title: "Total Appointments", value: report?.totalAppointments },
    { title: "Confirmed", value: report?.confirmedAppointments },
    { title: "Pending", value: report?.pendingAppointments },
    { title: "Completed", value: report?.completedAppointments },
    { title: "Cancelled", value: report?.cancelledAppointments },
    { title: "No Show", value: report?.noShowAppointments },
    { title: "Online", value: report?.onlineAppointments },
    { title: "In-person", value: report?.inPersonAppointments },
  ];

  const filteredDoctorWiseReport = useMemo(() => {
    const query = doctorSearch.toLowerCase().trim();
    if (!query) {
      return doctorWiseReport;
    }

    return doctorWiseReport.filter((doctorRow) => {
      const name = (doctorRow.doctorName || "").toLowerCase();
      const specialization = (doctorRow.specialization || "").toLowerCase();
      return name.includes(query) || specialization.includes(query);
    });
  }, [doctorSearch, doctorWiseReport]);

  const sectionTitle =
    sectionTabs.find((tab) => tab.key === activeSection)?.label || "Overview";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="mb-4 md:mb-6 flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="app-page-title">App Daily Reports</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className={adminUi.input}
                disabled={loadingDoctors || doctorOptions.length === 0}
              >
                {doctorOptions.length === 0 ? (
                  <option value="">No active doctors</option>
                ) : (
                  doctorOptions.map((doctor) => (
                    <option key={doctor.doctorId} value={doctor.doctorId}>
                      Dr. {doctor.firstName} {doctor.lastName}
                      {doctor.specialization
                        ? ` (${doctor.specialization})`
                        : ""}
                    </option>
                  ))
                )}
              </select>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={adminUi.input}
              />
              <button
                onClick={() => loadReport(reportDate, selectedDoctorId)}
                disabled={loading || !selectedDoctorId}
                className={`${adminUi.actionButton} bg-primary-600 text-white hover:bg-primary-700`}
              >
                <CalendarDays className="h-4 w-4" />
                Load
              </button>
              <button
                onClick={downloadPdf}
                disabled={pdfLoading || loading || !report || !selectedDoctorId}
                className={`${adminUi.actionButton} bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <FileText className="h-4 w-4" />
                {pdfLoading ? "Generating PDF..." : "Download PDF"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sectionTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSection(tab.key)}
                  className={`${adminUi.capsuleButton} ${
                    isActive ? adminUi.capsuleActive : adminUi.capsuleIdle
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading report...</div>
          </div>
        ) : report ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {sectionTitle}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {
                      sectionTabs.find((tab) => tab.key === activeSection)
                        ?.description
                    }
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                    {report.date}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {selectedDoctor
                      ? `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`
                      : report?.selectedDoctorName || "Selected Doctor"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {doctorWiseReport.length} doctors
                  </span>
                </div>
              </div>

              {activeSection === "overview" && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {summaryCards.map((card) => (
                      <Card
                        key={card.title}
                        title={card.title}
                        value={card.value}
                      />
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 lg:col-span-2">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-gray-900">
                            Quick Snapshot
                          </h3>
                          <p className="text-sm text-gray-500">
                            Capsule-style highlights for the selected day.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                          {report.date}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <MetricCapsule
                          label="Revenue"
                          value={`BDT ${Number(report.estimatedRevenue || 0).toFixed(2)}`}
                          tone="emerald"
                        />
                        <MetricCapsule
                          label="Collection"
                          value={`${report.collectionRate || 0}%`}
                          tone="blue"
                        />
                        <MetricCapsule
                          label="Doctors"
                          value={report.totalDoctors}
                          tone="slate"
                        />
                        <MetricCapsule
                          label="Assistants"
                          value={report.totalAssistants}
                          tone="slate"
                        />
                        <MetricCapsule
                          label="Patients"
                          value={report.totalUsers}
                          tone="slate"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                      <h3 className="text-base font-bold text-gray-900">
                        Consultation Mix
                      </h3>
                      <p className="text-sm text-gray-500">
                        Distribution by appointment type.
                      </p>
                      <div className="mt-4 space-y-3">
                        <ProgressRow
                          label="Online"
                          value={report.onlineAppointments || 0}
                          total={report.totalAppointments || 0}
                          tone="blue"
                        />
                        <ProgressRow
                          label="In-person"
                          value={report.inPersonAppointments || 0}
                          total={report.totalAppointments || 0}
                          tone="emerald"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "doctor-wise" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={doctorSearch}
                        onChange={(e) => setDoctorSearch(e.target.value)}
                        placeholder="Search doctor or specialization..."
                        className="w-full rounded-full border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                    </div>
                  </div>

                  {filteredDoctorWiseReport.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {filteredDoctorWiseReport.map((doctorRow) => (
                        <div
                          key={doctorRow.doctorId ?? doctorRow.doctorName}
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {doctorRow.doctorName || "Unassigned Doctor"}
                              </p>
                              <p className="text-sm text-gray-500">
                                {doctorRow.specialization || "-"}
                              </p>
                            </div>
                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                              {doctorRow.totalAppointments || 0} visits
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <MetricCapsule
                              label="Confirmed"
                              value={doctorRow.confirmedAppointments || 0}
                              tone="blue"
                              compact
                            />
                            <MetricCapsule
                              label="Completed"
                              value={doctorRow.completedAppointments || 0}
                              tone="emerald"
                              compact
                            />
                            <MetricCapsule
                              label="Pending"
                              value={doctorRow.pendingAppointments || 0}
                              tone="slate"
                              compact
                            />
                            <MetricCapsule
                              label="Revenue"
                              value={`BDT ${Number(doctorRow.estimatedRevenue || 0).toFixed(2)}`}
                              tone="amber"
                              compact
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                      No doctor-wise appointments found for this date.
                    </div>
                  )}
                </div>
              )}

              {activeSection === "financial" && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:col-span-2">
                    <h3 className="text-base font-bold text-gray-900">
                      Financial Snapshot
                    </h3>
                    <p className="text-sm text-gray-500">
                      Revenue and collection overview for the selected day.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Card
                        title="Estimated Revenue"
                        value={`BDT ${Number(report.estimatedRevenue || 0).toFixed(2)}`}
                      />
                      <Card
                        title="Collection Rate"
                        value={`${report.collectionRate || 0}%`}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900">
                      Revenue Position
                    </h3>
                    <div className="mt-4 space-y-3">
                      <ProgressRow
                        label="Estimated Revenue"
                        value={Number(report.estimatedRevenue || 0)}
                        total={Math.max(
                          Number(report.estimatedRevenue || 0),
                          1,
                        )}
                        tone="emerald"
                      />
                      <ProgressRow
                        label="Collection Rate"
                        value={Number(report.collectionRate || 0)}
                        total={100}
                        tone="blue"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "system" && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card title="Total Users" value={report.totalUsers} />
                  <Card title="Total Doctors" value={report.totalDoctors} />
                  <Card
                    title="Total Assistants"
                    value={report.totalAssistants}
                  />
                  <Card title="Date" value={report.date} />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function Card({ title, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value ?? 0}</p>
    </div>
  );
}

function MetricCapsule({ label, value, tone = "slate", compact = false }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  };

  return (
    <div
      className={`rounded-full border px-3 py-2 ${tones[tone] || tones.slate} ${compact ? "text-xs" : "text-sm"}`}
    >
      <span className="font-medium">{label}: </span>
      <span className="font-semibold">{value ?? 0}</span>
    </div>
  );
}

function ProgressRow({ label, value, total, tone = "blue" }) {
  const pct =
    total > 0 ? Math.min((Number(value) / Number(total)) * 100, 100) : 0;
  const fill = tone === "emerald" ? "bg-emerald-500" : "bg-blue-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {Number.isFinite(Number(value)) ? Number(value).toFixed(2) : value}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
