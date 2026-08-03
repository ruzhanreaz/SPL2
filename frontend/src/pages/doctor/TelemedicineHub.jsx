import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Search,
  Video,
  ArrowLeft,
  MessageSquare,
  ChevronRight,
  Stethoscope,
  X,
} from "lucide-react";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import PageEmptyState from "../../components/ui/PageEmptyState";
import ConsultationRoom from "../consultation/ConsultationRoom";
import ReturnToConsultationDashboardButton from "../../components/consultation/ReturnToConsultationDashboardButton";
import { appointmentAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";

/* ── Status config ──────────────────────────────────────── */
const STATUS_CONFIG = {
  CONFIRMED: {
    label: "Confirmed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  SCHEDULED: {
    label: "Scheduled",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-gray-400",
    pill: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  },
  IN_PROGRESS: {
    label: "In Progress",
    dot: "bg-amber-500 animate-pulse",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || {
    label: status,
    dot: "bg-gray-400",
    pill: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  };

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

const formatTime = (timeString) => {
  if (!timeString) return "TBD";
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const getAppointmentTimestamp = (appointment) => {
  if (!appointment?.appointmentDate) return 0;
  const iso = `${appointment.appointmentDate}T${appointment.appointmentTime || "00:00:00"}`;
  const parsed = new Date(iso).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isInProgressConversation = (conversation) =>
  conversation?.appointmentForRoom?.status === "IN_PROGRESS";

/* ── Avatar ─────────────────────────────────────────────── */
const Avatar = ({ name, size = "md", selected = false }) => {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };
  return (
    <div
      className={`${sizes[size]} shrink-0 rounded-full font-semibold flex items-center justify-center transition-colors ${
        selected
          ? "bg-primary-600 text-white shadow-md shadow-primary-200"
          : "bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700"
      }`}
    >
      {getInitials(name)}
    </div>
  );
};

/* ── Conversation list item ─────────────────────────────── */
const ConversationItem = ({ conversation, isSelected, onClick }) => {
  const appointment = conversation.latestAppointment;
  const status = getStatusConfig(appointment.status);
  const isActive =
    appointment.status === "IN_PROGRESS" || appointment.status === "CONFIRMED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl transition-all group relative ${
        isSelected ? "bg-primary-50 shadow-sm" : "hover:bg-gray-50"
      }`}
    >
      {isSelected && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary-600 rounded-r-full" />
      )}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={appointment.patientName} selected={isSelected} />
          {isActive && (
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${status.dot}`}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p
              className={`text-sm font-semibold truncate ${isSelected ? "text-primary-900" : "text-gray-900"}`}
            >
              {appointment.patientName}
            </p>
            <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
              {formatTime(appointment.appointmentTime)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 truncate">
              {appointment.notes || "No notes"}
            </p>
            <span
              className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${status.pill}`}
            >
              {status.label}
            </span>
          </div>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0 lg:hidden" />
      </div>
    </button>
  );
};

/* ── Sidebar ────────────────────────────────────────────── */
const Sidebar = ({
  filteredConversations,
  selectedPairKey,
  onSelect,
  searchTerm,
  onSearch,
  showActiveOnly,
  onToggleActiveOnly,
  activeCount,
}) => (
  <aside className="flex flex-col h-full bg-white">
    {/* Header */}
    <div className="px-4 pt-5 pb-3 shrink-0">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
          <Stethoscope className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 leading-none">
            Telemedicine
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {filteredConversations.length} patient
            {filteredConversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search patients…"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:bg-white transition-all"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onToggleActiveOnly}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            showActiveOnly
              ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${showActiveOnly ? "bg-amber-500 animate-pulse" : "bg-gray-400"}`}
          />
          Active Now ({activeCount})
        </button>
      </div>
    </div>

    {/* List */}
    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
      {filteredConversations.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">No patients found</p>
          <p className="text-xs text-gray-300 mt-0.5">
            Try adjusting your search
          </p>
        </div>
      ) : (
        filteredConversations.map((conversation) => (
          <ConversationItem
            key={conversation.pairKey}
            conversation={conversation}
            isSelected={conversation.pairKey === selectedPairKey}
            onClick={() => onSelect(conversation.pairKey)}
          />
        ))
      )}
    </div>
  </aside>
);

/* ── Empty state placeholder ────────────────────────────── */
const RoomPlaceholder = () => (
  <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-gradient-to-b from-gray-50/80 to-white">
    <div className="w-20 h-20 rounded-3xl bg-primary-50 flex items-center justify-center mb-5 shadow-sm">
      <MessageSquare className="w-9 h-9 text-primary-300" />
    </div>
    <p className="text-base font-semibold text-gray-700 mb-1.5">
      No conversation selected
    </p>
    <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
      Select a patient from the list to open the consultation room.
    </p>
  </div>
);

/* ── Main component ─────────────────────────────────────── */
const DoctorTelemedicineHub = () => {
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [selectedPairKey, setSelectedPairKey] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [hasManualActiveFilterChange, setHasManualActiveFilterChange] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOnlineAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentAPI.getDoctorAppointments(token);
      const onlineAppointments = data.filter(
        (apt) =>
          apt.appointmentType === "ONLINE" &&
          (apt.status === "CONFIRMED" ||
            apt.status === "SCHEDULED" ||
            apt.status === "IN_PROGRESS" ||
            apt.status === "COMPLETED"),
      );
      setAppointments(onlineAppointments);
    } catch (err) {
      setError(err.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOnlineAppointments();
  }, [fetchOnlineAppointments]);

  const conversations = useMemo(() => {
    const activeStatuses = new Set(["CONFIRMED", "SCHEDULED", "IN_PROGRESS"]);
    const byPair = new Map();

    appointments.forEach((appointment) => {
      const pairKey = `${appointment.doctorId}-${appointment.patientId}`;
      if (!byPair.has(pairKey)) {
        byPair.set(pairKey, {
          pairKey,
          latestAppointment: appointment,
          activeAppointment: activeStatuses.has(appointment.status)
            ? appointment
            : null,
        });
        return;
      }
      const current = byPair.get(pairKey);
      if (
        !current.activeAppointment &&
        activeStatuses.has(appointment.status)
      ) {
        current.activeAppointment = appointment;
      }
    });

    return Array.from(byPair.values())
      .map((entry) => ({
        ...entry,
        appointmentForRoom: entry.activeAppointment || entry.latestAppointment,
      }))
      .sort((a, b) => {
        const activePriorityA = isInProgressConversation(a) ? 0 : 1;
        const activePriorityB = isInProgressConversation(b) ? 0 : 1;
        if (activePriorityA !== activePriorityB) {
          return activePriorityA - activePriorityB;
        }
        return (
          getAppointmentTimestamp(b.appointmentForRoom) -
          getAppointmentTimestamp(a.appointmentForRoom)
        );
      });
  }, [appointments]);

  const activeCount = useMemo(
    () => conversations.filter(isInProgressConversation).length,
    [conversations],
  );

  useEffect(() => {
    if (hasManualActiveFilterChange) {
      return;
    }
    setShowActiveOnly(activeCount > 0);
  }, [activeCount, hasManualActiveFilterChange]);

  const handleToggleActiveOnly = useCallback(() => {
    setHasManualActiveFilterChange(true);
    setShowActiveOnly((prev) => !prev);
  }, []);

  const filteredConversations = useMemo(() => {
    const base = showActiveOnly
      ? conversations.filter(isInProgressConversation)
      : conversations;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return base;
    return base.filter((conversation) => {
      const appointment = conversation.latestAppointment;
      const text = `${appointment.patientName || ""} ${appointment.patientEmail || ""} ${appointment.appointmentTime || ""} ${appointment.notes || ""}`;
      return text.toLowerCase().includes(query);
    });
  }, [conversations, searchTerm, showActiveOnly]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.pairKey === selectedPairKey) || null,
    [conversations, selectedPairKey],
  );

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedPairKey(null);
      return;
    }
    const queryAppointmentId = searchParams.get("appointmentId");
    const queryConversation = queryAppointmentId
      ? conversations.find(
          (c) =>
            String(c.latestAppointment.appointmentId) ===
              String(queryAppointmentId) ||
            String(c.appointmentForRoom.appointmentId) ===
              String(queryAppointmentId),
        )
      : null;

    setSelectedPairKey((prev) => {
      if (queryConversation) return queryConversation.pairKey;
      if (prev && conversations.some((c) => c.pairKey === prev)) return prev;
      return null;
    });
  }, [conversations, searchParams]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoadingState message="Loading online appointments..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageErrorState message={error} onRetry={fetchOnlineAppointments} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100dvh-80px)] overflow-hidden">
        <div className="mb-2 flex justify-end">
          <ReturnToConsultationDashboardButton
            patientId={selectedConversation?.appointmentForRoom?.patientId}
          />
        </div>
        {appointments.length === 0 ? (
          <PageEmptyState
            icon={Video}
            title="No online appointments scheduled"
            description="Online appointments will appear here when patients book telemedicine consultations"
          />
        ) : (
          <div className="flex-1 min-h-0 mt-2 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {/* ── Desktop: WhatsApp-style two-column layout ── */}
            <div className="hidden lg:flex h-full">
              {/* Sidebar — fixed width, always visible */}
              <div className="w-[300px] xl:w-[320px] shrink-0 border-r border-gray-100 h-full overflow-hidden">
                <Sidebar
                  filteredConversations={filteredConversations}
                  selectedPairKey={selectedPairKey}
                  onSelect={setSelectedPairKey}
                  searchTerm={searchTerm}
                  onSearch={setSearchTerm}
                  showActiveOnly={showActiveOnly}
                  onToggleActiveOnly={handleToggleActiveOnly}
                  activeCount={activeCount}
                />
              </div>

              {/* Main chat area — takes remaining space */}
              <section className="flex-1 min-w-0 h-full overflow-hidden">
                {selectedConversation ? (
                  <ConsultationRoom
                    participantRole="doctor"
                    embedded
                    appointmentIdOverride={String(
                      selectedConversation.appointmentForRoom.appointmentId,
                    )}
                  />
                ) : (
                  <RoomPlaceholder />
                )}
              </section>
            </div>

            {/* ── Mobile: stacked, WhatsApp-style navigation ── */}
            <div className="lg:hidden h-full flex flex-col overflow-hidden">
              {selectedConversation ? (
                <>
                  {/* Mobile chat header with back button */}
                  <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shadow-sm z-10">
                    <button
                      type="button"
                      onClick={() => setSelectedPairKey(null)}
                      className="p-1.5 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                      aria-label="Back to list"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <Avatar
                      name={selectedConversation.latestAppointment.patientName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                        {selectedConversation.latestAppointment.patientName}
                      </p>
                      <p className="text-[11px] text-gray-400 leading-tight">
                        {formatTime(
                          selectedConversation.latestAppointment
                            .appointmentTime,
                        )}
                        {" · "}
                        {
                          getStatusConfig(
                            selectedConversation.latestAppointment.status,
                          ).label
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ConsultationRoom
                      participantRole="doctor"
                      embedded
                      onBack={() => setSelectedPairKey(null)}
                      appointmentIdOverride={String(
                        selectedConversation.appointmentForRoom.appointmentId,
                      )}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Sidebar
                    filteredConversations={filteredConversations}
                    selectedPairKey={selectedPairKey}
                    onSelect={setSelectedPairKey}
                    searchTerm={searchTerm}
                    onSearch={setSearchTerm}
                    showActiveOnly={showActiveOnly}
                    onToggleActiveOnly={handleToggleActiveOnly}
                    activeCount={activeCount}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorTelemedicineHub;
