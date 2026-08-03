import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneCall,
  Pill,
  Send,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import ConfirmModal from "../../components/ConfirmModal";
import CallNotification from "../../components/CallNotification";
import ParticipantJoinedNotification from "../../components/ParticipantJoinedNotification";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthProvider";
import { appointmentAPI, documentAPI, queueAPI } from "../../utils/api";
import { generateAgoraToken } from "../../utils/agora";

const SESSION_OPEN_STATUSES = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
]);

const normalizeTelemedicineBaseUrl = (baseUrl) =>
  (baseUrl || "").replace(/\/api\/?$/, "").replace(/\/$/, "");

const toSockJsBaseUrl = (url) => {
  if (!url) return null;

  const base = normalizeTelemedicineBaseUrl(String(url).trim());
  if (!base) return null;

  if (base.startsWith("wss://")) {
    return `https://${base.slice("wss://".length)}`;
  }

  if (base.startsWith("ws://")) {
    return `http://${base.slice("ws://".length)}`;
  }

  return base;
};

const toWebSocketUrl = (url) => {
  if (!url) return null;

  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }

  if (url.startsWith("http://")) {
    return `ws://${url.slice("http://".length)}`;
  }

  if (url.startsWith("https://")) {
    return `wss://${url.slice("https://".length)}`;
  }

  if (url.startsWith("/")) {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.host}${url}`;
  }

  return null;
};

const appendPath = (base, path) => {
  if (!base) return null;
  return `${String(base).replace(/\/$/, "")}${path}`;
};

const toBearerToken = (rawToken) => {
  if (!rawToken || typeof rawToken !== "string") return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  if (/^bearer\s+/i.test(trimmed)) return trimmed;
  return `Bearer ${trimmed}`;
};

const guessMimeTypeFromFileName = (fileName = "") => {
  const ext = String(fileName).split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  const map = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
  };
  return map[ext] || "application/octet-stream";
};

const buildTelemedicineWsCandidates = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  const envWsUrl = import.meta.env.VITE_WS_URL;
  const envSockJsUrl = toSockJsBaseUrl(envWsUrl);
  const pageProtocol =
    window.location.protocol === "https:" ? "https:" : "http:";
  const originSockJs = `${pageProtocol}//${window.location.host}/ws-telemedicine`;
  const originNative = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws-telemedicine-native`;

  const sockJsCandidates = [
    envSockJsUrl,
    "/ws-telemedicine",
    envApiUrl && `${normalizeTelemedicineBaseUrl(envApiUrl)}/ws-telemedicine`,
    originSockJs,
  ].filter(Boolean);

  // `/api/ws-telemedicine` is not a valid backend SockJS endpoint path.
  const sanitizedSockJs = sockJsCandidates.filter(
    (url) => !String(url).includes("/api/ws-telemedicine"),
  );

  const envNativeFromWs = envWsUrl
    ? toWebSocketUrl(
        appendPath(
          normalizeTelemedicineBaseUrl(
            String(envWsUrl).replace(/\/ws-telemedicine\/?$/, ""),
          ),
          "/ws-telemedicine-native",
        ),
      )
    : null;

  const nativeCandidates = [
    toWebSocketUrl("/ws-telemedicine-native"),
    envNativeFromWs,
    originNative,
    envApiUrl &&
      toWebSocketUrl(
        `${normalizeTelemedicineBaseUrl(envApiUrl)}/ws-telemedicine-native`,
      ),
  ].filter(Boolean);

  const merged = [
    ...nativeCandidates.map((url) => ({ transport: "native", url })),
    ...sanitizedSockJs.map((url) => ({ transport: "sockjs", url })),
  ];

  const deduped = [];
  const seen = new Set();
  merged.forEach((candidate) => {
    const key = `${candidate.transport}:${candidate.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(candidate);
  });

  return deduped;
};

const getThreadStorageKey = (scope, value) =>
  `consultation_thread_${scope}_${value}`;

const getLegacyPairThreadStorageKey = (pairKey) =>
  `consultation_thread_${pairKey}`;

