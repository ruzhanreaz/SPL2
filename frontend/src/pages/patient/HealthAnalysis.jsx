import React, { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Activity,
  TrendingUp,
  Upload,
  Plus,
  Table,
  MoreVertical,
  X,
  Loader,
  AlertCircle,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { labAnalyticsAPI, documentAPI, profileAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { Link, useLocation } from "react-router-dom";

const METRIC_CONFIG = {
  total_cholesterol: {
    label: "Total Cholesterol",
    unit: "mg/dL",
    color: "#3b82f6",
    normal: "< 200",
    category: "lipids",
  },
  ldl: {
    label: "LDL Cholesterol",
    unit: "mg/dL",
    color: "#ef4444",
    normal: "< 100",
    category: "lipids",
  },
  hdl: {
    label: "HDL Cholesterol",
    unit: "mg/dL",
    color: "#22c55e",
    normal: "> 40",
    category: "lipids",
  },
  triglycerides: {
    label: "Triglycerides",
    unit: "mg/dL",
    color: "#f59e0b",
    normal: "< 150",
    category: "lipids",
  },
  blood_pressure_systolic: {
    label: "Blood Pressure (Systolic)",
    unit: "mmHg",
    color: "#06b6d4",
    normal: "< 120",
    category: "vitals",
  },
  blood_pressure_diastolic: {
    label: "Blood Pressure (Diastolic)",
    unit: "mmHg",
    color: "#14b8a6",
    normal: "< 80",
    category: "vitals",
  },
  heart_rate: {
    label: "Heart Rate",
    unit: "bpm",
    color: "#ec4899",
    normal: "60-100",
    category: "vitals",
  },
  oxygen_saturation: {
    label: "Oxygen Saturation",
    unit: "%",
    color: "#06b6d4",
    normal: "> 95",
    category: "respiratory",
  },
  weight: {
    label: "Weight",
    unit: "kg",
    color: "#6366f1",
    normal: "Personal target",
    category: "metabolic",
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    color: "#8b5cf6",
    normal: "18.5-24.9",
    category: "metabolic",
  },
};

const METRIC_CATEGORY_LABELS = {
  lipids: "Lipids",
  metabolic: "Metabolic",
  vitals: "Vitals",
  respiratory: "Respiratory",
  other: "Other",
};

const METRIC_CATEGORY_ORDER = [
  "lipids",
  "metabolic",
  "vitals",
  "respiratory",
  "other",
];

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

const formatDateFromValue = (value, options = {}) => {
  const dateOnly = toDateOnlyString(value);
  if (!dateOnly) return "";
  const timestamp = dateOnlyToTimestamp(dateOnly);
  if (Number.isNaN(timestamp)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(timestamp));
};

const formatDateFromTimestamp = (timestamp, options = {}) => {
  if (Number.isNaN(timestamp)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(timestamp));
};

const toDateInputValue = (value) => toDateOnlyString(value);

const getIssuedDateValue = (report) => {
  if (!report) return "";
  return (
    report.issuedAt ||
    report.issued_at ||
    report.reportedAt ||
    report.reported_at ||
    ""
  );
};

const toPositiveNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const buildProfileDerivedTrends = (profile, fallbackDate = new Date()) => {
  const weightKg = toPositiveNumber(profile?.weight);
  const heightCm = toPositiveNumber(profile?.height);
  const measuredAt =
    profile?.updatedAt ||
    profile?.updated_at ||
    profile?.createdAt ||
    profile?.created_at ||
    fallbackDate.toISOString();

  const derived = [];

  if (weightKg != null) {
    derived.push({
      metric_code: "weight",
      unit: "kg",
      points: [
        {
          measured_at: measuredAt,
          value: Number(weightKg.toFixed(2)),
        },
      ],
    });
  }

  if (weightKg != null && heightCm != null) {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    if (Number.isFinite(bmi) && bmi > 0) {
      derived.push({
        metric_code: "bmi",
        unit: "kg/m²",
        points: [
          {
            measured_at: measuredAt,
            value: Number(bmi.toFixed(2)),
          },
        ],
      });
    }
  }

  return derived;
};

const mergeTrendsWithProfileDerivedMetrics = (trendPayload, profile) => {
  const baseTrends = Array.isArray(trendPayload?.trends)
    ? trendPayload.trends
    : [];
  const baseWithoutProfileDerived = baseTrends.filter(
    (item) => item?.metric_code !== "weight" && item?.metric_code !== "bmi",
  );

  const profileDerived = buildProfileDerivedTrends(profile);
  return {
    ...(trendPayload || {}),
    trends: [...baseWithoutProfileDerived, ...profileDerived],
  };
};

const HealthAnalysis = () => {
  const { user, token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const showErrorToast = toast?.error;
  const showInfoToast = toast?.info;
  const showSuccessToast = toast?.success;
  const filterBarRef = useRef(null);
  const mobileActionsRef = useRef(null);

  const [trends, setTrends] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState("total_cholesterol");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSelectReportModal, setShowSelectReportModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [availableReports, setAvailableReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDate, setReportDate] = useState("");
  const [processingReport, setProcessingReport] = useState(false);
  const [fetchingReports, setFetchingReports] = useState(false);
  const [prefillHandled, setPrefillHandled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [activeSection, setActiveSection] = useState("metrics");
  const [showMobileActions, setShowMobileActions] = useState(false);

  const patientId = user?.patientId || user?.userId || user?.id || "";

  const fetchTrends = useCallback(async () => {
    if (!patientId || !token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [data, profile] = await Promise.all([
        labAnalyticsAPI.getTrends(patientId),
        profileAPI.getProfile(token),
      ]);
      setTrends(mergeTrendsWithProfileDerivedMetrics(data, profile));
    } catch (err) {
      console.error("Error fetching trends:", err);
      setError(err.message);
      showErrorToast?.(err.message || "Failed to load health data");
    } finally {
      setLoading(false);
    }
  }, [patientId, token, showErrorToast]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
      if (
        mobileActionsRef.current &&
        !mobileActionsRef.current.contains(e.target)
      ) {
        setShowMobileActions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAvailableReports = useCallback(async () => {
    try {
      setFetchingReports(true);
      const reports = await documentAPI.getDocuments("REPORT", token);
      const normalizedReports = (reports || []).map((report) => ({
        ...report,
        id: report.id ?? report.documentId,
      }));
      setAvailableReports(normalizedReports);
      return normalizedReports;
    } catch (err) {
      console.error("Error fetching reports:", err);
      showErrorToast?.(err.message || "Failed to fetch reports");
      setAvailableReports([]);
      return [];
    } finally {
      setFetchingReports(false);
    }
  }, [token, showErrorToast]);

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    const issuedDate = toDateInputValue(getIssuedDateValue(selectedReport));
    setReportDate(issuedDate || "");
  }, [selectedReport]);

  const handleOpenSelectReportModal = useCallback(
    async (preselectedReportDocumentId = null) => {
      setSelectedReport(null);
      setReportDate("");
      setShowSelectReportModal(true);
      const reports = await fetchAvailableReports();

      const hasPrimitiveId =
        typeof preselectedReportDocumentId === "string" ||
        typeof preselectedReportDocumentId === "number";

      if (!hasPrimitiveId || preselectedReportDocumentId === "") return;

      const normalizedTargetId = String(preselectedReportDocumentId);

      const matchedReport = reports.find(
        (report) =>
          String(report.id) === normalizedTargetId ||
          String(report.documentId) === normalizedTargetId,
      );

      if (matchedReport) {
        setSelectedReport(matchedReport);
        const issuedDate = toDateInputValue(getIssuedDateValue(matchedReport));
        setReportDate(issuedDate || "");
      } else {
        showInfoToast?.(
          "Selected report was not found in your available reports list",
        );
      }
    },
    [fetchAvailableReports, showInfoToast],
  );

  useEffect(() => {
    const shouldOpen = location.state?.openSelectReportModal;
    const reportDocumentId = location.state?.reportDocumentId;

    if (!shouldOpen || prefillHandled || !token) return;

    const openWithSelectedReport = async () => {
      await handleOpenSelectReportModal(reportDocumentId ?? null);
      setPrefillHandled(true);
    };

    openWithSelectedReport();
  }, [location.state, prefillHandled, token, handleOpenSelectReportModal]);

  const handleProcessReport = async () => {
    if (!patientId) {
      showErrorToast?.(
        "Patient profile is not ready yet. Please refresh and try again.",
      );
      return;
    }

    if (!selectedReport) {
      showErrorToast?.("Please select a report");
      return;
    }

    if (!reportDate) {
      showErrorToast?.(
        "No issued date found. Please enter report date manually.",
      );
      return;
    }

    try {
      setProcessingReport(true);

      const documentContent = await documentAPI.getDocumentContent(
        selectedReport.id,
        token,
      );
      const blob = documentContent.blob;
      const file = new File(
        [blob],
        documentContent.fileName || selectedReport.fileName || "report",
        {
          type:
            documentContent.contentType ||
            selectedReport.mimeType ||
            "application/pdf",
        },
      );

      await labAnalyticsAPI.uploadReport(patientId, file, reportDate);

      showSuccessToast?.("Report processed successfully");
      setShowSelectReportModal(false);
      setSelectedReport(null);
      await fetchTrends();
    } catch (err) {
      console.error("Process report error:", err);
      showErrorToast?.(err.message || "Failed to process report");
    } finally {
      setProcessingReport(false);
    }
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();

    if (!patientId) {
      showErrorToast?.(
        "Patient profile is not ready yet. Please refresh and try again.",
      );
      return;
    }

    const formData = new FormData(e.target);
    const metric = formData.get("metric");
    const value = parseFloat(formData.get("value"));
    const date = new Date(formData.get("date"));

    if (!metric || Number.isNaN(value) || Number.isNaN(date.getTime())) {
      showErrorToast?.("Please provide valid metric, value, and date");
      return;
    }

    try {
      await labAnalyticsAPI.addManualMeasurement(patientId, {
        metric_code: metric,
        value,
        measured_at: date.toISOString(),
      });

      showSuccessToast?.("Manual metric added successfully");
      setShowManualModal(false);
      await fetchTrends();
    } catch (err) {
      console.error("Manual entry error:", err);
      showErrorToast?.(err.message || "Failed to add manual metric");
    }
  };

  const isValueInNormalRange = (value, normalRangeStr) => {
    if (
      typeof value !== "number" ||
      !normalRangeStr ||
      typeof normalRangeStr !== "string"
    ) {
      return null;
    }

    const range = normalRangeStr.trim();

    // Handle "< X" pattern
    if (range.startsWith("<")) {
      const limit = parseFloat(range.substring(1).trim());
      return !Number.isNaN(limit) ? value < limit : null;
    }

    // Handle "> X" pattern
    if (range.startsWith(">")) {
      const limit = parseFloat(range.substring(1).trim());
      return !Number.isNaN(limit) ? value > limit : null;
    }

    // Handle "X-Y" pattern
    if (range.includes("-")) {
      const parts = range.split("-").map((p) => parseFloat(p.trim()));
      if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
      ) {
        return value >= parts[0] && value <= parts[1];
      }
    }

    return null;
  };

  const getLatestMetrics = () => {
    if (!trends || !trends.trends) return [];
    const metrics = trends.trends
      .map((t) => {
        const latest = t.points[t.points.length - 1];
        const value = latest?.value || "N/A";
        const isNormal =
          typeof value === "number"
            ? isValueInNormalRange(value, METRIC_CONFIG[t.metric_code]?.normal)
            : null;
        return {
          code: t.metric_code,
          label: METRIC_CONFIG[t.metric_code]?.label || t.metric_code,
          value,
          unit: t.unit || "",
          measured_at: latest?.measured_at,
          isNormal,
        };
      })
      .filter((m) => m.value !== "N/A");

    const bmiMetric = metrics.find((metric) => metric.code === "bmi");
    if (bmiMetric?.isNormal === false) {
      return metrics.map((metric) =>
        metric.code === "weight" ? { ...metric, isNormal: false } : metric,
      );
    }

    return metrics;
  };

  const getSelectedTrendData = () => {
    if (!trends || !trends.trends) return [];
    const metric = trends.trends.find((t) => t.metric_code === selectedMetric);
    if (!metric) return [];

    return metric.points
      .map((p) => {
        const dateOnly = toDateOnlyString(p.measured_at);
        const timestamp = dateOnlyToTimestamp(dateOnly);
        return {
          timestamp,
          value: p.value,
          fullDate: dateOnly || p.measured_at,
        };
      })
      .filter((p) => !Number.isNaN(p.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const latestMetrics = getLatestMetrics();
  const trendData = getSelectedTrendData();
  const metricConfig = METRIC_CONFIG[selectedMetric] || {};
  const todayTimestamp = new Date().getTime();
  const categorizedLatestMetrics = latestMetrics.reduce((groups, metric) => {
    const category = METRIC_CONFIG[metric.code]?.category || "other";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(metric);
    return groups;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h1 className="app-page-title">My Health Analysis</h1>

              <div
                className="mt-4 inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 sm:hidden"
                role="tablist"
                aria-label="Health Analysis Sections"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSection === "metrics"}
                  onClick={() => {
                    setActiveSection("metrics");
                    setOpenDropdown(null);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${activeSection === "metrics"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                    }`}
                >
                  Current
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSection === "trends"}
                  onClick={() => {
                    setActiveSection("trends");
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${activeSection === "trends"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                    }`}
                >
                  Continuous
                </button>
              </div>
            </div>

            <div
              ref={mobileActionsRef}
              className="fixed top-16 right-3 z-40 sm:hidden"
            >
              <button
                type="button"
                onClick={() => setShowMobileActions((prev) => !prev)}
                aria-expanded={showMobileActions}
                aria-label="Open health analysis actions"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMobileActions && (
                <div className="absolute right-0 top-11 z-40 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  <Link
                    to="/patient/health-analysis/table"
                    onClick={() => setShowMobileActions(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Table className="h-4 w-4 text-primary-700" />
                    Table View
                  </Link>
                  <button
                    onClick={() => {
                      setShowMobileActions(false);
                      handleOpenSelectReportModal();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Upload className="h-4 w-4 text-primary-700" />
                    Select Reports
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileActions(false);
                      setShowManualModal(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Plus className="h-4 w-4 text-accent-700" />
                    Add Manually
                  </button>
                </div>
              )}
            </div>

            <div
              className="mt-6 hidden sm:inline-flex rounded-full border border-gray-200 bg-gray-100 p-1"
              role="tablist"
              aria-label="Health Analysis Sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "metrics"}
                onClick={() => {
                  setActiveSection("metrics");
                  setOpenDropdown(null);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeSection === "metrics"
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
                  }`}
              >
                Current
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "trends"}
                onClick={() => {
                  setActiveSection("trends");
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeSection === "trends"
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
                  }`}
              >
                Continuous
              </button>
            </div>
          </div>

          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            <Link
              to="/patient/health-analysis/table"
              className="bg-white border border-primary-300 text-primary-700 hover:bg-primary-50 font-semibold px-4 sm:px-5 py-2 rounded-full transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm"
            >
              <Table className="w-4 h-4" />
              Table View
            </Link>
            <button
              onClick={handleOpenSelectReportModal}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 sm:px-5 py-2 rounded-full transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm"
            >
              <Upload className="w-4 h-4" />
              Select Reports
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              className="bg-accent-600 hover:bg-accent-700 text-white font-semibold px-4 sm:px-5 py-2 rounded-full transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Manually
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="card-surface border-l-4 border-l-error-600 bg-error-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
              <div className="flex-grow">
                <p className="text-sm font-medium text-error-900">{error}</p>
                <button
                  onClick={fetchTrends}
                  className="text-sm text-error-700 hover:text-error-800 mt-2 font-medium underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="card-surface flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {activeSection === "metrics" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Current Health Metrics
                  </h2>
                </div>
                {latestMetrics.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {METRIC_CATEGORY_ORDER.map((category) => {
                      const metricsInCategory =
                        categorizedLatestMetrics[category] || [];
                      if (metricsInCategory.length === 0) return null;
                      const metricGridClass =
                        metricsInCategory.length === 4
                          ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                          : metricsInCategory.length === 3
                            ? "grid grid-cols-1 gap-3 sm:grid-cols-3"
                            : metricsInCategory.length === 2
                              ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                              : "grid grid-cols-1 gap-3";

                      return (
                        <section
                          key={category}
                          className="h-full space-y-3 rounded-2xl border border-gray-200 bg-white/70 p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                                {METRIC_CATEGORY_LABELS[category] || category}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {metricsInCategory.length} metric
                                {metricsInCategory.length > 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>

                          <div className={metricGridClass}>
                            {metricsInCategory.map((metric) => {
                              const bgClass =
                                metric.isNormal === true
                                  ? "bg-success-50 border-l-4 border-l-success-600"
                                  : metric.isNormal === false
                                    ? "bg-error-50 border-l-4 border-l-error-600"
                                    : "bg-white";
                              const labelColorClass =
                                metric.isNormal === true
                                  ? "text-success-700 font-semibold"
                                  : metric.isNormal === false
                                    ? "text-error-700 font-semibold"
                                    : "text-gray-600";
                              const valueColorClass =
                                metric.isNormal === true
                                  ? "text-success-900"
                                  : metric.isNormal === false
                                    ? "text-error-900"
                                    : "text-gray-900";

                              return (
                                <div
                                  key={metric.code}
                                  className={`card-surface card-hover p-4 ${bgClass}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-grow">
                                      <p
                                        className={`text-xs font-medium ${labelColorClass}`}
                                      >
                                        {metric.label}
                                      </p>
                                      <p
                                        className={`mt-1.5 text-xl font-bold ${valueColorClass}`}
                                      >
                                        {metric.value}
                                        <span className="text-xs font-normal text-gray-500 ml-1">
                                          {metric.unit}
                                        </span>
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-gray-500">
                                        {metric.measured_at
                                          ? formatDateFromValue(
                                            metric.measured_at,
                                          )
                                          : "No data"}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end justify-start text-right">
                                      <p className="text-[11px] font-medium text-gray-600">
                                        Normal
                                      </p>
                                      <p className="text-[11px] font-semibold text-primary-700 mt-0.5">
                                        {METRIC_CONFIG[metric.code]?.normal ||
                                          "N/A"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="col-span-2 lg:col-span-4 text-center py-8">
                    <p className="text-gray-500">No metrics available yet</p>
                  </div>
                )}
              </div>
            )}

            {activeSection === "trends" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-600" />
                    <h2 className="text-xl font-semibold text-gray-900">
                      Continuous Trends
                    </h2>
                  </div>
                  <div ref={filterBarRef} className="relative">
                    <button
                      onClick={() =>
                        setOpenDropdown(
                          openDropdown === "metric" ? null : "metric",
                        )
                      }
                      className="flex max-w-[52vw] sm:max-w-none items-center gap-2 px-3 py-1.5 text-sm rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap bg-white"
                    >
                      <span className="truncate">
                        {METRIC_CONFIG[selectedMetric]?.label ||
                          "Select Metric"}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openDropdown === "metric" && (
                      <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto py-1">
                        {Object.entries(METRIC_CONFIG).map(([code, config]) => (
                          <button
                            key={code}
                            onClick={() => {
                              setSelectedMetric(code);
                              setOpenDropdown(null);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${selectedMetric === code
                              ? "text-primary-600 font-medium"
                              : "text-gray-700"
                              }`}
                          >
                            {config.label}
                            {selectedMetric === code && (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-surface">
                  {trendData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                        <p className="text-xs font-medium text-gray-700">
                          Normal Range
                        </p>
                        <p className="text-sm font-semibold text-primary-900 mt-1">
                          {metricConfig.normal}
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={320}>
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
                              value: metricConfig.unit,
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                            }}
                            labelFormatter={(timestamp) =>
                              formatDateFromTimestamp(timestamp, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            }
                            formatter={(value) => [
                              `${value} ${metricConfig.unit}`,
                              metricConfig.label,
                            ]}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={metricConfig.color}
                            dot={{ fill: metricConfig.color, r: 4 }}
                            activeDot={{ r: 6 }}
                            name={metricConfig.label}
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Activity className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500">
                        No data available for {metricConfig.label}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Select Reports Modal */}
        {showSelectReportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="card-surface max-w-lg w-full animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Select Lab Report
                </h3>
                <button
                  onClick={() => {
                    setShowSelectReportModal(false);
                    setSelectedReport(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Reports List */}
                <div>
                  <label className="form-label">Available Reports</label>
                  {fetchingReports ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-5 h-5 text-primary-600 animate-spin" />
                    </div>
                  ) : availableReports.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {availableReports.map((report) => (
                        <div
                          key={report.id}
                          onClick={() => {
                            setSelectedReport(report);
                            const issuedDate = toDateInputValue(
                              getIssuedDateValue(report),
                            );
                            setReportDate(issuedDate || "");
                          }}
                          className={`p-3 cursor-pointer transition-colors ${selectedReport?.id === report.id
                            ? "bg-primary-50"
                            : "hover:bg-gray-50"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-grow">
                              <p className="font-medium text-gray-900">
                                {report.documentName || report.fileName}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {getIssuedDateValue(report) && (
                                  <>
                                    <strong>Issued:</strong>{" "}
                                    {formatDateFromValue(
                                      getIssuedDateValue(report),
                                    )}{" "}
                                    •{" "}
                                  </>
                                )}
                                <strong>Uploaded:</strong>{" "}
                                {formatDateFromValue(report.uploadedAt)}
                              </p>
                            </div>
                            {selectedReport?.id === report.id && (
                              <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-500">
                        No reports found in your drive
                      </p>
                    </div>
                  )}
                </div>

                {/* Report Date */}
                <div>
                  <label className="form-label">Report Date</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowSelectReportModal(false);
                      setSelectedReport(null);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProcessReport}
                    disabled={processingReport || !selectedReport}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingReport && (
                      <Loader className="w-4 h-4 animate-spin" />
                    )}
                    Process Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Entry Modal */}
        {showManualModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="card-surface max-w-md w-full animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Add Health Metric
                </h3>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualEntry} className="space-y-4">
                <div>
                  <label className="form-label">Metric Type</label>
                  <select
                    name="metric"
                    defaultValue="total_cholesterol"
                    className="form-input"
                  >
                    {Object.entries(METRIC_CONFIG).map(([code, config]) => (
                      <option key={code} value={code}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Value</label>
                  <input
                    type="number"
                    name="value"
                    step="0.1"
                    required
                    placeholder="Enter value"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="form-input"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500/35 flex-1"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HealthAnalysis;
