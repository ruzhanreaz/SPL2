import React, { useState, useEffect, useRef, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  Users,
  ChevronRight,
  SkipForward,
  Clock,
  AlertCircle,
  Play,
  Hash,
  Wifi,
  WifiOff,
  Timer,
  Star,
  Video,
  MapPin,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { queueAPI } from "../utils/api";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "./ToastProvider";

const STATUS_STYLE = {
  IN_PROGRESS: "bg-primary-100 text-primary-700 border-primary-200",
  CONFIRMED: "bg-green-100 text-green-700 border-green-200",
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-gray-100 text-gray-500 border-gray-200",
  NO_SHOW: "bg-red-100 text-red-600 border-red-200",
};

const formatTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

const toSockJsBaseUrl = (url) => {
  if (!url) return null;
  const base = String(url).replace(/\/+$/, "");
  if (base.startsWith("wss://")) {
    return `https://${base.slice("wss://".length)}`;
  }
  if (base.startsWith("ws://")) {
    return `http://${base.slice("ws://".length)}`;
  }
  return base;
};

/**
 * LiveQueueWidget
 * @param {string} doctorId
 * @param {string} date - YYYY-MM-DD
 * @param {'doctor'|'assistant'|'patient'} role
 * @param {number|null} patientSerialNumber - for patient view
 * @param {boolean} compact - smaller layout for dashboard widgets
 */
const LiveQueueWidget = ({
  doctorId,
  date,
  role = "patient",
  patientSerialNumber = null,
  compact = false,
}) => {
  const { token } = useAuth();
  const toast = useToast();
  const [queueState, setQueueState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [delayInput, setDelayInput] = useState("");
  const [showDelayInput, setShowDelayInput] = useState(false);
  const stompRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    if (!doctorId || !date || !token) return;
    try {
      const data =
        role === "patient"
          ? await queueAPI.getPatientQueueView(doctorId, date, token)
          : await queueAPI.getQueueState(doctorId, date, token);
      setQueueState(data);
    } catch {
      // silently fail — WS will keep it updated
    } finally {
      setLoading(false);
    }
  }, [doctorId, date, token, role]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!doctorId || !date || !token) return;
    const wsBaseUrl =
      toSockJsBaseUrl(import.meta.env.VITE_WS_URL) ||
      `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.host}`;
    const wsUrl = `${wsBaseUrl.replace(/\/$/, "")}/ws-telemedicine`;
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => { },
      onConnect: () => {
        setWsConnected(true);
        client.subscribe(`/topic/queue/${doctorId}/${date}`, (msg) => {
          try {
            setQueueState(JSON.parse(msg.body));
          } catch {
            /* ignore malformed */
          }
        });
      },
      onDisconnect: () => setWsConnected(false),
      onStompError: () => setWsConnected(false),
      onWebSocketClose: () => setWsConnected(false),
      onWebSocketError: () => setWsConnected(false),
    });
    client.activate();
    stompRef.current = client;
    return () => {
      client.deactivate();
    };
  }, [doctorId, date, token]);

  const doAction = useCallback(
    async (key, fn) => {
      setActionLoading(key);
      try {
        await fn();
      } catch (err) {
        toast.error(err.message || "Action failed");
      } finally {
        setActionLoading(null);
      }
    },
    [toast],
  );

  const handleStart = () =>
    doAction("start", async () => {
      await queueAPI.startQueue(doctorId, date, token);
      toast.success("Queue started");
    });

  const handleCallNext = () =>
    doAction("next", async () => {
      await queueAPI.callNext(doctorId, date, token);
    });

  const handleSkip = (appointmentId) =>
    doAction(`skip-${appointmentId}`, async () => {
      await queueAPI.skipPatient(appointmentId, token);
      toast.info("Patient skipped");
    });

  const handleComplete = (appointmentId) =>
    doAction(`complete-${appointmentId}`, async () => {
      await queueAPI.markCompleted(appointmentId, token);
      toast.success("Marked as completed");
    });

  const handleSetDelay = () => {
    const mins = parseInt(delayInput);
    if (isNaN(mins) || mins < 0) {
      toast.warning("Enter a valid delay in minutes");
      return;
    }
    doAction("delay", async () => {
      await queueAPI.setDelay(doctorId, date, mins, token);
      setShowDelayInput(false);
      setDelayInput("");
      toast.success(`Delay set to ${mins} min`);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading queue…</span>
      </div>
    );
  }

  if (!queueState) {
    return (
      <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">No queue data available</p>
        <button
          onClick={fetchQueue}
          className="text-xs text-primary-500 hover:underline flex items-center gap-1 mt-1"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  const activeQueue =
    queueState.queue?.filter((e) =>
      ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(e.status),
    ) || [];
  const inProgress =
    queueState.queue?.find((e) => e.status === "IN_PROGRESS") ||
    queueState.queue?.find(
      (e) =>
        queueState.isActive &&
        queueState.currentServingSerial &&
        e.serialNumber === queueState.currentServingSerial,
    );
  const myEntry =
    patientSerialNumber != null
      ? queueState.queue?.find((e) => e.serialNumber === patientSerialNumber)
      : null;
  const isManaging = role === "doctor" || role === "assistant";
  const delayMin = queueState.doctorDelayMinutes || 0;
  const queueRunning = Boolean(queueState.isActive);
  const sortedQueue = [...activeQueue].sort((left, right) => {
    const leftSerial = left.serialNumber || 0;
    const rightSerial = right.serialNumber || 0;
    return leftSerial - rightSerial;
  });
  const nextQueuedEntry = !inProgress && queueRunning ? sortedQueue[0] : null;
  const currentEntry = inProgress || nextQueuedEntry;
  const currentSerial =
    currentEntry?.serialNumber || queueState.currentServingSerial || 0;
  const currentQueueIndex = currentEntry
    ? sortedQueue.findIndex(
      (entry) => entry.serialNumber === currentEntry.serialNumber,
    )
    : -1;
  const laterCount =
    currentQueueIndex >= 0
      ? Math.max(0, sortedQueue.length - currentQueueIndex - 1)
      : 0;
  const hasCurrentToken = currentSerial > 0;
  const nextUpLabel = inProgress ? "Now Serving" : "Next token";
  const nextUpSubtext = inProgress
    ? `${laterCount} later in line`
    : nextQueuedEntry
      ? `${laterCount} later in line`
      : queueRunning
        ? "Waiting for the first token"
        : "Queue not started";
  const patientsAhead =
    myEntry && queueRunning
      ? Math.max(0, myEntry.serialNumber - currentSerial)
      : 0;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-800">
            Live Queue
            {!compact && queueState.queueDate && (
              <span className="ml-2 text-gray-400 font-normal text-xs">
                {new Date(
                  queueState.queueDate + "T00:00:00",
                ).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </span>
          <span
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${wsConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
          >
            {wsConnected ? (
              <Wifi className="w-2.5 h-2.5" />
            ) : (
              <WifiOff className="w-2.5 h-2.5" />
            )}
            {wsConnected ? "Live" : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {delayMin > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <Timer className="w-3 h-3" />+{delayMin} min delay
            </span>
          )}
          <span className="text-xs text-gray-500">
            {queueState.totalPatients || 0} patients
          </span>
        </div>
      </div>

      {/* Currently serving banner */}
      {queueRunning && (
        <div
          className={`rounded-xl border p-3 flex items-center gap-3 ${inProgress ? "bg-primary-50 border-primary-200" : "bg-gray-50 border-gray-200"}`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${inProgress ? "bg-primary-600" : "bg-gray-300"}`}
          >
            <Hash className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              {nextUpLabel}
            </p>
            <p className="text-xl font-black text-gray-900">
              {hasCurrentToken ? `#${currentSerial}` : "--"}
            </p>
            <p className="text-xs text-gray-500">{nextUpSubtext}</p>
          </div>
          {isManaging && inProgress && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => handleComplete(inProgress.appointmentId)}
                disabled={
                  actionLoading === `complete-${inProgress.appointmentId}`
                }
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                Done
              </button>
              <button
                onClick={() => handleSkip(inProgress.appointmentId)}
                disabled={actionLoading === `skip-${inProgress.appointmentId}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
            </div>
          )}
        </div>
      )}

      {/* Patient personal entry */}
      {role === "patient" && myEntry && (
        <div className="bg-primary-600 text-white rounded-xl p-4 flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-primary-200 uppercase font-semibold">
              Your Token
            </p>
            <p className="text-4xl font-black">#{myEntry.serialNumber}</p>
            {myEntry.isPreferredSlot && (
              <span className="text-xs text-primary-200 flex items-center gap-1 justify-center mt-0.5">
                <Star className="w-3 h-3" />
                Priority
              </span>
            )}
          </div>
          <div className="border-l border-primary-500 pl-4">
            <p className="text-sm font-semibold">
              {myEntry.status === "IN_PROGRESS"
                ? "You are being seen now!"
                : `${patientsAhead} ahead of you`}
            </p>
            {myEntry.estimatedTime && (
              <p className="text-xs text-primary-200 mt-1">
                <Clock className="w-3 h-3 inline mr-1" />
                Est. {formatTime(myEntry.estimatedTime)}
              </p>
            )}
            <p className="text-xs text-primary-200 mt-1">
              {myEntry.appointmentType === "ONLINE"
                ? "📹 Online"
                : "🏥 In-Person"}
            </p>
          </div>
        </div>
      )}

      {role === "patient" &&
        queueRunning &&
        !myEntry &&
        activeQueue.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
            <p className="text-sm font-semibold">Queue is running</p>
            <p className="text-xs mt-1">0 patients ahead</p>
          </div>
        )}

      {/* Manager controls */}
      {isManaging && !compact && (
        <div className="flex flex-wrap gap-2">
          {!queueState.isActive ? (
            <button
              onClick={handleStart}
              disabled={actionLoading === "start"}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {actionLoading === "start" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start Queue
            </button>
          ) : (
            <button
              onClick={handleCallNext}
              disabled={
                actionLoading === "next" ||
                activeQueue.filter((e) => e.status !== "IN_PROGRESS").length ===
                0
              }
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {actionLoading === "next" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Call Next
            </button>
          )}
          <button
            onClick={() => setShowDelayInput((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold rounded-lg hover:bg-amber-100 transition-colors"
          >
            <Timer className="w-4 h-4" />
            Set Delay
          </button>
          {showDelayInput && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <input
                type="number"
                min={0}
                max={180}
                value={delayInput}
                onChange={(e) => setDelayInput(e.target.value)}
                placeholder="mins"
                className="w-16 text-sm border-0 focus:outline-none text-gray-800"
              />
              <button
                onClick={handleSetDelay}
                disabled={actionLoading === "delay"}
                className="px-2 py-1 bg-amber-500 text-white text-xs rounded font-semibold hover:bg-amber-600 disabled:opacity-60"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Queue list — managers only; patients see only their own token card above */}
      {isManaging && !compact && activeQueue.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Upcoming
            </span>
            <span className="text-xs text-gray-400">
              {activeQueue.length} remaining
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {activeQueue.map((entry) => (
              <div
                key={entry.appointmentId}
                className={`flex items-center gap-3 px-4 py-3 ${entry.status === "IN_PROGRESS" ? "bg-primary-50" : ""} ${patientSerialNumber === entry.serialNumber ? "bg-primary-50" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${entry.status === "IN_PROGRESS" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-700"}`}
                >
                  {entry.serialNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {isManaging
                        ? entry.patientName
                        : patientSerialNumber === entry.serialNumber
                          ? "You"
                          : `Patient #${entry.serialNumber}`}
                    </p>
                    {entry.isPreferredSlot && (
                      <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                    {entry.appointmentType === "ONLINE" ? (
                      <Video className="w-3 h-3 text-primary-500 flex-shrink-0" />
                    ) : (
                      <MapPin className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.estimatedTime && (
                      <span className="text-xs text-gray-400">
                        <Clock className="w-3 h-3 inline mr-0.5" />~
                        {formatTime(entry.estimatedTime)}
                      </span>
                    )}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_STYLE[entry.status] || "bg-gray-100 text-gray-500"}`}
                    >
                      {entry.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                {isManaging && entry.status !== "IN_PROGRESS" && (
                  <button
                    onClick={() => handleSkip(entry.appointmentId)}
                    disabled={!!actionLoading}
                    title="Mark no-show"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — managers only */}
      {isManaging && activeQueue.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {queueRunning
              ? "Queue is running - 0 patients in queue"
              : "No patients in queue"}
          </p>
        </div>
      )}
    </div>
  );
};

export default LiveQueueWidget;