const readThread = (appointmentId, pairKey) => {
  try {
    const pairRaw = pairKey
      ? window.localStorage.getItem(getThreadStorageKey("pair", pairKey))
      : null;
    const raw =
      pairRaw ||
      window.localStorage.getItem(
        getThreadStorageKey("appointment", appointmentId),
      );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeThread = (appointmentId, state, pairKey) => {
  const serialized = JSON.stringify(state);
  window.localStorage.setItem(
    getThreadStorageKey("appointment", appointmentId),
    serialized,
  );
  if (pairKey) {
    window.localStorage.setItem(
      getThreadStorageKey("pair", pairKey),
      serialized,
    );
  }
};

const removeLegacyPairThread = (pairKey) => {
  if (!pairKey) return;
  window.localStorage.removeItem(getLegacyPairThreadStorageKey(pairKey));
};

const buildMessageId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const mapPersistedTextMessage = (message) => ({
  id: `msg-${message.messageId}`,
  kind: "text",
  text: message.text || "",
  senderId: `${message.senderRole || "participant"}-${message.senderUserId ?? "unknown"}`,
  senderName: message.senderName || "Participant",
  timestamp: message.createdAt || new Date().toISOString(),
});

const parseTimestamp = (value) => {
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const buildInitialConsultationUiState = () => ({
  messageInput: "",
  selectedDocumentIds: [],
  shareHealthAnalysis: true,
  grantDurationMinutes: 60,
  loadingDocs: false,
  grantingAccess: false,
  doctorDocsLoading: false,
  doctorHasAccess: false,
  doctorConnected: false,
  patientConnected: false,
  callActive: false,
  callType: "video",
  incomingCallType: null,
  videoEnabled: true,
  audioEnabled: true,
  remoteVideoAvailable: false,
  doctorCallEnabled: true,
  callViewportFullscreen: false,
  isMobileViewport:
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false,
  rightPanelOpen:
    typeof window !== "undefined"
      ? !window.matchMedia("(max-width: 639px)").matches
      : true,
});

const consultationUiReducer = (state, action) => {
  switch (action.type) {
    case "SET_FIELD": {
      const { key, updater } = action;
      const current = state[key];
      const next = typeof updater === "function" ? updater(current) : updater;
      if (Object.is(current, next)) return state;
      return { ...state, [key]: next };
    }
    default:
      return state;
  }
};

const MessageBubble = ({ msg, isMine }) => {
  if (msg.kind === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs px-3 py-1 rounded-full bg-gray-200 text-gray-500">
          {msg.text}
        </span>
      </div>
    );
  }

  const bubbleClass = isMine
    ? "bg-primary-600 text-white rounded-br-sm"
    : "bg-white text-gray-900 border border-gray-100 rounded-bl-sm";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[76%] rounded-2xl px-3.5 py-2.5 shadow-sm ${bubbleClass}`}
      >
        {!isMine && (
          <p className="text-xs font-semibold mb-1 text-primary-600">
            {msg.senderName}
          </p>
        )}

        {msg.kind === "text" && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {msg.text}
          </p>
        )}

        {msg.kind === "document" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${isMine ? "bg-primary-500" : "bg-primary-50"}`}
              >
                <FileText
                  className={`w-4 h-4 ${isMine ? "text-white" : "text-primary-600"}`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{msg.fileName}</p>
                <p
                  className={`text-[11px] ${isMine ? "text-primary-100" : "text-gray-400"}`}
                >
                  {msg.documentType || "Document"}
                </p>
              </div>
            </div>

            {msg.allowDownload && msg.downloadUrl ? (
              <a
                href={msg.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                  isMine
                    ? "bg-white text-primary-700 hover:bg-primary-50"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                }`}
              >
                View Document
              </a>
            ) : (
              <span
                className={`inline-flex items-center gap-1 text-xs ${isMine ? "text-primary-100" : "text-gray-500"}`}
              >
                View from secure folder after access is granted.
              </span>
            )}
          </div>
        )}

        <p
          className={`mt-1 text-[10px] text-right ${isMine ? "text-primary-100" : "text-gray-400"}`}
        >
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};

const PanelSkeleton = ({ rows = 4 }) => {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`skeleton-row-${index}`}
          className="rounded-xl border border-slate-100 bg-slate-50 p-3"
        >
          <div className="h-3 w-2/3 rounded bg-slate-200" />
          <div className="mt-2 h-2.5 w-1/3 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
};

const GrantAccessPanel = ({
  loading,
  documents,
  selectedDocumentIds,
  shareHealthAnalysis,
  durationMinutes,
  onToggleDocument,
  onToggleShareHealthAnalysis,
  onSelectAll,
  onClearSelection,
  onDurationChange,
  onConfirm,
  confirming,
}) => {
  return (
    <div className="h-full min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">
            Select documents for secure folder
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={loading || documents.length === 0}
              className="text-xs font-semibold text-primary-700 disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={loading || selectedDocumentIds.length === 0}
              className="text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <PanelSkeleton rows={4} />
        ) : documents.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-slate-400">
            <FileText className="w-10 h-10 opacity-40 mb-2" />
            <p className="text-sm">No documents available</p>
          </div>
        ) : (
          documents.map((doc) => (
            <label
              key={doc.documentId}
              className="w-full flex items-start gap-2 p-3 rounded-xl hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedDocumentIds.includes(doc.documentId)}
                onChange={() => onToggleDocument(doc.documentId)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {doc.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  {doc.documentType || "Document"}
                </p>
              </div>
            </label>
          ))
        )}
      </div>

      <div className="px-4 py-3 border-t bg-white space-y-3">
        <label className="flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shareHealthAnalysis}
            onChange={onToggleShareHealthAnalysis}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-semibold text-primary-900">
              Include Health Analysis Trends
            </p>
            <p className="text-[11px] text-primary-700 mt-0.5">
              Doctor can open Current and Continuous trend views while this
              access window is active.
            </p>
          </div>
        </label>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Auto-revoke timer (minutes)
          </label>
          <input
            type="number"
            min="0"
            value={durationMinutes}
            onChange={(event) => {
              const next = Number(event.target.value);
              onDurationChange(Number.isFinite(next) ? Math.max(0, next) : 0);
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Set 0 to keep access until consultation end.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {selectedDocumentIds.length} docs selected
            {shareHealthAnalysis ? " + health trends" : ""}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={
              confirming ||
              loading ||
              (selectedDocumentIds.length === 0 && !shareHealthAnalysis)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {confirming ? "Granting..." : "Give Access To Doctor"}
          </button>
        </div>
      </div>
    </div>
  );
};

const AccessibleDocumentsPanel = ({
  loading,
  hasAccess,
  documents,
  onOpenDocument,
  onOpenHealthTrends,
  onRefresh,
}) => {
  return (
    <div className="h-full min-h-0 rounded-xl border border-slate-200 bg-white flex flex-col">
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Patient Secure Folder</h3>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <PanelSkeleton rows={4} />
        ) : !hasAccess ? (
          <div className="h-32 flex flex-col items-center justify-center text-amber-600 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm font-semibold">Access not granted</p>
            <p className="text-xs mt-1 text-amber-700 text-center px-4">
              Patient has not granted access yet, or access has expired.
            </p>
          </div>
        ) : (
          <>
            <div className="w-full p-3 rounded-xl border border-primary-100 bg-primary-50 mb-2">
              <p className="text-sm font-medium text-primary-900">
                Health Analysis
              </p>
              <p className="text-xs text-primary-700">
                Open Current and Continuous trend page shared by the patient.
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onOpenHealthTrends}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-700 text-white hover:bg-primary-800"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Open Health Trends
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-slate-400 rounded-xl border border-slate-100 bg-slate-50">
                <FileText className="w-9 h-9 opacity-40 mb-2" />
                <p className="text-sm">No files found in secure folder</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.documentId}
                  className="w-full p-3 rounded-xl border border-slate-100 bg-slate-50 mb-2"
                >
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {doc.documentType || "Document"}
                  </p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => onOpenDocument(doc)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                    >
                      Open File
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ConsultationRoom = ({
  participantRole,
  embedded = false,
  appointmentIdOverride = null,
  onBack = null,
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId } = useParams();
  const { token, user } = useAuth();

  const isDoctor = participantRole === "doctor";
  const activeAppointmentId = appointmentIdOverride || appointmentId;

  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [appointment, setAppointment] = useState(null);

  const [messages, setMessages] = useState([]);
  const [sessionState, setSessionState] = useState({
    active: true,
    endedAt: null,
    endedByRole: null,
    endedByName: null,
    lastAppointmentId: null,
  });
  const [participantJoinedNotification, setParticipantJoinedNotification] =
    useState({
      isOpen: false,
      participantName: "",
      callType: "video",
      headline: "Joined the room",
      statusText: "The consultation room is active.",
      footerText: "Video session is ready",
    });
  const [joinCallPromptMessage, setJoinCallPromptMessage] = useState("");

  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState("chat");
  const [uiState, uiDispatch] = useReducer(
    consultationUiReducer,
    undefined,
    buildInitialConsultationUiState,
  );
  const {
    messageInput,
    selectedDocumentIds,
    shareHealthAnalysis,
    grantDurationMinutes,
    loadingDocs,
    grantingAccess,
    doctorDocsLoading,
    doctorHasAccess,
    doctorConnected,
    patientConnected,
    callActive,
    callType,
    incomingCallType,
    videoEnabled,
    audioEnabled,
    remoteVideoAvailable,
    doctorCallEnabled,
    callViewportFullscreen,
    isMobileViewport,
    rightPanelOpen,
  } = uiState;

  const setUiField = useCallback((key, updater) => {
    uiDispatch({ type: "SET_FIELD", key, updater });
  }, []);

  const setMessageInput = useCallback(
    (updater) => setUiField("messageInput", updater),
    [setUiField],
  );
  const setSelectedDocumentIds = useCallback(
    (updater) => setUiField("selectedDocumentIds", updater),
    [setUiField],
  );
  const setShareHealthAnalysis = useCallback(
    (updater) => setUiField("shareHealthAnalysis", updater),
    [setUiField],
  );
  const setGrantDurationMinutes = useCallback(
    (updater) => setUiField("grantDurationMinutes", updater),
    [setUiField],
  );
  const setLoadingDocs = useCallback(
    (updater) => setUiField("loadingDocs", updater),
    [setUiField],
  );
  const setGrantingAccess = useCallback(
    (updater) => setUiField("grantingAccess", updater),
    [setUiField],
  );
  const setDoctorDocsLoading = useCallback(
    (updater) => setUiField("doctorDocsLoading", updater),
    [setUiField],
  );
  const setDoctorHasAccess = useCallback(
    (updater) => setUiField("doctorHasAccess", updater),
    [setUiField],
  );
  const setDoctorConnected = useCallback(
    (updater) => setUiField("doctorConnected", updater),
    [setUiField],
  );
  const setPatientConnected = useCallback(
    (updater) => setUiField("patientConnected", updater),
    [setUiField],
  );
  const setCallActive = useCallback(
    (updater) => setUiField("callActive", updater),
    [setUiField],
  );
  const setCallType = useCallback(
    (updater) => setUiField("callType", updater),
    [setUiField],
  );
  const setIncomingCallType = useCallback(
    (updater) => setUiField("incomingCallType", updater),
    [setUiField],
  );
  const setVideoEnabled = useCallback(
    (updater) => setUiField("videoEnabled", updater),
    [setUiField],
  );
  const setAudioEnabled = useCallback(
    (updater) => setUiField("audioEnabled", updater),
    [setUiField],
  );
  const setRemoteVideoAvailable = useCallback(
    (updater) => setUiField("remoteVideoAvailable", updater),
    [setUiField],
  );
  const setDoctorCallEnabled = useCallback(
    (updater) => setUiField("doctorCallEnabled", updater),
    [setUiField],
  );
  const setCallViewportFullscreen = useCallback(
    (updater) => setUiField("callViewportFullscreen", updater),
    [setUiField],
  );
  const setIsMobileViewport = useCallback(
    (updater) => setUiField("isMobileViewport", updater),
    [setUiField],
  );
  const setRightPanelOpen = useCallback(
    (updater) => setUiField("rightPanelOpen", updater),
    [setUiField],
  );
  const handleRightPanelTabSelect = useCallback(
    (tab) => {
      setActiveTab(tab);
      setRightPanelOpen(true);
    },
    [setRightPanelOpen],
  );

  const stompRef = useRef(null);

  const agoraClientRef = useRef(null);
  const agoraAppIdRef = useRef("");
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const remoteAudioTrackRef = useRef(null);
  const remoteVideoTrackRef = useRef(null);

  const localVideoContainerRef = useRef(null);
  const remoteVideoContainerRef = useRef(null);
  const callViewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const sessionStateRef = useRef(sessionState);
  const doctorCallEnabledRef = useRef(doctorCallEnabled);
  const appointmentRef = useRef(appointment);
  const messagesRef = useRef(messages);
  const callActiveRef = useRef(callActive);
  const callTypeRef = useRef(callType);
  const lastJoinNoticeRef = useRef({ uid: null, at: 0 });
  const handleSignalRef = useRef(null);
  const toastRef = useRef(toast);
  const wsErrorToastShownRef = useRef(false);
  const joinPublishAtRef = useRef(0);

  const userId = `${participantRole}-${user?.userId || "unknown"}`;
  const userName = user
    ? `${user.firstName} ${user.lastName}`
    : participantRole;

  const pairKey = useMemo(() => {
    if (!appointment?.doctorId || !appointment?.patientId) return null;
    return `${appointment.doctorId}-${appointment.patientId}`;
  }, [appointment]);

  const roomId = useMemo(
    () => (pairKey ? `consultation-${pairKey}` : null),
    [pairKey],
  );

  const threadAppointmentId = useMemo(() => {
    if (!appointment?.appointmentId) return null;
    return String(appointment.appointmentId);
  }, [appointment]);

  const isAppointmentOpen = SESSION_OPEN_STATUSES.has(appointment?.status);
  const canMessage = sessionState.active && isAppointmentOpen;
  const canUseCalls = canMessage && doctorCallEnabled;

  const persistThread = useCallback(
    (nextMessages, nextSessionState) => {
      if (!threadAppointmentId || !appointment) return;
      writeThread(
        threadAppointmentId,
        {
          appointmentId: appointment.appointmentId,
          pairKey,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          doctorName: appointment.doctorName,
          patientName: appointment.patientName,
          messages: nextMessages,
          sessionState: nextSessionState,
        },
        pairKey,
      );
    },
    [appointment, pairKey, threadAppointmentId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    doctorCallEnabledRef.current = doctorCallEnabled;
  }, [doctorCallEnabled]);

  useEffect(() => {
    appointmentRef.current = appointment;
  }, [appointment]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    if (
      callActive &&
      callType === "video" &&
      localVideoTrackRef.current &&
      localVideoContainerRef.current
    ) {
      localVideoTrackRef.current.play(localVideoContainerRef.current);
    }
  }, [callActive, callType]);

  useEffect(() => {
    if (
      callActive &&
      remoteVideoAvailable &&
      remoteVideoTrackRef.current &&
      remoteVideoContainerRef.current
    ) {
      remoteVideoTrackRef.current.play(remoteVideoContainerRef.current);
    }
  }, [callActive, remoteVideoAvailable]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setCallViewportFullscreen(
        document.fullscreenElement === callViewportRef.current,
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [setCallViewportFullscreen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    updateViewport();

    mediaQuery.addEventListener("change", updateViewport);
    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, [setIsMobileViewport]);

  useEffect(() => {
    setRightPanelOpen(!isMobileViewport);
  }, [isMobileViewport, setRightPanelOpen]);

  const addLocalMessage = useCallback(
    (msg) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        persistThread(next, sessionState);
        return next;
      });
    },
    [persistThread, sessionState],
  );

  const setSessionAndPersist = useCallback(
    (nextSession, options = {}) => {
      setSessionState(nextSession);
      const nextMessages = options.messages ?? messagesRef.current;
      persistThread(nextMessages, nextSession);
    },
    [persistThread],
  );

  const cleanupAgoraCall = useCallback(async () => {
    try {
      const client = agoraClientRef.current;

      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }

      if (remoteAudioTrackRef.current) {
        remoteAudioTrackRef.current.stop();
        remoteAudioTrackRef.current = null;
      }

      if (remoteVideoTrackRef.current) {
        remoteVideoTrackRef.current.stop();
        remoteVideoTrackRef.current = null;
      }

      setRemoteVideoAvailable(false);

      if (client) {
        try {
          await client.leave();
        } catch {
          // Ignore leave errors during cleanup.
        }
        agoraClientRef.current = null;
      }
    } finally {
      callActiveRef.current = false;
      setCallActive(false);
      setIncomingCallType(null);
    }
  }, [setCallActive, setIncomingCallType, setRemoteVideoAvailable]);

  const setCounterpartConnected = useCallback(
    (connected) => {
      if (isDoctor) {
        setPatientConnected(connected);
      } else {
        setDoctorConnected(connected);
      }
    },
    [isDoctor, setDoctorConnected, setPatientConnected],
  );

  const setConnectedBySenderId = useCallback(
    (senderId, connected) => {
      if (typeof senderId !== "string") return;
      if (senderId.startsWith("doctor-")) {
        setDoctorConnected(connected);
        return;
      }
      if (senderId.startsWith("patient-")) {
        setPatientConnected(connected);
      }
    },
    [setDoctorConnected, setPatientConnected],
  );

  const attachRemoteVideoTrack = useCallback(
    (videoTrack) => {
      if (!videoTrack) {
        if (remoteVideoTrackRef.current) {
          remoteVideoTrackRef.current.stop();
        }
        remoteVideoTrackRef.current = null;
        setRemoteVideoAvailable(false);
        return;
      }

      remoteVideoTrackRef.current = videoTrack;
      setRemoteVideoAvailable(true);

      if (remoteVideoContainerRef.current) {
        videoTrack.play(remoteVideoContainerRef.current);
      }
    },
    [setRemoteVideoAvailable],
  );

  const subscribeRemoteMedia = useCallback(
    async (client, remoteUser, mediaType = null) => {
      const wantsAudio = mediaType ? mediaType === "audio" : true;
      const wantsVideo = mediaType ? mediaType === "video" : true;

      if (wantsAudio && (remoteUser.hasAudio || remoteUser.audioTrack)) {
        await client.subscribe(remoteUser, "audio");
        if (remoteUser.audioTrack) {
          remoteAudioTrackRef.current = remoteUser.audioTrack;
          remoteUser.audioTrack.play();
        }
      }

      if (wantsVideo && (remoteUser.hasVideo || remoteUser.videoTrack)) {
        await client.subscribe(remoteUser, "video");
        attachRemoteVideoTrack(remoteUser.videoTrack || null);
      }

      setCounterpartConnected(true);
    },
    [attachRemoteVideoTrack, setCounterpartConnected],
  );

  const ensureAgoraClient = useCallback(() => {
    if (agoraClientRef.current) {
      return agoraClientRef.current;
    }

    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    client.on("user-joined", (remoteUser) => {
      // Presence can be established before media is published.
      setCounterpartConnected(true);

      const remoteUid = remoteUser?.uid ?? "unknown";
      const now = Date.now();
      const lastNotice = lastJoinNoticeRef.current;
      if (lastNotice.uid === remoteUid && now - lastNotice.at < 3000) {
        return;
      }
      lastJoinNoticeRef.current = { uid: remoteUid, at: now };

      if (!callActiveRef.current) {
        return;
      }

      const currentAppointment = appointmentRef.current;
      const counterpartName = isDoctor
        ? currentAppointment?.patientName || "Patient"
        : `Dr. ${currentAppointment?.doctorName || "Doctor"}`;
      const callLabel = callTypeRef.current === "video" ? "video" : "audio";
      toastRef.current.info(`${counterpartName} joined the ${callLabel} call`);
    });

    client.on("user-published", async (remoteUser, mediaType) => {
      try {
        await subscribeRemoteMedia(client, remoteUser, mediaType);
      } catch {
        toastRef.current.error("Failed to subscribe to participant media");
      }
    });

    client.on("user-unpublished", (remoteUser, mediaType) => {
      if (mediaType === "audio" && remoteAudioTrackRef.current) {
        remoteAudioTrackRef.current.stop();
        remoteAudioTrackRef.current = null;
      }

      if (mediaType === "video") {
        attachRemoteVideoTrack(null);
      }
    });

    client.on("user-left", () => {
      if (remoteVideoTrackRef.current) {
        remoteVideoTrackRef.current.stop();
        remoteVideoTrackRef.current = null;
      }
      setRemoteVideoAvailable(false);
      if (remoteAudioTrackRef.current) {
        remoteAudioTrackRef.current.stop();
        remoteAudioTrackRef.current = null;
      }
      setCounterpartConnected(false);
    });

    agoraClientRef.current = client;
    return client;
  }, [
    attachRemoteVideoTrack,
    isDoctor,
    setCounterpartConnected,
    setRemoteVideoAvailable,
    subscribeRemoteMedia,
  ]);

  const publishSignal = useCallback(
    (data) => {
      if (!stompRef.current?.connected) return;
      stompRef.current.publish({
        destination: "/app/signal",
        body: JSON.stringify({
          type: "webrtc-signal",
          from: userId,
          roomId,
          data,
        }),
      });
    },
    [roomId, userId],
  );

  const fetchAppointment = useCallback(async () => {
    if (!token || !activeAppointmentId) return;

    try {
      setLoading(true);
      setAccessError("");

      let selected = null;
      if (isDoctor) {
        const all = await appointmentAPI.getDoctorAppointments(token);
        selected = all.find(
          (a) => String(a.appointmentId) === String(activeAppointmentId),
        );
      } else {
        const all = await appointmentAPI.getPatientAppointments(token);
        selected = all.find(
          (a) => String(a.appointmentId) === String(activeAppointmentId),
        );
      }

      if (!selected) {
        throw new Error("Appointment not found or inaccessible.");
      }
      if (selected.appointmentType !== "ONLINE") {
        throw new Error(
          "This consultation room is available only for online appointments.",
        );
      }

      setAppointment(selected);
    } catch (err) {
      setAccessError(err.message || "Could not open consultation room.");
    } finally {
      setLoading(false);
    }
  }, [activeAppointmentId, isDoctor, token]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  useEffect(() => {
    if (!appointment || !threadAppointmentId) return;

    const stored = readThread(threadAppointmentId, pairKey);
    const initialMessages = stored?.messages || [];
    const initialSession = stored?.sessionState || {
      active: true,
      endedAt: null,
      endedByRole: null,
      endedByName: null,
      lastAppointmentId: appointment.appointmentId,
    };

    removeLegacyPairThread(pairKey);

    const appointmentAllowsSession = SESSION_OPEN_STATUSES.has(
      appointment.status,
    );
    const storedAppointmentId = stored?.sessionState?.lastAppointmentId;
    const isNewAppointmentForPair =
      storedAppointmentId != null &&
      String(storedAppointmentId) !== String(appointment.appointmentId);

    let nextSession = {
      ...initialSession,
      lastAppointmentId: appointment.appointmentId,
    };

    if (appointmentAllowsSession && isNewAppointmentForPair) {
      nextSession = {
        ...nextSession,
        active: true,
        endedAt: null,
        endedByRole: null,
        endedByName: null,
      };
    } else if (!appointmentAllowsSession) {
      nextSession = {
        ...nextSession,
        active: false,
        endedAt: nextSession.endedAt || new Date().toISOString(),
        endedByRole: nextSession.endedByRole || "doctor",
        endedByName: nextSession.endedByName || "Doctor",
      };
    }

    setMessages(initialMessages);
    setSessionState(nextSession);
    persistThread(initialMessages, nextSession);
  }, [appointment, pairKey, persistThread, threadAppointmentId]);

  useEffect(() => {
    if (!appointment?.appointmentId || !token) return;

    let disposed = false;
    let retryTimerId = null;
    let failureCount = 0;
    let failureLogged = false;
    let recoveryLogged = false;
    let circuitOpenUntil = 0;

    const BASE_SYNC_MS = 3000;
    const MAX_BACKOFF_MS = 30000;
    const CIRCUIT_OPEN_MS = 60000;
    const MAX_FAILURES_BEFORE_CIRCUIT = 4;

    const scheduleNextSync = (delayMs) => {
      if (disposed) return;
      retryTimerId = window.setTimeout(syncPersistedMessages, delayMs);
    };

    const syncPersistedMessages = async () => {
      if (disposed) return;

      const now = Date.now();
      if (circuitOpenUntil > now) {
        scheduleNextSync(Math.min(circuitOpenUntil - now, MAX_BACKOFF_MS));
        return;
      }

      try {
        const persisted = await appointmentAPI.getAppointmentMessages(
          appointment.appointmentId,
          token,
        );

        if (disposed) return;

        const persistedTextMessages = Array.isArray(persisted)
          ? persisted.map(mapPersistedTextMessage)
          : [];

        setMessages((prev) => {
          const previousTextIds = prev
            .filter((msg) => msg.kind === "text")
            .map((msg) => msg.id)
            .join("|");

          const nextTextIds = persistedTextMessages
            .map((msg) => msg.id)
            .join("|");

          if (previousTextIds === nextTextIds) {
            return prev;
          }

          const nonTextMessages = prev.filter((msg) => msg.kind !== "text");
          const next = [...persistedTextMessages, ...nonTextMessages].sort(
            (left, right) =>
              parseTimestamp(left.timestamp) - parseTimestamp(right.timestamp),
          );
          persistThread(next, sessionStateRef.current);
          return next;
        });

        if (failureCount > 0 && !recoveryLogged) {
          console.info("Persisted consultation message sync recovered");
          recoveryLogged = true;
        }

        failureCount = 0;
        failureLogged = false;
        circuitOpenUntil = 0;
        scheduleNextSync(BASE_SYNC_MS);
      } catch (err) {
        if (disposed) return;

        failureCount += 1;
        recoveryLogged = false;

        const status = Number(err?.status || 0);
        const shouldOpenCircuit =
          (status >= 500 || status === 0) &&
          failureCount >= MAX_FAILURES_BEFORE_CIRCUIT;

        if (shouldOpenCircuit) {
          circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        }

        if (!failureLogged) {
          failureLogged = true;
          console.warn("Failed to sync persisted consultation messages", err);
        }

        const exponentialBackoff = Math.min(
          BASE_SYNC_MS * 2 ** Math.min(failureCount, 4),
          MAX_BACKOFF_MS,
        );

        const nextDelay = shouldOpenCircuit
          ? Math.max(CIRCUIT_OPEN_MS, exponentialBackoff)
          : exponentialBackoff;

        scheduleNextSync(nextDelay);
      }
    };

    syncPersistedMessages();

    return () => {
      disposed = true;
      if (retryTimerId) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [appointment?.appointmentId, persistThread, token]);

  const handleSignal = useCallback(
    (signal) => {
      if (signal.from === userId) return;

      setConnectedBySenderId(signal.from, true);

      if (signal.type === "join") {
        if (signal.data?.role === "doctor") setDoctorConnected(true);
        if (signal.data?.role === "patient") setPatientConnected(true);
        if (signal.data?.role === "doctor") {
          const doctorName = appointmentRef.current?.doctorName || "Doctor";
          const joinedType =
            signal.data?.callType === "audio" ? "audio" : "video";

          if (
            !isDoctor &&
            signal.data?.promptPatientJoin === true &&
            signal.data?.callEnabled !== false &&
            sessionStateRef.current?.active
          ) {
            setJoinCallPromptMessage(
              String(signal.data?.promptMessage || "Please Join the Call"),
            );
            setIncomingCallType(joinedType);
          }

          if (!isDoctor && sessionStateRef.current?.active) {
            setParticipantJoinedNotification({
              isOpen: true,
              participantName: doctorName,
              callType: joinedType,
              headline: `${doctorName} joined the room`,
              statusText:
                signal.data?.promptMessage ||
                "The consultation is ready to continue.",
              footerText:
                joinedType === "audio"
                  ? "Audio session is ready"
                  : "Video session is ready",
            });
          }

          const enabled = signal.data?.callEnabled;
          if (typeof enabled === "boolean") {
            setDoctorCallEnabled(enabled);
            if (!enabled) {
              setJoinCallPromptMessage("");
              setIncomingCallType(null);
              void cleanupAgoraCall();
            }
          }
        }
        return;
      }

      if (signal.type === "leave") {
        setConnectedBySenderId(signal.from, false);
        if (signal.data?.role === "doctor") setDoctorConnected(false);
        if (signal.data?.role === "patient") setPatientConnected(false);
        return;
      }

      if (signal.type !== "webrtc-signal") return;

      const payload = signal.data || {};
      const kind = payload.kind;

      if (kind === "chat-message") {
        const nextMsg = {
          id: payload.id || buildMessageId(),
          kind: "text",
          text: payload.text || "",
          senderId: signal.from,
          senderName: payload.senderName || "Participant",
          timestamp: payload.timestamp || new Date().toISOString(),
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === nextMsg.id)) return prev;
          const next = [...prev, nextMsg];
          persistThread(next, sessionStateRef.current);
          return next;
        });
        return;
      }

      if (kind === "session-ended") {
        const nextSession = {
          active: false,
          endedAt: payload.timestamp || new Date().toISOString(),
          endedByRole: payload.endedByRole || "doctor",
          endedByName: payload.endedByName || "Doctor",
          lastAppointmentId: appointmentRef.current?.appointmentId || null,
        };

        const systemMsg = {
          id: buildMessageId(),
          kind: "system",
          text: `Session ended by ${nextSession.endedByName}. Chat remains visible but actions are locked.`,
          timestamp: nextSession.endedAt,
        };

        setMessages((prev) => {
          const next = [...prev, systemMsg];
          setSessionAndPersist(nextSession, { messages: next });
          return next;
        });
        void cleanupAgoraCall();
        return;
      }

      if (kind === "call-request") {
        if (!sessionStateRef.current?.active || !doctorCallEnabledRef.current) {
          return;
        }
        setJoinCallPromptMessage("");
        setIncomingCallType(payload.callType || "video");
        return;
      }

      if (kind === "call-availability") {
        const enabled = payload.enabled;
        if (typeof enabled !== "boolean") return;
        setDoctorCallEnabled(enabled);
        if (!enabled) {
          setJoinCallPromptMessage("");
          setIncomingCallType(null);
          void cleanupAgoraCall();
        }
        return;
      }

      if (kind === "call-ended") {
        void cleanupAgoraCall();
        return;
      }

      if (kind === "call-joined") {
        if (!callActiveRef.current) return;
        const remoteName =
          payload.participantName ||
          (isDoctor
            ? appointmentRef.current?.patientName || "Patient"
            : `Dr. ${appointmentRef.current?.doctorName || "Doctor"}`);
        const joinedType = payload.callType === "video" ? "video" : "audio";
        setParticipantJoinedNotification({
          isOpen: true,
          participantName: remoteName,
          callType: joinedType,
          headline: `${remoteName} joined the call`,
          statusText: "The video session is now connected.",
          footerText:
            joinedType === "audio"
              ? "Audio session is ready"
              : "Video session is ready",
        });
      }
    },
    [
      cleanupAgoraCall,
      isDoctor,
      persistThread,
      setConnectedBySenderId,
      setSessionAndPersist,
      setDoctorCallEnabled,
      setDoctorConnected,
      setIncomingCallType,
      setJoinCallPromptMessage,
      setPatientConnected,
      userId,
    ],
  );

  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  useEffect(() => {
    if (!appointment?.appointmentId || accessError || !token) return;

    let disposed = false;
    const wsCandidates = buildTelemedicineWsCandidates();
    const attemptedUrls = [];
    const failureReasons = [];
    const authHeader = toBearerToken(token);
    let stopRetrying = false;
    let finalToastShown = false;
    let activeClient = null;
    let activeAttemptIndex = -1;

    const showFinalFailure = () => {
      if (disposed || finalToastShown) return;
      finalToastShown = true;
      const attemptedSummary =
        attemptedUrls.length > 0 ? attemptedUrls.join(", ") : "none";
      const lastReason =
        failureReasons.length > 0
          ? ` Last error: ${failureReasons[failureReasons.length - 1]}`
          : "";
      toastRef.current.error(
        `Failed to connect to consultation room. Attempted: ${attemptedSummary}.${lastReason}`,
      );
    };

    if (!authHeader) {
      toastRef.current.error(
        "Authentication token missing. Please log in again.",
      );
      return;
    }

    const tryCandidate = (index) => {
      if (disposed || stopRetrying || index >= wsCandidates.length) {
        showFinalFailure();
        return;
      }

      const candidate = wsCandidates[index];
      const wsUrl = candidate.url;
      const transportLabel =
        candidate.transport === "native" ? "native" : "sockjs";
      activeAttemptIndex = index;
      attemptedUrls.push(`${transportLabel}:${wsUrl}`);
      let failed = false;

      const failCandidate = (reasonMsg) => {
        if (failed || disposed || stopRetrying) return;
        if (activeClient !== client) return;
        failed = true;

        if (reasonMsg) {
          failureReasons.push(`${transportLabel}:${reasonMsg}`);
        }

        client.deactivate();
        tryCandidate(index + 1);
      };

      const clientConfig = {
        connectHeaders: {
          Authorization: authHeader,
          authorization: authHeader,
        },
        reconnectDelay: 0,
        connectionTimeout: 8000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: () => {},
        onConnect: () => {
          if (disposed) return;
          if (activeAttemptIndex !== index) return;
          wsErrorToastShownRef.current = false;
          stompRef.current = client;

          client.subscribe("/user/queue/errors", (msg) => {
            try {
              const wsErr = JSON.parse(msg.body);
              toastRef.current.error(
                wsErr?.message || "Telemedicine action denied",
              );
            } catch {
              toastRef.current.error("Telemedicine action denied");
            }
          });

          client.subscribe(`/topic/room/${roomId}`, (msg) => {
            try {
              if (!msg.body) return;
              const signal = JSON.parse(msg.body);
              handleSignalRef.current?.(signal);
            } catch (parseError) {
              console.warn("Ignoring non-JSON room frame", parseError);
            }
          });

          joinPublishAtRef.current = Date.now();
          try {
            client.publish({
              destination: "/app/join",
              body: JSON.stringify({
                type: "join",
                from: userId,
                roomId,
                data: {
                  role: participantRole,
                  userName,
                  ...(isDoctor
                    ? { callEnabled: doctorCallEnabledRef.current }
                    : {}),
                },
              }),
            });
          } catch (joinError) {
            console.warn("Telemedicine join publish failed", joinError);
          }
        },
        onStompError: (frame) => {
          const backendMsg =
            frame?.headers?.message ||
            frame?.body ||
            "Telemedicine STOMP error";
          const normalizedMsg = String(backendMsg);

          if (
            joinPublishAtRef.current > 0 &&
            Date.now() - joinPublishAtRef.current < 3000 &&
            /ExecutorSubscribableChannel\[clientInboundChannel\]|join/i.test(
              normalizedMsg,
            )
          ) {
            console.warn(
              "Ignoring non-fatal consultation join error",
              normalizedMsg,
            );
            return;
          }

          // For auth/authorization failures, stop cycling endpoints and surface root cause.
          if (/auth|token|unauthor|forbidden|denied/i.test(normalizedMsg)) {
            if (!disposed && activeClient === client) {
              stopRetrying = true;
              failureReasons.push(`${transportLabel}:STOMP ${normalizedMsg}`);
              client.deactivate();
              showFinalFailure();
            }
            return;
          }

          failCandidate(`STOMP ${normalizedMsg}`);
        },
        onWebSocketError: () => {
          // Failover logic is driven by close/stomp callbacks.
        },
        onWebSocketClose: (event) => {
          if (disposed || client.connected) return;
          const closeCode = event?.code;
          const closeReason = event?.reason;
          const reasonParts = [];
          if (closeCode) reasonParts.push(`code ${closeCode}`);
          if (closeReason) reasonParts.push(closeReason);
          const reasonText =
            reasonParts.length > 0
              ? `Socket closed (${reasonParts.join(", ")})`
              : "Socket closed before CONNECTED frame";
          failCandidate(reasonText);
        },
      };

      if (candidate.transport === "native") {
        clientConfig.brokerURL = wsUrl;
      } else {
        clientConfig.webSocketFactory = () => new SockJS(wsUrl);
      }

      const client = new Client(clientConfig);

      activeClient = client;
      client.activate();
    };

    const activationTimer = window.setTimeout(() => {
      if (disposed) return;
      tryCandidate(0);
    }, 0);

    if (wsCandidates.length === 0) {
      toastRef.current.error(
        "No telemedicine websocket endpoints available. Configure VITE_API_URL or backend host.",
      );
    }

    return () => {
      disposed = true;
      window.clearTimeout(activationTimer);
      if (activeClient?.connected) {
        activeClient.publish({
          destination: "/app/leave",
          body: JSON.stringify({
            type: "leave",
            from: userId,
            roomId,
            data: { role: participantRole, userName },
          }),
        });
      }
      void cleanupAgoraCall();
      if (stompRef.current === activeClient) {
        stompRef.current = null;
      }
      activeClient?.deactivate();
    };
  }, [
    accessError,
    appointment?.appointmentId,
    participantRole,
    roomId,
    token,
    userId,
    userName,
    isDoctor,
    cleanupAgoraCall,
  ]);

  const handleChatInputChange = useCallback(
    (e) => {
      setMessageInput(e.target.value);
    },
    [setMessageInput],
  );

  const videoControlConfig = useMemo(() => {
    const videoControlDisabled =
      !canUseCalls || (callActive && callType !== "video");
    const videoButtonClass =
      callActive && callType === "video"
        ? videoEnabled
          ? "bg-slate-700 hover:bg-slate-600"
          : "bg-red-600 hover:bg-red-700"
        : "bg-primary-600 hover:bg-primary-700";
    const videoTitle =
      callActive && callType === "video"
        ? videoEnabled
          ? "Turn video off"
          : "Turn video on"
        : "Start video call";

    const audioButtonClass = callActive
      ? audioEnabled
        ? "bg-slate-700 hover:bg-slate-600"
        : "bg-red-600 hover:bg-red-700"
      : "bg-emerald-600 hover:bg-emerald-700";
    const audioTitle = callActive
      ? audioEnabled
        ? "Mute microphone"
        : "Unmute microphone"
      : "Start audio call";

    return {
      videoControlDisabled,
      videoButtonClass,
      videoTitle,
      audioButtonClass,
      audioTitle,
    };
  }, [audioEnabled, callActive, callType, canUseCalls, videoEnabled]);

  const loadPatientDocuments = useCallback(async () => {
    if (isDoctor) return;
    try {
      setLoadingDocs(true);
      const response = await documentAPI.getDocuments(null, token);
      setDocuments(Array.isArray(response) ? response : []);
      setSelectedDocumentIds([]);
    } catch {
      toast.error("Failed to load your documents");
    } finally {
      setLoadingDocs(false);
    }
  }, [isDoctor, setLoadingDocs, setSelectedDocumentIds, toast, token]);

  const toggleSelectedDocument = useCallback(
    (documentId) => {
      setSelectedDocumentIds((prev) =>
        prev.includes(documentId)
          ? prev.filter((id) => id !== documentId)
          : [...prev, documentId],
      );
    },
    [setSelectedDocumentIds],
  );

  const handleSelectAllDocuments = useCallback(() => {
    setSelectedDocumentIds(documents.map((doc) => doc.documentId));
  }, [documents, setSelectedDocumentIds]);

  const handleClearSelectedDocuments = useCallback(() => {
    setSelectedDocumentIds([]);
  }, [setSelectedDocumentIds]);

  const handleGrantDocumentAccess = useCallback(async () => {
    if (isDoctor || !appointment?.appointmentId) return;
    if (selectedDocumentIds.length === 0 && !shareHealthAnalysis) {
      toast.warning("Select at least one item to share");
      return;
    }

    try {
      setGrantingAccess(true);
      await appointmentAPI.grantDocumentAccess(
        appointment.appointmentId,
        Number.isFinite(grantDurationMinutes)
          ? Math.max(0, grantDurationMinutes)
          : 0,
        selectedDocumentIds,
        token,
        { shareHealthAnalysis },
      );
      toast.success(
        "Access granted. Doctor can now open the secure folder and health trends.",
      );
      setActiveTab("docs");
    } catch (err) {
      toast.error(err.message || "Failed to grant document access");
    } finally {
      setGrantingAccess(false);
    }
  }, [
    appointment?.appointmentId,
    grantDurationMinutes,
    isDoctor,
    shareHealthAnalysis,
    selectedDocumentIds,
    setGrantingAccess,
    setActiveTab,
    toast,
    token,
  ]);

  const handleOpenDoctorHealthTrends = useCallback(() => {
    if (!isDoctor || !appointment?.appointmentId || !appointment?.patientId) {
      toast.error("Patient health trend view is unavailable for this session");
      return;
    }

    navigate(
      `/doctor/appointments/${appointment.appointmentId}/patient-health-trends/${appointment.patientId}`,
      {
        state: {
          patientName: appointment.patientName,
          from: `${location.pathname}${location.search}`,
        },
      },
    );
  }, [
    appointment?.appointmentId,
    appointment?.patientId,
    appointment?.patientName,
    isDoctor,
    location.pathname,
    location.search,
    navigate,
    toast,
  ]);

  const loadDoctorAccessibleDocuments = useCallback(async () => {
    if (!isDoctor || !appointment?.appointmentId) return;

    try {
      setDoctorDocsLoading(true);
      const status = await appointmentAPI.getPatientAccessStatusForDoctor(
        appointment.appointmentId,
        token,
      );
      const hasAccess = Boolean(status?.hasAccess);
      setDoctorHasAccess(hasAccess);

      if (!hasAccess) {
        setSelectedDocumentIds([]);
        setDocuments([]);
        return;
      }

      const docs = await appointmentAPI.getPatientDocumentsForDoctor(
        appointment.appointmentId,
        token,
      );
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      setDoctorHasAccess(false);
      setDocuments([]);
      toast.error(err.message || "Failed to load patient secure folder");
    } finally {
      setDoctorDocsLoading(false);
    }
  }, [
    appointment?.appointmentId,
    isDoctor,
    setDoctorDocsLoading,
    setDoctorHasAccess,
    setSelectedDocumentIds,
    toast,
    token,
  ]);

  useEffect(() => {
    if (activeTab !== "docs" && activeTab !== "access") return;

    if (isDoctor) {
      void loadDoctorAccessibleDocuments();
      return;
    }

    void loadPatientDocuments();
  }, [
    isDoctor,
    loadDoctorAccessibleDocuments,
    loadPatientDocuments,
    activeTab,
  ]);

  const handleOpenPatientDocumentForDoctor = useCallback(
    async (doc) => {
      if (!isDoctor || !appointment?.appointmentId || !doc?.documentId) return;

      const popup = window.open("", "_blank");

      if (popup) {
        popup.document.title = "Opening document...";
        popup.document.body.innerHTML =
          '<div style="font-family: sans-serif; padding: 24px;">Opening document...</div>';
      }

      try {
        const result = await appointmentAPI.openPatientDocumentForDoctor(
          appointment.appointmentId,
          doc.documentId,
          token,
        );

        const hasUsableMime =
          result.contentType &&
          result.contentType !== "application/octet-stream" &&
          result.contentType !== "application/download";
        const normalizedMime = hasUsableMime
          ? result.contentType
          : guessMimeTypeFromFileName(result.fileName || doc.fileName);
        const normalizedBlob = new Blob([result.blob], {
          type: normalizedMime,
        });
        const objectUrl = URL.createObjectURL(normalizedBlob);

        if (popup) {
          popup.location.href = objectUrl;
        } else {
          const link = document.createElement("a");
          link.href = objectUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.click();
        }

        window.setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 300000);
      } catch (err) {
        if (popup) popup.close();
        toast.error(err.message || "Failed to open patient document");
      }
    },
    [appointment?.appointmentId, isDoctor, toast, token],
  );

  const sendTextMessage = useCallback(async () => {
    const text = messageInput.trim();
    if (!text || !canMessage || !appointment?.appointmentId) return;

    setMessageInput("");

    try {
      const savedMessage = await appointmentAPI.sendAppointmentMessage(
        appointment.appointmentId,
        text,
        token,
      );

      const localMsg = mapPersistedTextMessage(savedMessage);
      addLocalMessage(localMsg);

      publishSignal({
        kind: "chat-message",
        id: localMsg.id,
        text: localMsg.text,
        senderName: localMsg.senderName,
        timestamp: localMsg.timestamp,
      });
    } catch (err) {
      setMessageInput(text);
      toast.error(err.message || "Failed to send message");
    }
  }, [
    addLocalMessage,
    appointment?.appointmentId,
    canMessage,
    messageInput,
    setMessageInput,
    publishSignal,
    toast,
    token,
  ]);

  const startCall = useCallback(
    async (type, options = {}) => {
      const { announce = true } = options;

      if (!canMessage) {
        toast.warning(
          "Session is ended. Wait for a new appointment to reopen actions.",
        );
        return;
      }

      if (!doctorCallEnabled) {
        toast.warning(
          "Calls are disabled by the doctor. Chat is still available.",
        );
        return;
      }

      try {
        if (!appointment?.doctorId || !appointment?.patientId) {
          throw new Error("Cannot initialize call without appointment pair");
        }

        await cleanupAgoraCall();

        const client = ensureAgoraClient();
        const appId =
          agoraAppIdRef.current ||
          (async () => {
            const response = await fetch("/api/agora/config", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error("Failed to load Agora configuration");
            }

            const config = await response.json();
            return config?.appId || "";
          })();

        const resolvedAppId = typeof appId === "string" ? appId : await appId;
        const finalAppId = resolvedAppId || import.meta.env.VITE_AGORA_APP_ID;

        if (!finalAppId) {
          throw new Error("Agora App ID is not configured");
        }
        agoraAppIdRef.current = finalAppId;

        const channelName = `consultation-${appointment.doctorId}-${appointment.patientId}`;
        const uid = Number(user?.userId || 0) || undefined;
        const rtcToken = await generateAgoraToken(channelName, uid || 0, {
          token,
        });

        await client.join(finalAppId, channelName, rtcToken || null, uid);

        // Ensure we attach already-published tracks from participants who joined first.
        for (const remoteUser of client.remoteUsers || []) {
          await subscribeRemoteMedia(client, remoteUser);
        }

        const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioTrackRef.current = localAudioTrack;

        if (type === "video") {
          const localVideoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: "720p_2",
          });
          localVideoTrackRef.current = localVideoTrack;
        }

        const tracksToPublish = [localAudioTrackRef.current].filter(Boolean);
        if (localVideoTrackRef.current) {
          tracksToPublish.push(localVideoTrackRef.current);
        }
        if (tracksToPublish.length > 0) {
          await client.publish(tracksToPublish);
        }

        callTypeRef.current = type;
        callActiveRef.current = true;
        setCallType(type);
        setCallActive(true);
        setIncomingCallType(null);
        setAudioEnabled(true);
        setVideoEnabled(type === "video");
        setRemoteVideoAvailable(Boolean(remoteVideoTrackRef.current));
        setCounterpartConnected((client.remoteUsers || []).length > 0);

        if (announce) {
          publishSignal({ kind: "call-request", callType: type });
        }

        publishSignal({
          kind: "call-joined",
          callType: type,
          participantName: userName,
        });
      } catch (err) {
        await cleanupAgoraCall();
        toast.error(err?.message || "Unable to start Agora call");
      }
    },
    [
      appointment?.doctorId,
      appointment?.patientId,
      canMessage,
      doctorCallEnabled,
      cleanupAgoraCall,
      ensureAgoraClient,
      publishSignal,
      setCounterpartConnected,
      setAudioEnabled,
      setCallActive,
      setCallType,
      setIncomingCallType,
      setRemoteVideoAvailable,
      setVideoEnabled,
      subscribeRemoteMedia,
      toast,
      token,
      user?.userId,
    ],
  );

  const joinIncomingCall = useCallback(() => {
    if (!incomingCallType) return Promise.resolve();

    setJoinCallPromptMessage("");
    return startCall(incomingCallType, { announce: false });
  }, [incomingCallType, setJoinCallPromptMessage, startCall]);

  const endCall = useCallback(async () => {
    await cleanupAgoraCall();
    publishSignal({ kind: "call-ended" });
  }, [cleanupAgoraCall, publishSignal]);

  const toggleCallViewportFullscreen = useCallback(async () => {
    const viewportElement = callViewportRef.current;
    if (!viewportElement) return;

    try {
      if (document.fullscreenElement === viewportElement) {
        await document.exitFullscreen();
        return;
      }

      await viewportElement.requestFullscreen();
    } catch {
      toast.error("Fullscreen mode is not available on this device");
    }
  }, [toast]);

  const toggleDoctorCallAvailability = useCallback(async () => {
    if (!isDoctor || !canMessage) return;

    const nextEnabled = !doctorCallEnabled;
    setDoctorCallEnabled(nextEnabled);
    publishSignal({ kind: "call-availability", enabled: nextEnabled });

    if (!nextEnabled) {
      setJoinCallPromptMessage("");
      setIncomingCallType(null);
      await endCall();
    }
  }, [
    canMessage,
    doctorCallEnabled,
    endCall,
    isDoctor,
    publishSignal,
    setDoctorCallEnabled,
    setIncomingCallType,
    setJoinCallPromptMessage,
  ]);

  const toggleVideo = useCallback(async () => {
    const track = localVideoTrackRef.current;
    if (!track) return;
    const next = !videoEnabled;
    await track.setEnabled(next);
    setVideoEnabled(next);
  }, [setVideoEnabled, videoEnabled]);

  const toggleAudio = useCallback(async () => {
    const track = localAudioTrackRef.current;
    if (!track) return;
    const next = !audioEnabled;
    await track.setEnabled(next);
    setAudioEnabled(next);
  }, [audioEnabled, setAudioEnabled]);

  const endSession = useCallback(async () => {
    try {
      await queueAPI.markCompleted(appointment.appointmentId, token);

      const timestamp = new Date().toISOString();
      const nextSession = {
        active: false,
        endedAt: timestamp,
        endedByRole: "doctor",
        endedByName: userName,
        lastAppointmentId: appointment.appointmentId,
      };

      const systemMsg = {
        id: buildMessageId(),
        kind: "system",
        text: `Session ended by ${userName}. Chat remains visible but actions are locked.`,
        timestamp,
      };

      setMessages((prev) => {
        const next = [...prev, systemMsg];
        setSessionAndPersist(nextSession, { messages: next });
        return next;
      });

      publishSignal({
        kind: "session-ended",
        endedByRole: "doctor",
        endedByName: userName,
        timestamp,
      });

      await endCall();
      toast.success("Session ended. Messaging and actions are now locked.");
      setAppointment((prev) =>
        prev ? { ...prev, status: "COMPLETED" } : prev,
      );
    } catch (err) {
      toast.error(err.message || "Failed to end session");
    }
  }, [
    appointment?.appointmentId,
    endCall,
    isDoctor,
    publishSignal,
    setSessionAndPersist,
    toast,
    token,
    userName,
  ]);

  const handleChatInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendTextMessage();
      }
    },
    [sendTextMessage],
  );

  const handleVideoControlClick = useCallback(() => {
    if (!callActive) {
      void startCall("video");
      return;
    }
    if (callType === "video") {
      void toggleVideo();
    }
  }, [callActive, callType, startCall, toggleVideo]);

  const handleAudioControlClick = useCallback(() => {
    if (!callActive) {
      void startCall("audio");
      return;
    }
    void toggleAudio();
  }, [callActive, startCall, toggleAudio]);

  const handleEndCallClick = useCallback(() => {
    void endCall();
  }, [endCall]);

  const headerName = isDoctor
    ? appointment?.patientName
    : `Dr. ${appointment?.doctorName || ""}`;
  const participantConnected = isDoctor ? patientConnected : doctorConnected;
  const statusDot = (isDoctor ? patientConnected : doctorConnected)
    ? "bg-green-500"
    : "bg-yellow-400";
  const incomingAudioCall =
    incomingCallType === "audio" && !callActive && canUseCalls;
  const incomingVideoCall =
    incomingCallType === "video" && !callActive && canUseCalls;

  if (loading) {
    const content = (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full border-b-2 border-primary-600 animate-spin" />
        <p className="text-sm text-gray-600">Opening consultation room...</p>
      </div>
    );

    if (embedded) {
      return <div className="h-full">{content}</div>;
    }

    return <DashboardLayout>{content}</DashboardLayout>;
  }

  if (accessError) {
    const content = (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Cannot Open Consultation
          </h2>
          <p className="text-sm text-red-700 mb-4">{accessError}</p>
          <button
            onClick={() =>
              navigate(
                isDoctor ? "/doctor/appointments" : "/patient/appointments",
              )
            }
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
          >
            Back to Appointments
          </button>
        </div>
      </div>
    );

    if (embedded) {
      return <div className="h-full">{content}</div>;
    }

    return <DashboardLayout>{content}</DashboardLayout>;
  }

  const content = (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white">
      <div
        className={`relative flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden ${embedded ? "" : "-m-6"} bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50`}
      >
        <div className="bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 z-20 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
              {headerName
                ?.split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("") || "TM"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg font-semibold text-slate-900 truncate leading-tight">
                {headerName || "Consultation"}
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${statusDot}`}
                />
                <span className="truncate">
                  {participantConnected ? "Online" : "Offline"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setRightPanelOpen((prev) => !prev)}
              className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              title={
                rightPanelOpen ? "Hide workspace panel" : "Show workspace panel"
              }
              aria-label={
                rightPanelOpen ? "Hide workspace panel" : "Show workspace panel"
              }
            >
              {rightPanelOpen ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={endSession}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 motion-safe:transition-all duration-150 md:duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              title="Close and end room"
              aria-label="Close and end room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="shrink-0">
          {canMessage && !doctorCallEnabled && !isDoctor && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-blue-700 text-[11px] font-medium text-center">
              Chat-only mode enabled by doctor.
            </div>
          )}

          {!canMessage && (
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium">
              Session is ended. Chat is view-only.
            </div>
          )}
        </div>

        <div className="relative flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 sm:gap-4">
            <section
              className={`flex-1 min-h-0 min-w-0 ${isMobileViewport && rightPanelOpen ? "hidden" : "flex"}`}
            >
              <div
                ref={callViewportRef}
                className="relative flex-1 min-h-0 rounded-3xl border border-slate-300/80 bg-slate-950 overflow-hidden shadow-xl ring-1 ring-slate-900/5"
              >
                {callActive ? (
                  callType === "video" ? (
                    <>
                      <div
                        ref={remoteVideoContainerRef}
                        className="absolute inset-0 bg-black"
                      />
                      {!remoteVideoAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center text-center text-slate-200 bg-slate-950/85 backdrop-blur-sm motion-safe:transition-opacity duration-200 md:duration-300">
                          <div>
                            <Video className="w-14 h-14 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">
                              Waiting for participant video...
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-28 right-4 w-28 h-20 sm:w-40 sm:h-28 rounded-2xl overflow-hidden border border-slate-500/80 bg-slate-800 shadow-xl motion-safe:transition-all duration-200 md:duration-300">
                        <div
                          ref={localVideoContainerRef}
                          className="w-full h-full"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                      <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-2xl font-semibold">
                        {(headerName || "TM")
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <p className="text-sm text-slate-300">
                        Audio call in progress
                      </p>
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-24 h-24 rounded-full bg-slate-800 text-slate-100 text-2xl font-semibold flex items-center justify-center mb-4 shadow-lg shadow-slate-900/30">
                      {(headerName || "TM")
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">
                      Ready to connect
                    </h3>
                    <p className="text-sm sm:text-base text-slate-200 mt-1 max-w-md">
                      Start a video or audio call using the floating action bar.
                    </p>
                  </div>
                )}

                {incomingAudioCall && (
                  <div className="absolute top-4 left-4 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg animate-pulse">
                    Incoming Audio Call
                  </div>
                )}
                {incomingVideoCall && (
                  <div className="absolute top-4 left-4 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg animate-pulse">
                    Incoming Video Call
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void toggleCallViewportFullscreen();
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/45 text-white motion-safe:transition-all duration-150 md:duration-200 hover:bg-black/60 md:hover:scale-105"
                  title={
                    callViewportFullscreen
                      ? "Exit fullscreen"
                      : "Enter fullscreen"
                  }
                >
                  {callViewportFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="rounded-2xl bg-slate-900/90 backdrop-blur px-3 py-2.5 flex items-center gap-2 sm:gap-3 border border-slate-700 shadow-2xl motion-safe:transition-all duration-200 md:duration-300">
                    <button
                      type="button"
                      disabled={videoControlConfig.videoControlDisabled}
                      onClick={handleVideoControlClick}
                      className={`p-3 rounded-full text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 disabled:cursor-not-allowed md:hover:-translate-y-0.5 ${
                        videoControlConfig.videoButtonClass
                      }`}
                      title={videoControlConfig.videoTitle}
                    >
                      {callActive && callType === "video" && !videoEnabled ? (
                        <VideoOff className="w-5 h-5" />
                      ) : (
                        <Video className="w-5 h-5" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!canUseCalls}
                      onClick={handleAudioControlClick}
                      className={`p-3 rounded-full text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 disabled:cursor-not-allowed md:hover:-translate-y-0.5 ${
                        videoControlConfig.audioButtonClass
                      }`}
                      title={videoControlConfig.audioTitle}
                    >
                      {callActive && !audioEnabled ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!callActive}
                      onClick={handleEndCallClick}
                      className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 disabled:cursor-not-allowed md:hover:-translate-y-0.5"
                      title="End call"
                    >
                      <Phone className="w-5 h-5 rotate-[135deg]" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <aside
              className={`min-h-0 min-w-0 h-full flex-col overflow-hidden border-t md:border-t-0 md:border-l border-slate-200 bg-white md:w-96 ${rightPanelOpen ? "flex" : "hidden md:flex"}`}
            >
              <div className="flex flex-col h-full min-h-0">
                <div className="grid grid-cols-3 border-b border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRightPanelTabSelect("chat")}
                    className={`px-3 py-3 text-xs font-semibold border-b-2 ${
                      activeTab === "chat"
                        ? "border-primary-600 text-primary-700 bg-primary-50/70"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRightPanelTabSelect("docs")}
                    className={`px-3 py-3 text-xs font-semibold border-b-2 ${
                      activeTab === "docs"
                        ? "border-primary-600 text-primary-700 bg-primary-50/70"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRightPanelTabSelect("access")}
                    className={`px-3 py-3 text-xs font-semibold border-b-2 ${
                      activeTab === "access"
                        ? "border-primary-600 text-primary-700 bg-primary-50/70"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Access
                  </button>
                </div>

                {activeTab === "chat" && (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-white">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <AlertCircle className="w-9 h-9 opacity-30 mb-2" />
                          <p className="text-sm">No messages yet</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <MessageBubble
                            key={msg.id}
                            msg={msg}
                            isMine={msg.senderId === userId}
                          />
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 bg-slate-50/80">
                      <textarea
                        value={messageInput}
                        onChange={handleChatInputChange}
                        rows={1}
                        disabled={!canMessage}
                        onKeyDown={handleChatInputKeyDown}
                        placeholder={
                          canMessage ? "Type a message..." : "Messaging locked."
                        }
                        className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        disabled={!canMessage || !messageInput.trim()}
                        onClick={sendTextMessage}
                        className="p-2.5 rounded-xl bg-primary-600 text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 hover:bg-primary-700 md:hover:-translate-y-0.5"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {activeTab === "docs" && (
                  <div className="flex-1 min-h-0 overflow-y-auto p-3">
                    {isDoctor ? (
                      <AccessibleDocumentsPanel
                        loading={doctorDocsLoading}
                        hasAccess={doctorHasAccess}
                        documents={documents}
                        onOpenDocument={handleOpenPatientDocumentForDoctor}
                        onOpenHealthTrends={handleOpenDoctorHealthTrends}
                        onRefresh={loadDoctorAccessibleDocuments}
                      />
                    ) : (
                      <div className="h-full min-h-0 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-slate-800">
                            Your Documents
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              void loadPatientDocuments();
                            }}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="space-y-2 overflow-y-auto max-h-full">
                          {loadingDocs ? (
                            <PanelSkeleton rows={4} />
                          ) : documents.length === 0 ? (
                            <div className="h-32 flex flex-col items-center justify-center text-slate-400 rounded-xl border border-slate-100 bg-slate-50">
                              <FileText className="w-9 h-9 opacity-40 mb-2" />
                              <p className="text-sm">
                                No uploaded documents yet
                              </p>
                            </div>
                          ) : (
                            documents.map((doc) => (
                              <div
                                key={doc.documentId}
                                className="w-full p-3 rounded-xl border border-slate-100 bg-slate-50"
                              >
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {doc.fileName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {doc.documentType || "Document"}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "access" && (
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                    {isDoctor ? (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                          <p className="text-sm font-semibold text-slate-800">
                            Consultation Actions
                          </p>
                          <div className="mt-3 space-y-2">
                            <button
                              type="button"
                              disabled={!appointment?.appointmentId}
                              onClick={() => {
                                const returnTo = `${location.pathname}${location.search}`;
                                navigate(
                                  `/doctor/appointments/${appointment?.appointmentId}/prescription`,
                                  {
                                    state: { from: returnTo },
                                  },
                                );
                              }}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 hover:bg-emerald-700 md:hover:-translate-y-0.5"
                            >
                              <Pill className="w-4 h-4" />
                              Write Prescription
                            </button>

                            <button
                              type="button"
                              disabled={!canMessage}
                              onClick={() => {
                                void toggleDoctorCallAvailability();
                              }}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 hover:bg-slate-800 md:hover:-translate-y-0.5"
                            >
                              {doctorCallEnabled ? (
                                <ToggleRight className="w-4 h-4" />
                              ) : (
                                <ToggleLeft className="w-4 h-4" />
                              )}
                              {doctorCallEnabled
                                ? "Calls Enabled"
                                : "Calls Disabled (Chat Only)"}
                            </button>

                            <button
                              type="button"
                              disabled={!canMessage}
                              onClick={endSession}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 hover:bg-red-700 md:hover:-translate-y-0.5"
                            >
                              <X className="w-4 h-4" />
                              End Session
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <p className="text-sm font-semibold text-slate-800">
                            Quick Call Options
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={!canUseCalls}
                              onClick={() => {
                                void startCall("audio");
                              }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 hover:bg-slate-50 md:hover:-translate-y-0.5"
                            >
                              <PhoneCall className="w-4 h-4" />
                              Audio
                            </button>
                            <button
                              type="button"
                              disabled={!canUseCalls}
                              onClick={() => {
                                void startCall("video");
                              }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 motion-safe:transition-all duration-150 md:duration-200 disabled:opacity-40 hover:bg-slate-50 md:hover:-translate-y-0.5"
                            >
                              <Video className="w-4 h-4" />
                              Video
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <GrantAccessPanel
                        loading={loadingDocs}
                        documents={documents}
                        selectedDocumentIds={selectedDocumentIds}
                        shareHealthAnalysis={shareHealthAnalysis}
                        durationMinutes={grantDurationMinutes}
                        onToggleDocument={toggleSelectedDocument}
                        onToggleShareHealthAnalysis={() =>
                          setShareHealthAnalysis((prev) => !prev)
                        }
                        onSelectAll={handleSelectAllDocuments}
                        onClearSelection={handleClearSelectedDocuments}
                        onDurationChange={setGrantDurationMinutes}
                        onConfirm={handleGrantDocumentAccess}
                        confirming={grantingAccess}
                      />
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <CallNotification
        isOpen={Boolean(incomingCallType) && !callActive && canUseCalls}
        callType={incomingCallType || "video"}
        callerName={headerName || "Your participant"}
        promptMessage={!isDoctor ? joinCallPromptMessage : ""}
        onAccept={joinIncomingCall}
        onDecline={() => {
          setJoinCallPromptMessage("");
          setIncomingCallType(null);
        }}
      />

      <ParticipantJoinedNotification
        isOpen={participantJoinedNotification.isOpen}
        participantName={participantJoinedNotification.participantName}
        callType={participantJoinedNotification.callType}
        headline={participantJoinedNotification.headline}
        statusText={participantJoinedNotification.statusText}
        footerText={participantJoinedNotification.footerText}
        onDismiss={() =>
          setParticipantJoinedNotification((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        autoDismissMs={4000}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return <DashboardLayout>{content}</DashboardLayout>;
};

export default ConsultationRoom;
