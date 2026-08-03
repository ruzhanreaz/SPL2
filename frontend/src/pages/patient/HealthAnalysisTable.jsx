import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Loader,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";

import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { labAnalyticsAPI } from "../../utils/api";

const METRIC_LABELS = {
  total_cholesterol: "Total Cholesterol",
  ldl: "LDL Cholesterol",
  hdl: "HDL Cholesterol",
  triglycerides: "Triglycerides",
  blood_pressure_systolic: "Blood Pressure (Systolic)",
  blood_pressure_diastolic: "Blood Pressure (Diastolic)",
  heart_rate: "Heart Rate",
  oxygen_saturation: "Oxygen Saturation",
  weight: "Weight",
  bmi: "BMI",
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const HealthAnalysisTable = () => {
  const { user } = useAuth();
  const toast = useToast();

  const patientId = user?.patientId || user?.userId || user?.id || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [sortField, setSortField] = useState("measured_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [error, setError] = useState("");

  const fetchTableData = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await labAnalyticsAPI.getMeasurements(patientId);
      setItems(response.items || []);
    } catch (err) {
      setError(err.message || "Failed to load measurements");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const handleDelete = async (measurementId) => {
    try {
      setDeletingId(measurementId);
      await labAnalyticsAPI.deleteMeasurement(patientId, measurementId);
      setItems((prev) =>
        prev.filter((item) => item.measurement_id !== measurementId),
      );
      toast?.success?.("Data removed successfully");
    } catch (err) {
      toast?.error?.(err.message || "Failed to remove data");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUp className="h-3.5 w-3.5 text-gray-300" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary-600" />
    );
  };

  const sortedItems = [...items].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortField === "measured_at") {
      return (
        (new Date(a.measured_at).getTime() -
          new Date(b.measured_at).getTime()) *
        direction
      );
    }
    if (sortField === "metric_code") {
      const aLabel = METRIC_LABELS[a.metric_code] || a.metric_code;
      const bLabel = METRIC_LABELS[b.metric_code] || b.metric_code;
      return aLabel.localeCompare(bLabel) * direction;
    }
    if (sortField === "value") {
      return (a.value - b.value) * direction;
    }
    if (sortField === "unit") {
      return a.unit.localeCompare(b.unit) * direction;
    }
    return 0;
  });

  const startEditing = (item) => {
    setEditingId(item.measurement_id);
    setEditingValues({
      metric_code: item.metric_code,
      value: String(item.value),
      unit: item.unit,
      measured_at: new Date(item.measured_at).toISOString().split("T")[0],
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleEditingChange = (field, value) => {
    setEditingValues((prev) => ({ ...prev, [field]: value }));
  };

  const saveEditing = async (measurementId) => {
    try {
      setSavingId(measurementId);
      const payload = {
        metric_code: editingValues.metric_code,
        value: Number(editingValues.value),
        unit: editingValues.unit,
        measured_at: `${editingValues.measured_at}T00:00:00Z`,
      };
      const updated = await labAnalyticsAPI.updateMeasurement(
        patientId,
        measurementId,
        payload,
      );
      setItems((prev) =>
        prev.map((item) =>
          item.measurement_id === measurementId ? updated : item,
        ),
      );
      toast?.success?.("Data updated successfully");
      cancelEditing();
    } catch (err) {
      toast?.error?.(err.message || "Failed to update data");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="app-page-title">My Health Data Table</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review and remove processed report data.
            </p>
          </div>
          <Link
            to="/patient/health-analysis"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Graph
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-7 w-7 animate-spin text-primary-600" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No health data yet.
            </div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    <button
                      type="button"
                      onClick={() => handleSort("measured_at")}
                      className="inline-flex items-center gap-1"
                    >
                      Date {getSortIcon("measured_at")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    <button
                      type="button"
                      onClick={() => handleSort("metric_code")}
                      className="inline-flex items-center gap-1"
                    >
                      Metric {getSortIcon("metric_code")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    <button
                      type="button"
                      onClick={() => handleSort("value")}
                      className="inline-flex items-center gap-1"
                    >
                      Value {getSortIcon("value")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    <button
                      type="button"
                      onClick={() => handleSort("unit")}
                      className="inline-flex items-center gap-1"
                    >
                      Unit {getSortIcon("unit")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedItems.map((item) => (
                  <tr key={item.measurement_id}>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editingId === item.measurement_id ? (
                        <input
                          type="date"
                          value={editingValues.measured_at || ""}
                          onChange={(e) =>
                            handleEditingChange("measured_at", e.target.value)
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        formatDate(item.measured_at)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {editingId === item.measurement_id ? (
                        <select
                          value={editingValues.metric_code || item.metric_code}
                          onChange={(e) =>
                            handleEditingChange("metric_code", e.target.value)
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          {Object.entries(METRIC_LABELS).map(
                            ([code, label]) => (
                              <option key={code} value={code}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        METRIC_LABELS[item.metric_code] || item.metric_code
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editingId === item.measurement_id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingValues.value || ""}
                          onChange={(e) =>
                            handleEditingChange("value", e.target.value)
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        item.value
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editingId === item.measurement_id ? (
                        <input
                          type="text"
                          value={editingValues.unit || ""}
                          onChange={(e) =>
                            handleEditingChange("unit", e.target.value)
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        item.unit
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {editingId === item.measurement_id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(item.measurement_id)}
                              disabled={savingId === item.measurement_id}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 disabled:opacity-50"
                            >
                              {savingId === item.measurement_id ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.measurement_id)}
                              disabled={deletingId === item.measurement_id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === item.measurement_id ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HealthAnalysisTable;
