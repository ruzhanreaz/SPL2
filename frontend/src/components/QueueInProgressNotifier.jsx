import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, MapPin, Video, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "./ToastProvider";
import { connectNotificationRealtime } from "../utils/notificationRealtime";

const QUEUE_IN_PROGRESS_TITLE = "Consultation In Progress";
const ALERT_COOLDOWN_MS = 15000;

const isPatientRole = (role) =>
  String(role || "")
    .toUpperCase()
    .includes("PATIENT");

const shouldRequestPermission = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  window.Notification.permission === "default";

const showBrowserNotification = async (title, body, appointmentId) => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (window.Notification.permission === "default") {
    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }
    } catch {
      return;
    }
  }

  if (window.Notification.permission !== "granted") {
    return;
  }

  const notification = new window.Notification(title, {
    body,
    tag: `queue-in-progress-${appointmentId || "consultation"}`,
    renotify: true,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

const isQueueInProgressNotification = (payload) => {
  const notification = payload?.notification;
  if (!notification) {
    return false;
  }

  const title = String(notification.title || "").trim();
  const type = String(notification.type || "")
    .trim()
    .toUpperCase();
  const message = String(notification.message || "")
    .trim()
    .toLowerCase();
  return (
    type === "QUEUE_UPDATE" &&
    (title === QUEUE_IN_PROGRESS_TITLE || message.includes("your turn"))
  );
};

const resolveMode = (notification) => {
  const appointmentType = String(
    notification?.appointmentType || "",
  ).toUpperCase();
  if (appointmentType === "ONLINE") {
    return "online";
  }
  return "inPerson";
};

const buildCooldownKey = (notification, mode, message) => {
  const relatedEntityId = String(notification?.relatedEntityId ?? "unknown");
  return `${mode}:${relatedEntityId}:${String(message || "")
    .trim()
    .toLowerCase()}`;
};

const QueueInProgressNotifier = () => {
  const { token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const seenIdsRef = useRef(new Set());
  const recentAlertTimestampsRef = useRef(new Map());
  const [state, setState] = useState({
    isOpen: false,
    mode: "inPerson",
    headline: "",
    message: "",
    appointmentId: null,
  });

  const handleDismiss = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleRealtimeMessage = useCallback(
    (payload) => {
      if (!isQueueInProgressNotification(payload)) {
        return;
      }

      const notification = payload.notification;
      const appointmentType = String(notification?.appointmentType || "")
        .trim()
        .toUpperCase();
      if (appointmentType !== "ONLINE" || !isPatientRole(user?.role)) {
        return;
      }

      const notificationId = notification?.notificationId;
      if (notificationId != null) {
        if (seenIdsRef.current.has(notificationId)) {
          return;
        }
        seenIdsRef.current.add(notificationId);
      }

      const mode = resolveMode(notification);
      const message =
        String(notification?.message || "").trim() ||
        "It's your turn to join the consultation";
      const headline = "It's your turn to join the consultation";

      const now = Date.now();
      const cooldownKey = buildCooldownKey(notification, mode, message);
      const lastShownAt = recentAlertTimestampsRef.current.get(cooldownKey);
      if (lastShownAt && now - lastShownAt < ALERT_COOLDOWN_MS) {
        return;
      }

      recentAlertTimestampsRef.current.set(cooldownKey, now);

      // Prune stale keys so cooldown memory stays bounded in long sessions.
      if (recentAlertTimestampsRef.current.size > 200) {
        for (const [key, timestamp] of recentAlertTimestampsRef.current) {
          if (now - timestamp > ALERT_COOLDOWN_MS) {
            recentAlertTimestampsRef.current.delete(key);
          }
        }
      }

      toast.info(message, 6000);
      void showBrowserNotification(
        headline,
        message,
        notification?.relatedEntityId,
      );

      setState({
        isOpen: true,
        mode,
        headline,
        message,
        appointmentId: notification?.relatedEntityId ?? null,
      });
    },
    [toast, user?.role],
  );

  useEffect(() => {
    if (token) {
      return;
    }
    seenIdsRef.current.clear();
    recentAlertTimestampsRef.current.clear();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    return connectNotificationRealtime({
      token,
      onMessage: handleRealtimeMessage,
    });
  }, [handleRealtimeMessage, token]);

  if (!state.isOpen) {
    return null;
  }

  const isOnline = state.mode === "online";

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="queue-in-progress-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div className="min-w-0">
              <p
                id="queue-in-progress-title"
                className="text-sm font-bold text-gray-900 truncate"
              >
                {state.headline || QUEUE_IN_PROGRESS_TITLE}
              </p>
              <p className="text-xs text-gray-500">Telemedicine appointment</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ${isOnline ? "bg-primary-100 text-primary-700" : "bg-amber-100 text-amber-700"}`}
            >
              <Video className="w-4 h-4" />
            </div>
            <p className="text-sm text-gray-700 leading-6">{state.message}</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Dismiss
          </button>

          {state.appointmentId && (
            <button
              type="button"
              onClick={() => {
                handleDismiss();
                navigate(
                  `/patient/telemedicine?appointmentId=${state.appointmentId}`,
                );
              }}
              className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              Join Consultation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueueInProgressNotifier;
