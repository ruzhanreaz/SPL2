import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Loader,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "../../components/DashboardLayout";
import ReturnToConsultationDashboardButton from "../../components/consultation/ReturnToConsultationDashboardButton";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { appointmentAPI, labAnalyticsAPI } from "../../utils/api";

const METRIC_CONFIG = {
  total_cholesterol: {
    label: "Total Cholesterol",
    unit: "mg/dL",
    color: "#2563eb",
    normal: "< 200",
  },
  ldl: {
    label: "LDL Cholesterol",
    unit: "mg/dL",
    color: "#dc2626",
    normal: "< 100",
  },
  hdl: {
    label: "HDL Cholesterol",
    unit: "mg/dL",
    color: "#16a34a",
    normal: "> 40",
  },
  triglycerides: {
    label: "Triglycerides",
    unit: "mg/dL",
    color: "#f59e0b",
    normal: "< 150",
  },
  blood_pressure_systolic: {
    label: "BP Systolic",
    unit: "mmHg",
    color: "#0891b2",
    normal: "< 120",
  },
  blood_pressure_diastolic: {
    label: "BP Diastolic",
    unit: "mmHg",
    color: "#0f766e",
    normal: "< 80",
  },
  heart_rate: {
    label: "Heart Rate",
    unit: "bpm",
    color: "#db2777",
    normal: "60-100",
  },
  oxygen_saturation: {
    label: "Oxygen Saturation",
    unit: "%",
    color: "#0284c7",
    normal: "> 95",
  },
  weight: {
    label: "Weight",
    unit: "kg",
    color: "#4f46e5",
    normal: "Personal target",
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    color: "#7c3aed",
    normal: "18.5-24.9",
  },
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnlyString = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;
    if (trimmed.length >= 10 && DATE_ONLY_REGEX.test(trimmed.slice(0, 10))) {
      return trimmed.slice(0, 10);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateOnlyToTimestamp = (dateOnly) => {
  if (!DATE_ONLY_REGEX.test(dateOnly || "")) return Number.NaN;
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const formatDateFromTimestamp = (timestamp, options = {}) => {
  if (Number.isNaN(timestamp)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(timestamp));
};

const resolveAccessExpiryValue = (status) => {
  if (!status || typeof status !== "object") return null;

  return (
    status.expiresAt ||
    status.expires_at ||
    status.accessExpiresAt ||
    status.access_expires_at ||
    status.validUntil ||
    status.valid_until ||
    null
  );
};

const formatAccessExpiry = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
};

const PatientHealthTrends = () => {
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId, patientId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [accessStatus, setAccessStatus] = useState(null);
  const [trends, setTrends] = useState(null);
  const [activeSection, setActiveSection] = useState("metrics");
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const revocationNotifiedRef = useRef(false);

  const selectedMetricDefault = useMemo(() => "total_cholesterol", []);
  const [selectedMetric, setSelectedMetric] = useState(selectedMetricDefault);

  const patientName = location.state?.patientName || "Patient";

  const checkAccess = useCallback(async () => {
    if (!appointmentId || !token) return false;

    const status = await appointmentAPI.getPatientAccessStatusForDoctor(
      appointmentId,
      token,
    );
    setAccessStatus(status || null);
    const nextHasAccess = Boolean(status?.hasAccess);
    setHasAccess(nextHasAccess);
    return nextHasAccess;
  }, [appointmentId, token]);

  const fetchData = useCallback(async () => {
    if (!appointmentId || !patientId || !token) {
      setLoading(false);
      setError("Missing appointment or patient context");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const accessAllowed = await checkAccess();
      if (!accessAllowed) {
        setTrends(null);
        setLoading(false);
        return;
      }

      const data = await labAnalyticsAPI.getTrends(
        patientId,
        null,
        null,
        null,
        token,
      );
      setTrends(data);
      revocationNotifiedRef.current = false;
    } catch (err) {
      setError(err?.message || "Failed to load patient trend data");
      setTrends(null);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, checkAccess, patientId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!appointmentId || !token) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const accessAllowed = await checkAccess();
        if (!accessAllowed) {
          setTrends(null);
          if (!revocationNotifiedRef.current) {
            revocationNotifiedRef.current = true;
            toast.info(
              "Patient access was revoked or expired for this appointment",
            );
          }
        }
      } catch {
        // Keep polling; transient network errors should not force-close the view.
      }
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appointmentId, checkAccess, toast, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const latestMetrics = useMemo(() => {
    if (!trends?.trends) return [];

    return trends.trends
      .map((entry) => {
        const latestPoint = entry.points?.[entry.points.length - 1];
        if (!latestPoint || typeof latestPoint.value !== "number") return null;

        return {
          code: entry.metric_code,
          label: METRIC_CONFIG[entry.metric_code]?.label || entry.metric_code,
          value: latestPoint.value,
          unit: entry.unit || METRIC_CONFIG[entry.metric_code]?.unit || "",
          measuredAt: latestPoint.measured_at,
        };
      })
      .filter(Boolean);
  }, [trends]);

  const trendData = useMemo(() => {
    if (!trends?.trends) return [];

    const metric = trends.trends.find(
      (entry) => entry.metric_code === selectedMetric,
    );
    if (!metric?.points) return [];

    return metric.points
      .map((point) => {
        const dateOnly = toDateOnlyString(point.measured_at);
        const timestamp = dateOnlyToTimestamp(dateOnly);
        return {
          timestamp,
          value: point.value,
        };
      })
      .filter((point) => !Number.isNaN(point.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedMetric, trends]);

  const selectedMetricConfig = METRIC_CONFIG[selectedMetric] || {};
  const todayTimestamp = Date.now();
  const accessExpiryText = formatAccessExpiry(
    resolveAccessExpiryValue(accessStatus),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ReturnToConsultationDashboardButton patientId={patientId} />
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            </div>
            <h1 className="app-page-title mt-3">Patient Health Trends</h1>
            <p className="text-sm text-gray-500 mt-1">
              {patientName} - shared from appointment #{appointmentId}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="card-surface flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="card-surface border-l-4 border-l-error-600 bg-error-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error-600 mt-0.5" />
              <p className="text-sm font-medium text-error-900">{error}</p>
            </div>
          </div>
        )}

        {!loading && !hasAccess && !error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              Access not granted
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Patient has not granted access yet, or access has expired. This
              view follows the same revoke timer as secure document access.
            </p>
          </div>
        )}

        {!loading && hasAccess && !error && (
          <>
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              Access active
              {accessExpiryText
                ? ` until ${accessExpiryText}`
                : " until consultation ends"}
            </div>

            <div className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setActiveSection("metrics")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  activeSection === "metrics"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("trends")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  activeSection === "trends"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Continuous
              </button>
            </div>

            {activeSection === "metrics" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Current Metrics
                  </h2>
                </div>

                {latestMetrics.length === 0 ? (
                  <div className="card-surface text-center py-10 text-gray-500">
                    No metrics available yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {latestMetrics.map((metric) => (
                      <div
                        key={metric.code}
                        className="card-surface border border-gray-200"
                      >
                        <p className="text-xs font-semibold text-gray-600">
                          {metric.label}
                        </p>
                        <p className="mt-1 text-xl font-bold text-gray-900">
                          {metric.value}
                          <span className="ml-1 text-xs font-medium text-gray-500">
                            {metric.unit}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {toDateOnlyString(metric.measuredAt) ||
                            "No timestamp"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === "trends" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-600" />
                    <h2 className="text-xl font-semibold text-gray-900">
                      Continuous Trends
                    </h2>
                  </div>

                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((prev) => !prev)}
                      className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {selectedMetricConfig.label || "Select Metric"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>

                    {openDropdown && (
                      <div className="absolute right-0 top-10 z-20 max-h-72 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                        {Object.entries(METRIC_CONFIG).map(
                          ([metricCode, config]) => (
                            <button
                              key={metricCode}
                              type="button"
                              onClick={() => {
                                setSelectedMetric(metricCode);
                                setOpenDropdown(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                selectedMetric === metricCode
                                  ? "text-primary-700 font-semibold bg-primary-50"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {config.label}
                              {selectedMetric === metricCode && (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-surface">
                  {trendData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <Activity className="mb-3 h-12 w-12 text-gray-300" />
                      <p>No trend data available for this metric</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-3">
                        <p className="text-xs font-medium text-gray-700">
                          Normal Range
                        </p>
                        <p className="mt-1 text-sm font-semibold text-primary-900">
                          {selectedMetricConfig.normal || "N/A"}
                        </p>
                      </div>

                      <ResponsiveContainer width="100%" height={340}>
                        <LineChart data={trendData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                          />
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={["dataMin", todayTimestamp]}
                            tickFormatter={(timestamp) =>
                              formatDateFromTimestamp(timestamp, {
                                month: "short",
                                day: "numeric",
                                year: "2-digit",
                              })
                            }
                            stroke="#6b7280"
                            style={{ fontSize: "12px" }}
                          />
                          <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: "12px" }}
                            label={{
                              value: selectedMetricConfig.unit,
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            labelFormatter={(timestamp) =>
                              formatDateFromTimestamp(timestamp, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            }
                            formatter={(value) => [
                              `${value} ${selectedMetricConfig.unit || ""}`,
                              selectedMetricConfig.label || selectedMetric,
                            ]}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={selectedMetricConfig.color || "#2563eb"}
                            dot={{
                              fill: selectedMetricConfig.color || "#2563eb",
                              r: 3,
                            }}
                            activeDot={{ r: 6 }}
                            name={selectedMetricConfig.label || selectedMetric}
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientHealthTrends;
