import React, { useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { scheduleAPI, assistantAPI } from "../../utils/api";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreVertical,
  Clock,
  ToggleLeft,
  ToggleRight,
  X,
  Users,
  Ban,
  Copy,
  Trash2,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────── */
const HOUR_HEIGHT = 40; // px per hour in the time grid
const WEEK_DAY_MIN_WIDTH = 104;
const MODAL_BACKDROP_CLASS =
  "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
const MODAL_PANEL_CLASS =
  "bg-white rounded-2xl shadow-2xl p-6 border border-gray-100 w-[26rem] max-w-[95vw] max-h-[85vh] overflow-y-auto";
const MODAL_CLOSE_BUTTON_CLASS = "text-gray-400 hover:text-gray-600 p-0.5";
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_API_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_ABR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
// JS getDay() (0 = Sun) → API dayOfWeek (1 = Mon … 7 = Sun)
const jsDayToApi = (d) => (d === 0 ? 7 : d);

const fmtISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const timeToMin = (t) => {
  const [h, min] = t.split(":").map(Number);
  return h * 60 + (min || 0);
};

const fmtHour = (h) =>
  h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;

// Snap to nearest 15-min interval
const snapMin = (min) => Math.round(Math.max(0, Math.min(1440, min)) / 15) * 15;
const minToTime = (min) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Sunday of the week containing `date`
const getSunday = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekDays = (date) => {
  const start = getSunday(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const getResponsiveWeekDayCount = (width) => {
  if (width < 480) return 3;
  if (width < 640) return 4;
  if (width < 768) return 5;
  if (width < 1024) return 6;
  return 7;
};

const addDays = (date, amount) => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};

const isoToDate = (iso) => {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const getMonthEnd = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

/* ══════════════════════════════════════════════════════════════════
   Schedule Component
══════════════════════════════════════════════════════════════════ */
const Schedule = ({ isAssistantMode = false }) => {
  const { user, token } = useAuth();
  const effectiveAssistantMode = isAssistantMode || user?.role === "ASSISTANT";
  const toast = useToast();
  const { showConfirm, ConfirmDialog } = useConfirm();
  const canManageOverrides = true;
  const canDeleteSlots = true;

  /* ── View & navigation state ──────────────────────────────── */
  const [view, setView] = useState("week");
  const [current, setCurrent] = useState(new Date());
  const [weekDayCount, setWeekDayCount] = useState(() => {
    if (typeof window === "undefined") return 7;
    return getResponsiveWeekDayCount(window.innerWidth);
  });

  /* ── Data state ───────────────────────────────────────────── */
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  /* ── UI state ─────────────────────────────────────────────── */

  // Add-slot modal
  const [addModal, setAddModal] = useState(false);
  const [modalApiDay, setModalApiDay] = useState(null);
  const [modalStart, setModalStart] = useState("09:00");
  const [modalEnd, setModalEnd] = useState("17:00");
  const [modalBusy, setModalBusy] = useState(false);

  // Override modal
  const [overrideModal, setOverrideModal] = useState(null); // Date | null
  const [overrideBusy, setOverrideBusy] = useState(false);

  // Drag-to-create
  const [dragState, setDragState] = useState(null); // { apiDay, colKey, startMin, endMin } | null
  const dragDataRef = useRef(null);
  const dragMoveHandlerRef = useRef(null);
  const dragUpHandlerRef = useRef(null);

  // Patient count for modal
  const [modalMaxPatients, setModalMaxPatients] = useState(10);
  const [modalAllocationMode, setModalAllocationMode] = useState("patients"); // patients | time
  const [modalSlotMinutes, setModalSlotMinutes] = useState(30);
  const [modalConsultationType, setModalConsultationType] = useState("BOTH");

  // Bulk add modal
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");
  const [bulkMaxPatients, setBulkMaxPatients] = useState(10);
  const [bulkAllocationMode, setBulkAllocationMode] = useState("patients"); // patients | time
  const [bulkSlotMinutes, setBulkSlotMinutes] = useState(30);
  const [bulkConsultationType, setBulkConsultationType] = useState("BOTH");
  const [bulkDays, setBulkDays] = useState(new Set([1, 2, 3, 4, 5])); // Mon–Fri by default
  const [bulkMode, setBulkMode] = useState("add"); // add | clear
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null); // null | { done, total }

  // Date-wise modal (range-based overrides)
  const [dateModal, setDateModal] = useState(false);
  const [dateDays, setDateDays] = useState(new Set([1, 2, 3, 4, 5]));
  const [dateRangeAction, setDateRangeAction] = useState("UNAVAILABLE"); // UNAVAILABLE | AVAILABLE | CLEAR
  const [dateRangeStart, setDateRangeStart] = useState(fmtISO(new Date()));
  const [dateRangeEnd, setDateRangeEnd] = useState(
    fmtISO(addDays(new Date(), 6)),
  );
  const [dateRangePreset, setDateRangePreset] = useState("7d"); // 7d | 30d | month | custom
  const [dateBusy, setDateBusy] = useState(false);
  const [dateProgress, setDateProgress] = useState(null); // null | { done, total }

  // Scroll refs for time grid
  const dayGridRef = useRef(null);
  const weekGridRef = useRef(null);
  // Refs for the inner time grid (used for accurate drag position)
  const dayTimeGridRef = useRef(null);
  const weekTimeGridRef = useRef(null);
  const mobileActionsRef = useRef(null);

  const cleanupDragListeners = () => {
    if (dragMoveHandlerRef.current) {
      window.removeEventListener("mousemove", dragMoveHandlerRef.current);
      dragMoveHandlerRef.current = null;
    }
    if (dragUpHandlerRef.current) {
      window.removeEventListener("mouseup", dragUpHandlerRef.current);
      dragUpHandlerRef.current = null;
    }
    dragDataRef.current = null;
  };

  /* ── Data loading ─────────────────────────────────────────── */
  const loadSchedule = useCallback(async () => {
    if (!token) {
      setScheduleData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setScheduleData(
        await (effectiveAssistantMode
          ? assistantAPI.getDoctorSchedule(token)
          : scheduleAPI.getSchedule(token)),
      );
    } catch {
      setError("Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [effectiveAssistantMode, token]);

  /* ── Effects ──────────────────────────────────────────────── */
  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Mobile-first simplification: default to Day view on small screens.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setView("day");
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupDragListeners();
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (
        mobileActionsRef.current &&
        !mobileActionsRef.current.contains(event.target)
      ) {
        setMobileActionsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setWeekDayCount(getResponsiveWeekDayCount(window.innerWidth));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Scroll to 7 AM when entering a time-grid view
  useEffect(() => {
    const ref = view === "day" ? dayGridRef.current : weekGridRef.current;
    if (ref) {
      const timer = setTimeout(() => {
        ref.scrollTop = HOUR_HEIGHT * 7;
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [view, loading]);

  /* ── Navigation ───────────────────────────────────────────── */
  const navigate = (dir) => {
    const d = new Date(current);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * weekDayCount);
    else d.setFullYear(d.getFullYear() + dir);
    setCurrent(d);
  };

  const getVisibleWeekDays = (date) => {
    if (weekDayCount >= 7) return getWeekDays(date);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: weekDayCount }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const goToday = () => setCurrent(new Date());

  const getHeaderLabel = () => {
    if (view === "day") {
      return current.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "week") {
      const days = getVisibleWeekDays(current);
      const a = days[0],
        b = days[days.length - 1];
      if (a.getMonth() === b.getMonth()) {
        return `${MONTH_FULL[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${a.getFullYear()}`;
      }
      return `${MONTH_ABR[a.getMonth()]} ${a.getDate()} – ${MONTH_ABR[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
    }
    return String(current.getFullYear());
  };

  /* ── Schedule helpers ─────────────────────────────────────── */
  const getSlotsForApiDay = (apiDay) =>
    (scheduleData?.weeklySchedules || [])
      .filter((s) => s.dayOfWeek === apiDay)
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  const hasOverlapForDay = (apiDay, startTime, endTime) => {
    const newStart = timeToMin(startTime);
    const newEnd = timeToMin(endTime);
    if (newEnd <= newStart) return true;

    const daySlots = getSlotsForApiDay(apiDay);
    return daySlots.some((slot) => {
      const slotStart = timeToMin(slot.startTime);
      const slotEnd = timeToMin(slot.endTime);
      return newStart < slotEnd && newEnd > slotStart;
    });
  };

  const getOverride = (date) =>
    (scheduleData?.scheduleOverrides || []).find(
      (o) => o.overrideDate === fmtISO(date),
    );

  /* ── Actions ──────────────────────────────────────────────── */
  const CONSULT_TYPES = [
    {
      value: "BOTH",
      label: "Both",
      color: "bg-purple-100 text-purple-700 border-purple-200",
      activeColor: "bg-purple-600 text-white border-purple-600",
    },
    {
      value: "IN_PERSON",
      label: "In-Person",
      color: "bg-orange-100 text-orange-700 border-orange-200",
      activeColor: "bg-orange-500 text-white border-orange-500",
    },
    {
      value: "ONLINE",
      label: "Online",
      color: "bg-primary-100 text-primary-700 border-primary-200",
      activeColor: "bg-primary-600 text-white border-primary-600",
    },
  ];

  const openAddModal = (apiDay, start = "09:00", end = "17:00") => {
    setModalApiDay(apiDay);
    setModalStart(start);
    setModalEnd(end);
    setModalMaxPatients(10);
    setModalAllocationMode("patients");
    setModalSlotMinutes(30);
    setModalConsultationType("BOTH");
    setAddModal(true);
  };

  const openMainAddModal = () => {
    const today = new Date();
    const apiDay = jsDayToApi(today.getDay());

    setModalApiDay(apiDay);
    setModalStart("09:00");
    setModalEnd("17:00");
    setModalMaxPatients(10);
    setModalAllocationMode("patients");
    setModalSlotMinutes(30);
    setModalConsultationType("BOTH");
    setAddModal(true);
  };

  const openMobileEditSchedule = () => {
    setMobileActionsOpen(false);
    setBulkModal(true);
    setBulkMode("add");
    setBulkDays(new Set([1, 2, 3, 4, 5]));
    setBulkStart("09:00");
    setBulkEnd("17:00");
    setBulkMaxPatients(10);
    setBulkAllocationMode("patients");
    setBulkSlotMinutes(30);
    setBulkConsultationType("BOTH");
    setDateDays(new Set([1, 2, 3, 4, 5]));
    setDateRangeAction("UNAVAILABLE");
    setDateRangePreset("7d");
    setDateRangeStart(fmtISO(new Date()));
    setDateRangeEnd(fmtISO(addDays(new Date(), 6)));
  };

  const toggleCurrentDayOff = async () => {
    setMobileActionsOpen(false);
    await setDayOffForDate(current, !isDayOffOn(current));
  };

  const saveSlot = async () => {
    if (!modalApiDay || !modalStart || !modalEnd) {
      toast.error("Select a valid day and time range");
      return;
    }
    if (timeToMin(modalEnd) <= timeToMin(modalStart)) {
      toast.error("End time must be after start time");
      return;
    }
    const totalMinutes = timeToMin(modalEnd) - timeToMin(modalStart);
    if (modalAllocationMode === "time" && modalSlotMinutes <= 0) {
      toast.error("Enter a valid time per patient");
      return;
    }
    const derivedMaxPatients =
      modalAllocationMode === "time"
        ? Math.max(1, Math.round(totalMinutes / Math.max(1, modalSlotMinutes)))
        : Math.max(1, modalMaxPatients);
    if (hasOverlapForDay(modalApiDay, modalStart, modalEnd)) {
      toast.error(`Overlapping slot exists on ${DAY_API_NAMES[modalApiDay]}`);
      return;
    }

    try {
      setModalBusy(true);
      await (effectiveAssistantMode
        ? assistantAPI.addWeeklySchedule(
            {
              dayOfWeek: modalApiDay,
              startTime: modalStart,
              endTime: modalEnd,
              maxPatients: derivedMaxPatients,
              consultationType: modalConsultationType,
            },
            token,
          )
        : scheduleAPI.addWeeklySchedule(
            {
              dayOfWeek: modalApiDay,
              startTime: modalStart,
              endTime: modalEnd,
              maxPatients: derivedMaxPatients,
              consultationType: modalConsultationType,
            },
            token,
          ));
      toast.success("Time slot saved");
      setAddModal(false);
      await loadSchedule();
    } catch {
      toast.error("Failed to save time slot");
    } finally {
      setModalBusy(false);
    }
  };

  const toggleSlot = async (id, isAvailable) => {
    try {
      if (effectiveAssistantMode) {
        await assistantAPI.toggleWeeklySchedule(id, !isAvailable, token);
      } else {
        await scheduleAPI.updateWeeklyScheduleAvailability(
          id,
          !isAvailable,
          token,
        );
      }
      await loadSchedule();
    } catch {
      toast.error("Failed to update availability");
    }
  };

  const deleteSlot = (id) => {
    if (!canDeleteSlots) {
      toast.warning("Assistants cannot delete time slots.");
      return;
    }

    showConfirm({
      title: "Delete Time Slot",
      message: "Are you sure you want to delete this time slot?",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await (effectiveAssistantMode
            ? assistantAPI.deleteWeeklySchedule(id, token)
            : scheduleAPI.deleteWeeklySchedule(id, token));
          toast.success("Time slot deleted");
          await loadSchedule();
        } catch {
          toast.error("Failed to delete time slot");
        }
      },
    });
  };

  const saveBulkSlots = async () => {
    if (bulkDays.size === 0) {
      toast.error("Select at least one day");
      return;
    }
    if (timeToMin(bulkEnd) <= timeToMin(bulkStart)) {
      toast.error("End time must be after start time");
      return;
    }

    const totalMinutes = timeToMin(bulkEnd) - timeToMin(bulkStart);
    if (bulkAllocationMode === "time" && bulkSlotMinutes <= 0) {
      toast.error("Enter a valid time per patient");
      return;
    }

    const derivedMaxPatients =
      bulkAllocationMode === "time"
        ? Math.max(1, Math.round(totalMinutes / Math.max(1, bulkSlotMinutes)))
        : Math.max(1, bulkMaxPatients);

    const days = [...bulkDays].sort();
    const blockedDays = days.filter((day) =>
      hasOverlapForDay(day, bulkStart, bulkEnd),
    );
    if (blockedDays.length > 0) {
      const names = blockedDays.map((day) => DAY_API_NAMES[day]).join(", ");
      toast.error(`Overlapping slot exists on: ${names}`);
      return;
    }

    try {
      setBulkBusy(true);
      setBulkProgress({ done: 0, total: days.length });
      let completed = 0;
      const requests = days.map((day) =>
        (effectiveAssistantMode
          ? assistantAPI.addWeeklySchedule(
              {
                dayOfWeek: day,
                startTime: bulkStart,
                endTime: bulkEnd,
                maxPatients: derivedMaxPatients,
                consultationType: bulkConsultationType,
              },
              token,
            )
          : scheduleAPI.addWeeklySchedule(
              {
                dayOfWeek: day,
                startTime: bulkStart,
                endTime: bulkEnd,
                maxPatients: derivedMaxPatients,
                consultationType: bulkConsultationType,
              },
              token,
            )
        ).finally(() => {
          completed += 1;
          setBulkProgress({ done: completed, total: days.length });
        }),
      );

      const results = await Promise.allSettled(requests);
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(
          `Added slot to ${days.length} day${days.length > 1 ? "s" : ""}`,
        );
        setBulkModal(false);
      } else {
        const succeeded = days.length - failed;
        toast.error(
          `${failed}/${days.length} add request${days.length > 1 ? "s" : ""} failed (${succeeded} succeeded).`,
        );
      }
      await loadSchedule();
    } catch {
      toast.error("Failed to save one or more slots");
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  const clearBulkSlots = () => {
    if (!canDeleteSlots) {
      toast.warning("Assistants cannot clear time slots.");
      return;
    }

    if (bulkDays.size === 0) {
      toast.error("Select at least one day");
      return;
    }

    const days = [...bulkDays].sort();
    const daySet = new Set(days);
    const slotsToDelete = (scheduleData?.weeklySchedules || []).filter((s) =>
      daySet.has(s.dayOfWeek),
    );

    if (slotsToDelete.length === 0) {
      toast.info("No slots found for selected days");
      return;
    }

    showConfirm({
      title: "Clear Schedules",
      message: `Remove ${slotsToDelete.length} slot${slotsToDelete.length > 1 ? "s" : ""} from ${days.length} selected day${days.length > 1 ? "s" : ""}?`,
      confirmText: "Clear",
      variant: "danger",
      onConfirm: async () => {
        try {
          setBulkBusy(true);
          setBulkProgress({ done: 0, total: slotsToDelete.length });
          let completed = 0;
          const requests = slotsToDelete.map((slot) =>
            (effectiveAssistantMode
              ? assistantAPI.deleteWeeklySchedule(slot.weeklyScheduleId, token)
              : scheduleAPI.deleteWeeklySchedule(slot.weeklyScheduleId, token)
            ).finally(() => {
              completed += 1;
              setBulkProgress({
                done: completed,
                total: slotsToDelete.length,
              });
            }),
          );

          const results = await Promise.allSettled(requests);
          const failed = results.filter((r) => r.status === "rejected").length;

          if (failed === 0) {
            toast.success(
              `Removed ${slotsToDelete.length} slot${slotsToDelete.length > 1 ? "s" : ""}`,
            );
            setBulkModal(false);
          } else {
            const succeeded = slotsToDelete.length - failed;
            toast.error(
              `${failed}/${slotsToDelete.length} delete request${slotsToDelete.length > 1 ? "s" : ""} failed (${succeeded} succeeded).`,
            );
          }
          await loadSchedule();
        } catch {
          toast.error("Failed to clear one or more slots");
        } finally {
          setBulkBusy(false);
          setBulkProgress(null);
        }
      },
    });
  };

  const toggleBulkDay = (d) =>
    setBulkDays((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });

  const toggleDateDay = (d) =>
    setDateDays((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });

  const setDateRangePresetAndDates = (preset) => {
    if (preset === "custom") {
      setDateRangePreset("custom");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = today;
    let end = today;

    if (preset === "7d") {
      end = addDays(today, 6);
    } else if (preset === "30d") {
      end = addDays(today, 29);
    } else if (preset === "month") {
      end = getMonthEnd(today);
    }

    setDateRangePreset(preset);
    setDateRangeStart(fmtISO(start));
    setDateRangeEnd(fmtISO(end));
  };

  const applyDateOverrides = async () => {
    if (!canManageOverrides) {
      toast.warning("Assistants cannot update date overrides.");
      return;
    }

    if (dateDays.size === 0) {
      toast.error("Select at least one day");
      return;
    }

    const startDate = isoToDate(dateRangeStart);
    const endDate = isoToDate(dateRangeEnd);
    if (!startDate || !endDate) {
      toast.error("Select a valid date range");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDays = new Set(dateDays);
    const targetDates = [];

    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly < today) continue;
      const apiDay = jsDayToApi(dateOnly.getDay());
      if (selectedDays.has(apiDay)) {
        targetDates.push(dateOnly);
      }
    }

    if (targetDates.length === 0) {
      toast.info("No matching future dates in the selected range");
      return;
    }

    const overrideByDate = new Map(
      (scheduleData?.scheduleOverrides || []).map((o) => [o.overrideDate, o]),
    );

    try {
      setDateBusy(true);
      setDateProgress({ done: 0, total: targetDates.length });
      let completed = 0;

      const requests = targetDates
        .map(async (date) => {
          const iso = fmtISO(date);
          const existing = overrideByDate.get(iso);

          if (dateRangeAction === "UNAVAILABLE") {
            if (existing?.isAvailable === false) return;
            if (existing?.isAvailable === true) {
              await (effectiveAssistantMode
                ? assistantAPI.deleteScheduleOverride(
                    existing.overrideId,
                    token,
                  )
                : scheduleAPI.deleteScheduleOverride(
                    existing.overrideId,
                    token,
                  ));
            }
            await (effectiveAssistantMode
              ? assistantAPI.addScheduleOverride(
                  { overrideDate: iso, isAvailable: false },
                  token,
                )
              : scheduleAPI.addScheduleOverride(
                  { overrideDate: iso, isAvailable: false },
                  token,
                ));
            return;
          }

          if (dateRangeAction === "CLEAR") {
            if (!existing) return;
            await (effectiveAssistantMode
              ? assistantAPI.deleteScheduleOverride(existing.overrideId, token)
              : scheduleAPI.deleteScheduleOverride(existing.overrideId, token));
            return;
          }

          // AVAILABLE
          if (existing?.isAvailable === true) return;
          if (existing?.isAvailable === false) {
            await (effectiveAssistantMode
              ? assistantAPI.deleteScheduleOverride(existing.overrideId, token)
              : scheduleAPI.deleteScheduleOverride(existing.overrideId, token));
          }
          await (effectiveAssistantMode
            ? assistantAPI.addScheduleOverride(
                { overrideDate: iso, isAvailable: true },
                token,
              )
            : scheduleAPI.addScheduleOverride(
                { overrideDate: iso, isAvailable: true },
                token,
              ));
        })
        .map((p) =>
          p.finally(() => {
            completed += 1;
            setDateProgress({ done: completed, total: targetDates.length });
          }),
        );

      const results = await Promise.allSettled(requests);
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(
          `${
            dateRangeAction === "UNAVAILABLE"
              ? "Marked unavailable"
              : dateRangeAction === "AVAILABLE"
                ? "Marked available"
                : "Cleared overrides"
          } for ${targetDates.length} date${targetDates.length > 1 ? "s" : ""}`,
        );
        setDateModal(false);
      } else {
        const succeeded = targetDates.length - failed;
        toast.error(
          `${failed}/${targetDates.length} range request${targetDates.length > 1 ? "s" : ""} failed (${succeeded} succeeded).`,
        );
      }

      await loadSchedule();
    } catch {
      toast.error("Failed to apply date range updates");
    } finally {
      setDateBusy(false);
      setDateProgress(null);
    }
  };

  const isDayOffOn = (date) => {
    const override = getOverride(date);
    return Boolean(override && !override.isAvailable);
  };

  const setDayOffForDate = async (date, turnOn) => {
    if (!canManageOverrides) {
      toast.warning("Assistants cannot update day-off overrides.");
      return;
    }

    const override = getOverride(date);
    const dayOffOn = Boolean(override && !override.isAvailable);

    try {
      setOverrideBusy(true);

      if (turnOn) {
        if (dayOffOn) {
          toast.info("Day off is already on");
          return;
        }
        if (override?.isAvailable) {
          await (effectiveAssistantMode
            ? assistantAPI.deleteScheduleOverride(override.overrideId, token)
            : scheduleAPI.deleteScheduleOverride(override.overrideId, token));
        }
        await (effectiveAssistantMode
          ? assistantAPI.addScheduleOverride(
              { overrideDate: fmtISO(date), isAvailable: false },
              token,
            )
          : scheduleAPI.addScheduleOverride(
              { overrideDate: fmtISO(date), isAvailable: false },
              token,
            ));
        toast.success("Day off turned on");
      } else {
        if (!dayOffOn) {
          toast.info("Day off is already off");
          return;
        }
        await (effectiveAssistantMode
          ? assistantAPI.deleteScheduleOverride(override.overrideId, token)
          : scheduleAPI.deleteScheduleOverride(override.overrideId, token));
        toast.success("Day off turned off");
      }

      if (overrideModal) setOverrideModal(null);
      await loadSchedule();
    } catch {
      toast.error("Failed to update day off");
    } finally {
      setOverrideBusy(false);
    }
  };

  /* ── Drag-to-create ───────────────────────────────────────────── */
  const calcMinFromEvent = (ev) => {
    // Use the inner time-grid element — getBoundingClientRect().top already accounts
    // for any scroll offset, so no scrollTop arithmetic needed.
    const timeGridEl =
      view === "day" ? dayTimeGridRef.current : weekTimeGridRef.current;
    if (!timeGridEl) return 0;
    const rect = timeGridEl.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    return snapMin((y / HOUR_HEIGHT) * 60);
  };

  const handleColumnMouseDown = (e, apiDay, colKey) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-slot]")) return;
    e.preventDefault();
    cleanupDragListeners();
    const startMin = calcMinFromEvent(e);
    const initState = {
      apiDay,
      colKey,
      startMin,
      endMin: Math.min(1440, startMin + 60),
    };
    dragDataRef.current = initState;
    setDragState(initState);

    const onMove = (ev) => {
      const data = dragDataRef.current;
      if (!data) return;
      const cur = calcMinFromEvent(ev);
      const endMin = Math.min(1440, Math.max(cur, data.startMin + 15));
      const next = { ...data, endMin };
      dragDataRef.current = next;
      setDragState(next);
    };

    const onUp = () => {
      const data = dragDataRef.current;
      cleanupDragListeners();
      setDragState(null);
      if (data && data.endMin - data.startMin >= 15) {
        openAddModal(
          data.apiDay,
          minToTime(data.startMin),
          minToTime(data.endMin),
        );
      }
    };

    dragMoveHandlerRef.current = onMove;
    dragUpHandlerRef.current = onUp;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* ── Time column renderer (shared by Day & Week views) ─────── */
  const renderTimeColumn = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();
    const apiDay = jsDayToApi(date.getDay());
    const slots = getSlotsForApiDay(apiDay);
    const override = getOverride(date);

    return (
      <div
        key={fmtISO(date)}
        className={`flex-1 relative border-l border-gray-200 cursor-crosshair select-none ${isToday ? "bg-primary-50/30" : ""}`}
        style={{ height: HOUR_HEIGHT * 24 }}
        onMouseDown={(e) => handleColumnMouseDown(e, apiDay, fmtISO(date))}
      >
        {/* Hour & half-hour grid lines */}
        {HOURS.map((h) => (
          <React.Fragment key={h}>
            <div
              style={{ top: h * HOUR_HEIGHT }}
              className="absolute inset-x-0 border-t border-gray-100"
            />
            <div
              style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              className="absolute inset-x-0 border-t border-gray-50"
            />
          </React.Fragment>
        ))}

        {/* Override colour tint */}
        {override && (
          <div
            className={`absolute inset-0 pointer-events-none ${override.isAvailable ? "bg-green-400/10" : "bg-red-400/10"}`}
          />
        )}

        {/* Weekly schedule blocks */}
        {slots.map((slot) => {
          const topPx = (timeToMin(slot.startTime) / 60) * HOUR_HEIGHT;
          const heightPx = Math.max(
            ((timeToMin(slot.endTime) - timeToMin(slot.startTime)) / 60) *
              HOUR_HEIGHT,
            22,
          );
          const avail = slot.isAvailable;
          return (
            <div
              data-slot="true"
              key={slot.weeklyScheduleId}
              className={`absolute z-10 rounded-lg overflow-hidden group cursor-default shadow-sm
                                ${
                                  avail
                                    ? "bg-primary-500 border border-primary-400 text-white"
                                    : "bg-slate-300 border border-slate-400 text-slate-800"
                                }`}
              style={{ top: topPx, height: heightPx, left: 4, right: 4 }}
            >
              <div className="px-2 pt-1 text-[10px] font-semibold leading-tight truncate">
                {slot.startTime} &ndash; {slot.endTime}
              </div>
              {heightPx > 28 && (
                <div
                  className={`px-2 flex items-center gap-1 text-[9px] leading-tight font-medium flex-wrap ${avail ? "text-primary-100" : "text-slate-600"}`}
                >
                  {slot.maxPatients != null && (
                    <>
                      <Users className="w-2.5 h-2.5 flex-shrink-0" />
                      {slot.maxPatients}&nbsp;pts&nbsp;&middot;&nbsp;
                    </>
                  )}
                  {avail ? "Available" : "Off"}
                </div>
              )}
              {heightPx > 42 &&
                slot.consultationType &&
                slot.consultationType !== "BOTH" && (
                  <div className="px-2">
                    <span
                      className={`inline-block text-[8px] font-bold px-1 py-0.5 rounded leading-none ${
                        slot.consultationType === "ONLINE"
                          ? "bg-primary-400/40 text-white"
                          : "bg-orange-400/40 text-white"
                      }`}
                    >
                      {slot.consultationType === "ONLINE"
                        ? "Online"
                        : "In-Person"}
                    </span>
                  </div>
                )}
              {/* Action overlay on hover */}
              <div className="absolute inset-0 hidden group-hover:flex items-start justify-end gap-0.5 p-1 bg-black/10 rounded-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSlot(slot.weeklyScheduleId, slot.isAvailable);
                  }}
                  className="p-0.5 rounded bg-white/40 hover:bg-white/70 transition-colors"
                  title={avail ? "Mark unavailable" : "Mark available"}
                  aria-label={
                    avail ? "Mark slot unavailable" : "Mark slot available"
                  }
                >
                  {avail ? (
                    <ToggleRight className="w-3.5 h-3.5" />
                  ) : (
                    <ToggleLeft className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSlot(slot.weeklyScheduleId);
                  }}
                  className="p-0.5 rounded bg-white/40 hover:bg-red-500 hover:text-white transition-colors"
                  title="Delete slot"
                  aria-label="Delete slot"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Drag ghost */}
        {dragState &&
          dragState.colKey === fmtISO(date) &&
          (() => {
            const ghostTop = (dragState.startMin / 60) * HOUR_HEIGHT;
            const ghostH = Math.max(
              ((dragState.endMin - dragState.startMin) / 60) * HOUR_HEIGHT,
              4,
            );
            return (
              <div
                className="absolute z-20 rounded-lg bg-primary-100 border-2 border-primary-400 border-dashed pointer-events-none"
                style={{ top: ghostTop, height: ghostH, left: 4, right: 4 }}
              >
                <div className="px-2 pt-1 text-[10px] font-semibold text-primary-600 leading-tight select-none">
                  {minToTime(dragState.startMin)} &ndash;{" "}
                  {minToTime(dragState.endMin)}
                </div>
              </div>
            );
          })()}
      </div>
    );
  };

  /* ── Hour-label sidebar (shared by Day & Week views) ────────── */
  const renderHourLabels = () => (
    <div
      className="w-14 flex-shrink-0 relative bg-white"
      style={{ height: HOUR_HEIGHT * 24 }}
    >
      {HOURS.map((h) => (
        <div
          key={h}
          style={{ top: h * HOUR_HEIGHT }}
          className="absolute w-full pr-2 flex justify-end"
        >
          <span className="text-[9px] text-gray-400 leading-none -translate-y-2 select-none tracking-tight">
            {h > 0 ? fmtHour(h) : ""}
          </span>
        </div>
      ))}
    </div>
  );

  /* ════════════════════════════════════════════════════════════
       DAY VIEW
    ════════════════════════════════════════════════════════════ */
  const renderDayView = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = current.getTime() === today.getTime();
    const isPast = current < today;
    const override = getOverride(current);
    const dayOffOn = isDayOffOn(current);
    const apiDay = jsDayToApi(current.getDay());

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Scroll container — header lives inside so it shares the same width as the grid */}
        <div ref={dayGridRef} className="flex-1 overflow-y-auto">
          {/* Sticky day column header */}
          <div className="sticky top-0 z-30 flex border-b border-gray-100 bg-white">
            <div className="w-14 flex-shrink-0" />
            <div className="flex-1 flex items-center justify-between border-l border-gray-100 px-4 py-2.5 gap-3 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() =>
                    canManageOverrides && setOverrideModal(current)
                  }
                  className={`flex flex-col items-center rounded-xl px-3 py-1.5 transition-colors flex-shrink-0
                                        ${
                                          isToday
                                            ? "bg-primary-600 text-white"
                                            : "text-gray-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200"
                                        }`}
                  title="Manage day override"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest leading-tight">
                    {DAY_SHORT[current.getDay()]}
                  </span>
                  <span className="text-lg font-bold leading-tight">
                    {current.getDate()}
                  </span>
                </button>
                {override && (
                  <span
                    className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium flex-shrink-0
                                        ${
                                          override.isAvailable
                                            ? "bg-green-50 border-green-200 text-green-700"
                                            : "bg-red-50 border-red-200 text-red-700"
                                        }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${override.isAvailable ? "bg-green-500" : "bg-red-500"}`}
                    />
                    {override.isAvailable
                      ? "Available override"
                      : "Day off override"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isPast && canManageOverrides && (
                  <button
                    onClick={() => setDayOffForDate(current, !dayOffOn)}
                    disabled={overrideBusy}
                    className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors disabled:opacity-50 ${
                      dayOffOn
                        ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Day Off
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Time grid */}
          <div
            ref={dayTimeGridRef}
            className="flex"
            style={{ height: HOUR_HEIGHT * 24 }}
          >
            {renderHourLabels()}
            {renderTimeColumn(current)}
          </div>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════
       WEEK VIEW
    ════════════════════════════════════════════════════════════ */
  const renderWeekView = () => {
    const days = getVisibleWeekDays(current);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Scroll container — header lives inside so it shares the same width as the grid */}
        <div
          ref={weekGridRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          {/* Sticky week column headers */}
          <div className="sticky top-0 z-30 flex border-b border-gray-100 bg-white">
            <div className="w-14 flex-shrink-0" />
            {days.map((d, i) => {
              const isToday = d.getTime() === today.getTime();
              const isPast = d < today;
              const override = getOverride(d);
              const apiDay = jsDayToApi(d.getDay());
              return (
                <div
                  key={i}
                  className={`flex-1 flex flex-col items-center py-2 border-l border-gray-100 min-w-0 relative ${override && !override.isAvailable ? "bg-red-50/40" : ""}`}
                >
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-widest leading-tight ${isToday ? "text-primary-500" : "text-gray-400"}`}
                  >
                    {DAY_SHORT[d.getDay()]}
                  </span>
                  <button
                    onClick={() => canManageOverrides && setOverrideModal(d)}
                    className={`w-8 h-8 mt-0.5 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                                            ${isToday ? "bg-primary-600 text-white shadow-sm" : "text-gray-700 hover:bg-white hover:shadow-sm"}`}
                    title="Manage day override"
                    aria-label={`Manage override for ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                  >
                    {d.getDate()}
                  </button>
                  <div className="h-1.5 mt-0.5 flex items-center justify-center">
                    {override && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${override.isAvailable ? "bg-green-500" : "bg-red-400"}`}
                      />
                    )}
                  </div>
                  <div className="absolute top-1 right-0.5 flex items-center">
                    {!isPast && (
                      <button
                        onClick={() => setDayOffForDate(d, !isDayOffOn(d))}
                        style={{
                          display: canManageOverrides ? "inline-flex" : "none",
                        }}
                        className={`w-4 h-4 rounded flex items-center justify-center transition-colors
                                                    ${
                                                      override &&
                                                      !override.isAvailable
                                                        ? "text-red-400 hover:text-red-600"
                                                        : "text-gray-300 hover:bg-red-50 hover:text-red-400"
                                                    }`}
                        title={`Day Off: ${isDayOffOn(d) ? "On" : "Off"} (click to toggle)`}
                        aria-label={`Turn day off ${isDayOffOn(d) ? "off" : "on"} for ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                      >
                        <Ban className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openAddModal(apiDay)}
                      className="w-4 h-4 rounded flex items-center justify-center hover:bg-primary-100 text-gray-300 hover:text-primary-600 transition-colors"
                      title={`Add slot for ${DAY_API_NAMES[apiDay]}`}
                      aria-label={`Add slot for ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            ref={weekTimeGridRef}
            className="flex"
            style={{ height: HOUR_HEIGHT * 24 }}
          >
            {renderHourLabels()}
            {days.map((d) => renderTimeColumn(d))}
          </div>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════
       YEAR VIEW  (12 mini-month calendars)
    ════════════════════════════════════════════════════════════ */
  const renderYearView = () => {
    const year = current.getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {MONTH_FULL.map((monthName, mi) => {
            const firstDow = new Date(year, mi, 1).getDay(); // 0 = Sun
            const blanks = firstDow; // Sunday-first: no adjustment needed
            const daysInMonth = new Date(year, mi + 1, 0).getDate();
            const isCurMonth =
              mi === today.getMonth() && year === today.getFullYear();

            return (
              <div
                key={mi}
                className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${
                  isCurMonth
                    ? "border-primary-200 shadow-sm"
                    : "border-gray-200"
                }`}
              >
                {/* Month name */}
                <div
                  className={`text-sm font-bold mb-3 ${isCurMonth ? "text-primary-600" : "text-gray-700"}`}
                >
                  {monthName}
                </div>
                {/* Weekday labels */}
                <div className="grid grid-cols-7 mb-1">
                  {["S", "M", "T", "W", "T", "F", "S"].map((l, li) => (
                    <div
                      key={li}
                      className="text-center text-[9px] text-gray-400 font-semibold"
                    >
                      {l}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: blanks }, (_, i) => (
                    <div key={`b${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const cellDate = new Date(year, mi, day);
                    const isToday = cellDate.getTime() === today.getTime();
                    const isPast = cellDate < today;
                    const override = getOverride(cellDate);

                    return (
                      <div key={day} className="relative group">
                        <button
                          onClick={() => {
                            if (isPast || isToday) return;
                            setCurrent(cellDate);
                            setView("day");
                          }}
                          className={`w-full text-center leading-6 text-[11px] rounded-full transition-colors relative
                                                        ${
                                                          isToday
                                                            ? "bg-primary-600 text-white font-bold shadow-sm cursor-default"
                                                            : isPast
                                                              ? "text-gray-300 cursor-default"
                                                              : override &&
                                                                  !override.isAvailable
                                                                ? "bg-red-100 text-red-500 hover:bg-primary-100 hover:text-primary-600 cursor-pointer"
                                                                : "text-gray-700 hover:bg-primary-50 hover:text-primary-700 cursor-pointer"
                                                        }`}
                        >
                          {day}
                          {override && !isToday && (
                            <span
                              className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full
                                                                ${override.isAvailable ? "bg-green-500" : "bg-red-400"}`}
                            />
                          )}
                        </button>
                        {!isPast && !isToday && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDayOffForDate(cellDate, !isDayOffOn(cellDate));
                            }}
                            style={{
                              display: canManageOverrides
                                ? "inline-flex"
                                : "none",
                            }}
                            className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full hidden group-hover:flex items-center justify-center z-10 transition-colors
                                                            ${
                                                              override &&
                                                              !override.isAvailable
                                                                ? "bg-red-400 text-white hover:bg-green-500"
                                                                : "bg-gray-200 text-gray-500 hover:bg-red-400 hover:text-white"
                                                            }`}
                            title={`Day Off: ${isDayOffOn(cellDate) ? "On" : "Off"} (click to toggle)`}
                            aria-label={`Turn day off ${isDayOffOn(cellDate) ? "off" : "on"} for ${cellDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                          >
                            <Ban className="w-2 h-2" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100 flex-wrap">
          <span className="text-xs text-gray-500 font-semibold">Legend</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-xs text-gray-500">Available override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className="text-xs text-gray-500">Off override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0" />
            <span className="text-xs text-gray-500">Today</span>
          </div>
          <p className="text-xs text-gray-400 ml-auto">
            Click a day to open it &middot; hover for the{" "}
            <Ban className="inline w-2.5 h-2.5 mb-0.5" /> icon to toggle day off
            on/off
          </p>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════
       BULK ADD MODAL
    ════════════════════════════════════════════════════════════ */
  const renderBulkModal = () => {
    // API days: 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun
    const DAY_PILLS = [
      { api: 1, short: "Mon" },
      { api: 2, short: "Tue" },
      { api: 3, short: "Wed" },
      { api: 4, short: "Thu" },
      { api: 5, short: "Fri" },
      { api: 6, short: "Sat" },
      { api: 7, short: "Sun" },
    ];
    const allWeekdays = new Set([1, 2, 3, 4, 5]);
    const allWeekends = new Set([6, 7]);
    const allDays = new Set([1, 2, 3, 4, 5, 6, 7]);
    const setsEqual = (a, b) =>
      a.size === b.size && [...a].every((v) => b.has(v));

    return (
      <div
        className={MODAL_BACKDROP_CLASS}
        onClick={() => {
          if (!bulkBusy) setBulkModal(false);
        }}
      >
        <div className={MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-800 text-base">
                Bulk Schedule Actions
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Apply one action across multiple days.
              </p>
            </div>
            <button
              onClick={() => setBulkModal(false)}
              className={MODAL_CLOSE_BUTTON_CLASS}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode selector */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-1 mb-4">
            <button
              onClick={() => setBulkMode("add")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                bulkMode === "add"
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Add Slot
            </button>
            <button
              onClick={() => setBulkMode("clear")}
              style={{ display: canDeleteSlots ? "block" : "none" }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                bulkMode === "clear"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Clear Days
            </button>
          </div>

          {bulkMode === "add" && (
            <>
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                Note: patient number and slot time are approximate when bulk
                slots are generated.
              </div>

              {/* Time + allocation */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {bulkAllocationMode === "patients" ? (
                  <div className="col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-medium text-gray-600">
                        Max Patients per Slot
                      </label>
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setBulkAllocationMode("patients")}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white text-primary-600 shadow-sm"
                        >
                          By Patients
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkAllocationMode("time")}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md text-gray-500 hover:text-gray-700"
                        >
                          By Time
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={bulkMaxPatients}
                        onChange={(e) =>
                          setBulkMaxPatients(
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-500 flex items-center gap-1 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5" /> patients
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-medium text-gray-600">
                        Time per Patient
                      </label>
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setBulkAllocationMode("patients")}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md text-gray-500 hover:text-gray-700"
                        >
                          By Patients
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkAllocationMode("time")}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white text-primary-600 shadow-sm"
                        >
                          By Time
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="5"
                        max="240"
                        step="5"
                        value={bulkSlotMinutes}
                        onChange={(e) =>
                          setBulkSlotMinutes(
                            Math.max(5, parseInt(e.target.value) || 5),
                          )
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-500 flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" /> minutes
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Day selector */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">
                {bulkMode === "add" ? "Apply to days" : "Clear days"}
              </label>
              <div className="flex gap-1">
                {[
                  ["Weekdays", allWeekdays],
                  ["Weekends", allWeekends],
                  ["All", allDays],
                ].map(([label, set]) => (
                  <button
                    key={label}
                    onClick={() => setBulkDays(new Set(set))}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-colors
                                            ${
                                              setsEqual(bulkDays, set)
                                                ? "bg-primary-600 text-white border-primary-600"
                                                : "text-gray-500 border-gray-300 hover:border-primary-400 hover:text-primary-600"
                                            }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_PILLS.map(({ api, short }) => (
                <button
                  key={api}
                  onClick={() => toggleBulkDay(api)}
                  className={`flex-1 min-w-[2.5rem] py-2 text-xs font-semibold rounded-lg border transition-colors
                                        ${
                                          bulkDays.has(api)
                                            ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                                            : "text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600 bg-gray-50"
                                        }`}
                >
                  {short}
                </button>
              ))}
            </div>
            {bulkDays.size === 0 && (
              <p className="text-[10px] text-red-500 mt-1.5">
                Select at least one day.
              </p>
            )}
          </div>

          {bulkMode === "add" && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Consultation Type
              </label>
              <div className="flex gap-2">
                {CONSULT_TYPES.map(({ value, label, color, activeColor }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBulkConsultationType(value)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      bulkConsultationType === value ? activeColor : color
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {bulkDays.size > 0 && bulkMode === "add" && (
            <div className="bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 mb-4 text-xs text-primary-700">
              Will create{" "}
              <strong>
                {bulkStart}&ndash;{bulkEnd}
              </strong>{" "}
              (
              {bulkAllocationMode === "time"
                ? `${Math.max(1, Math.round((timeToMin(bulkEnd) - timeToMin(bulkStart)) / Math.max(1, bulkSlotMinutes)))} pts approx. from ${bulkSlotMinutes} min each`
                : `${bulkMaxPatients} pts approx. from time range`}
              ,{" "}
              {
                CONSULT_TYPES.find((t) => t.value === bulkConsultationType)
                  ?.label
              }
              ) on{" "}
              <strong>
                {[...bulkDays]
                  .sort()
                  .map((d) => DAY_PILLS.find((p) => p.api === d)?.short)
                  .join(", ")}
              </strong>
            </div>
          )}

          {bulkDays.size > 0 && bulkMode === "clear" && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4 text-xs text-red-700">
              Will remove all recurring slots on{" "}
              <strong>
                {[...bulkDays]
                  .sort()
                  .map((d) => DAY_PILLS.find((p) => p.api === d)?.short)
                  .join(", ")}
              </strong>
              .
            </div>
          )}

          {/* Progress bar */}
          {bulkProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>
                  {bulkMode === "add" ? "Saving&hellip;" : "Clearing&hellip;"}
                </span>
                <span>
                  {bulkProgress.done} / {bulkProgress.total}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(bulkProgress.done / bulkProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setBulkModal(false)}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              disabled={bulkBusy}
            >
              Cancel
            </button>
            <button
              onClick={bulkMode === "add" ? saveBulkSlots : clearBulkSlots}
              className={`flex-1 py-2 text-sm text-white rounded-lg disabled:opacity-50 font-semibold flex items-center justify-center gap-1.5 ${
                bulkMode === "add"
                  ? "bg-primary-600 hover:bg-primary-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              disabled={bulkBusy || bulkDays.size === 0}
            >
              {bulkBusy
                ? bulkMode === "add"
                  ? "Saving…"
                  : "Clearing…"
                : bulkMode === "add"
                  ? `Add to ${bulkDays.size} day${bulkDays.size !== 1 ? "s" : ""}`
                  : `Clear Slots from ${bulkDays.size} day${bulkDays.size !== 1 ? "s" : ""}`}
              {bulkMode === "clear" && !bulkBusy && (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDateModal = () => {
    const DAY_PILLS = [
      { api: 1, short: "Mon" },
      { api: 2, short: "Tue" },
      { api: 3, short: "Wed" },
      { api: 4, short: "Thu" },
      { api: 5, short: "Fri" },
      { api: 6, short: "Sat" },
      { api: 7, short: "Sun" },
    ];
    const allWeekdays = new Set([1, 2, 3, 4, 5]);
    const allWeekends = new Set([6, 7]);
    const allDays = new Set([1, 2, 3, 4, 5, 6, 7]);
    const setsEqual = (a, b) =>
      a.size === b.size && [...a].every((v) => b.has(v));

    return (
      <div
        className={MODAL_BACKDROP_CLASS}
        onClick={() => {
          if (!dateBusy) setDateModal(false);
        }}
      >
        <div className={MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-800 text-base">
                Date-wise Availability
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Apply availability changes within a date range.
              </p>
            </div>
            <button
              onClick={() => setDateModal(false)}
              className={MODAL_CLOSE_BUTTON_CLASS}
              disabled={dateBusy}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Range Preset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  ["7d", "Next 7 days"],
                  ["30d", "Next 30 days"],
                  ["month", "This month"],
                  ["custom", "Custom"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDateRangePresetAndDates(value)}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-colors ${
                      dateRangePreset === value
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-600 border-gray-300 hover:text-gray-800 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  min={fmtISO(new Date())}
                  value={dateRangeStart}
                  onChange={(e) => {
                    setDateRangePreset("custom");
                    setDateRangeStart(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  min={dateRangeStart || fmtISO(new Date())}
                  value={dateRangeEnd}
                  onChange={(e) => {
                    setDateRangePreset("custom");
                    setDateRangeEnd(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">
                Filter weekdays
              </label>
              <div className="flex gap-1">
                {[
                  ["Weekdays", allWeekdays],
                  ["Weekends", allWeekends],
                  ["All", allDays],
                ].map(([label, set]) => (
                  <button
                    key={label}
                    onClick={() => setDateDays(new Set(set))}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-colors ${
                      setsEqual(dateDays, set)
                        ? "bg-primary-600 text-white border-primary-600"
                        : "text-gray-500 border-gray-300 hover:border-primary-400 hover:text-primary-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_PILLS.map(({ api, short }) => (
                <button
                  key={api}
                  onClick={() => toggleDateDay(api)}
                  className={`flex-1 min-w-[2.5rem] py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    dateDays.has(api)
                      ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                      : "text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600 bg-gray-50"
                  }`}
                >
                  {short}
                </button>
              ))}
            </div>
            {dateDays.size === 0 && (
              <p className="text-[10px] text-red-500 mt-1.5">
                Select at least one day.
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Action
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDateRangeAction("UNAVAILABLE")}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  dateRangeAction === "UNAVAILABLE"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-600 border-gray-300 hover:text-gray-800 hover:border-gray-400"
                }`}
              >
                Mark Unavailable
              </button>
              <button
                type="button"
                onClick={() => setDateRangeAction("AVAILABLE")}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  dateRangeAction === "AVAILABLE"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-300 hover:text-gray-800 hover:border-gray-400"
                }`}
              >
                Mark Available
              </button>
              <button
                type="button"
                onClick={() => setDateRangeAction("CLEAR")}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  dateRangeAction === "CLEAR"
                    ? "bg-gray-700 text-white border-gray-700"
                    : "bg-white text-gray-600 border-gray-300 hover:text-gray-800 hover:border-gray-400"
                }`}
              >
                Clear Overrides
              </button>
            </div>
          </div>

          {dateDays.size > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
              Will{" "}
              <strong>
                {dateRangeAction === "UNAVAILABLE"
                  ? "mark unavailable"
                  : dateRangeAction === "AVAILABLE"
                    ? "mark available"
                    : "clear overrides"}
              </strong>{" "}
              for selected weekdays between <strong>{dateRangeStart}</strong>{" "}
              and <strong>{dateRangeEnd}</strong>.
            </div>
          )}

          {dateProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Applying&hellip;</span>
                <span>
                  {dateProgress.done} / {dateProgress.total}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(dateProgress.done / dateProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setDateModal(false)}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              disabled={dateBusy}
            >
              Cancel
            </button>
            <button
              onClick={applyDateOverrides}
              className={`flex-1 py-2 text-sm text-white rounded-lg disabled:opacity-50 font-semibold ${
                dateRangeAction === "UNAVAILABLE"
                  ? "bg-red-600 hover:bg-red-700"
                  : dateRangeAction === "AVAILABLE"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-700 hover:bg-gray-800"
              }`}
              disabled={dateBusy || dateDays.size === 0}
            >
              {dateBusy ? "Applying…" : "Apply Date Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════
       ADD SLOT MODAL
    ════════════════════════════════════════════════════════════ */
  const renderAddSlotModal = () => (
    <div
      className={MODAL_BACKDROP_CLASS}
      onClick={() => {
        if (!modalBusy) setAddModal(false);
      }}
    >
      <div className={MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-800 text-base">
              Add Time Slot
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {DAY_API_NAMES[modalApiDay]}
            </p>
          </div>
          <button
            onClick={() => setAddModal(false)}
            className={MODAL_CLOSE_BUTTON_CLASS}
            disabled={modalBusy}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={modalStart}
                onChange={(e) => setModalStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={modalEnd}
                onChange={(e) => setModalEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            Note: patient number and slot time are approximate when the slot is
            generated.
          </div>
          {modalAllocationMode === "patients" ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs font-medium text-gray-600">
                  Max Patients
                </label>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalAllocationMode("patients")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white text-primary-600 shadow-sm"
                  >
                    By Patients
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAllocationMode("time")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md text-gray-500 hover:text-gray-700"
                  >
                    By Time
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={modalMaxPatients}
                  onChange={(e) =>
                    setModalMaxPatients(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> patients
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs font-medium text-gray-600">
                  Time per Patient
                </label>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalAllocationMode("patients")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md text-gray-500 hover:text-gray-700"
                  >
                    By Patients
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAllocationMode("time")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white text-primary-600 shadow-sm"
                  >
                    By Time
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="240"
                  step="5"
                  value={modalSlotMinutes}
                  onChange={(e) =>
                    setModalSlotMinutes(
                      Math.max(5, parseInt(e.target.value) || 5),
                    )
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> minutes
                </span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Consultation Type
            </label>
            <div className="flex gap-2">
              {CONSULT_TYPES.map(({ value, label, color, activeColor }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setModalConsultationType(value)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    modalConsultationType === value ? activeColor : color
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setAddModal(false)}
            className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            disabled={modalBusy}
          >
            Cancel
          </button>
          <button
            onClick={saveSlot}
            className="flex-1 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            disabled={modalBusy}
          >
            {modalBusy ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════
       OVERRIDE MODAL
    ════════════════════════════════════════════════════════════ */
  const renderOverrideModal = () => {
    const date = overrideModal;
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = date < today;
    const override = getOverride(date);
    const dayOffOn = isDayOffOn(date);
    const label = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <div
        className={MODAL_BACKDROP_CLASS}
        onClick={() => {
          if (!overrideBusy) setOverrideModal(null);
        }}
      >
        <div className={MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 text-base leading-snug">
                {label}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Day override</p>
            </div>
            <button
              onClick={() => setOverrideModal(null)}
              className={MODAL_CLOSE_BUTTON_CLASS}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isPast ? (
            <p className="text-sm text-gray-500">This date is in the past.</p>
          ) : override ? (
            <div className="space-y-3">
              <div
                className={`p-3 rounded-lg text-sm border ${
                  override.isAvailable
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                Currently:{" "}
                <strong>
                  {override.isAvailable
                    ? "Available (override)"
                    : "Off (override)"}
                </strong>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDayOffForDate(date, !dayOffOn)}
                  className={`flex-1 py-2 text-sm text-white rounded-lg disabled:opacity-50 font-semibold ${
                    dayOffOn
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                  disabled={overrideBusy}
                >
                  {overrideBusy
                    ? "\u2026"
                    : `Turn Day Off ${dayOffOn ? "Off" : "On"}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                No override — using your weekly schedule.
              </p>
              <button
                onClick={() => setDayOffForDate(date, true)}
                className="w-full py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                disabled={overrideBusy}
              >
                {overrideBusy ? "…" : "Turn Day Off On"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════
       LOADING STATE
    ════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-100 border-t-primary-600" />
          <p className="text-sm text-gray-500">Loading schedule\u2026</p>
        </div>
      </DashboardLayout>
    );
  }

  /* ════════════════════════════════════════════════════════════
       MAIN RENDER
    ════════════════════════════════════════════════════════════ */
  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-[calc(100dvh-5.5rem)] md:min-h-[calc(100vh-5.5rem)] min-w-0">
        {/* ── Page header ── */}
        <div className="mb-4 md:mb-5 flex items-center gap-3 flex-shrink-0">
          <h1 className="app-page-title">My Schedule</h1>
        </div>

        {/* Assistant view note removed as requested */}

        {/* Error banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between flex-shrink-0">
            <span>{error}</span>
            <button
              onClick={loadSchedule}
              className="font-medium underline ml-3"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Calendar card ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0 flex-wrap">
            {/* Today */}
            <button
              onClick={goToday}
              className="px-3.5 py-1.5 text-sm border border-gray-300 rounded-full hover:bg-gray-50 text-gray-700 font-medium transition-colors"
            >
              Today
            </button>

            {/* Prev / Next */}
            <div className="flex gap-0.5">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => navigate(1)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Date label */}
            <h2 className="hidden sm:block text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">
              {getHeaderLabel()}
            </h2>

            {/* Segmented view control */}
            <div className="flex flex-1 sm:flex-none justify-center sm:justify-start items-center bg-gray-100 rounded-full p-0.5 gap-0.5 shrink-0">
              {[
                { key: "day", label: "Day" },
                { key: "week", label: "Week" },
                { key: "year", label: "Year" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all ${
                    view === key
                      ? "bg-white shadow-sm text-primary-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
              <button
                onClick={() => {
                  setBulkModal(true);
                  setBulkMode("add");
                  setBulkDays(new Set([1, 2, 3, 4, 5]));
                  setBulkStart("09:00");
                  setBulkEnd("17:00");
                  setBulkMaxPatients(10);
                  setBulkAllocationMode("patients");
                  setBulkSlotMinutes(30);
                  setBulkConsultationType("BOTH");
                  setDateDays(new Set([1, 2, 3, 4, 5]));
                  setDateRangeAction("UNAVAILABLE");
                  setDateRangePreset("7d");
                  setDateRangeStart(fmtISO(new Date()));
                  setDateRangeEnd(fmtISO(addDays(new Date(), 6)));
                }}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 text-xs sm:text-sm font-semibold rounded-full hover:bg-gray-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Edit Schedule
              </button>
              <button
                onClick={openMainAddModal}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white text-xs sm:text-sm font-semibold rounded-full hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Time Slot
              </button>
            </div>

            <div className="relative ml-auto sm:hidden" ref={mobileActionsRef}>
              <button
                type="button"
                onClick={() => setMobileActionsOpen((prev) => !prev)}
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
                aria-haspopup="menu"
                aria-expanded={mobileActionsOpen}
                aria-label="Open schedule actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {mobileActionsOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={openMobileEditSchedule}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                    Edit Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileActionsOpen(false);
                      openMainAddModal();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4 text-primary-600" />
                    Add Time Slot
                  </button>
                  <button
                    type="button"
                    onClick={toggleCurrentDayOff}
                    disabled={!canManageOverrides || overrideBusy}
                    className={`flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDayOffOn(current)
                        ? "text-red-700 hover:bg-red-50"
                        : "text-green-700 hover:bg-green-50"
                    }`}
                  >
                    <Ban
                      className={`w-4 h-4 ${isDayOffOn(current) ? "text-red-500" : "text-green-600"}`}
                    />
                    Day Off
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* View content */}
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            {view === "day" && renderDayView()}
            {view === "week" && renderWeekView()}
            {view === "year" && renderYearView()}
          </div>
        </div>
      </div>

      {/* Modals */}
      {bulkModal && renderBulkModal()}
      {canManageOverrides && dateModal && renderDateModal()}
      {addModal && renderAddSlotModal()}
      {canManageOverrides && overrideModal && renderOverrideModal()}
      <ConfirmDialog />
    </DashboardLayout>
  );
};

export default Schedule;
