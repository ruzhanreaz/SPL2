import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export const DOCTOR_JOINED_SIGNAL_TYPE = "DOCTOR_JOINED_CONSULTATION";

const normalizeBaseUrl = (url) => {
  if (!url) {
    return null;
  }

  return String(url).trim().replace(/\/+$/, "");
};

const toSockJsBaseUrl = (url) => {
  const base = normalizeBaseUrl(url);
  if (!base) {
    return null;
  }

  if (base.startsWith("wss://")) {
    return `https://${base.slice("wss://".length)}`;
  }

  if (base.startsWith("ws://")) {
    return `http://${base.slice("ws://".length)}`;
  }

  return base;
};

const buildTelemedicineSockJsCandidates = () => {
  const envApiUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  const envWsUrl = toSockJsBaseUrl(import.meta.env.VITE_WS_URL);
  const originProtocol =
    window.location.protocol === "https:" ? "https:" : "http:";
  const originHost = window.location.host;
  const host = window.location.hostname;

  const candidates = [
    envWsUrl &&
      `${envWsUrl.replace(/\/ws-telemedicine\/?$/, "")}/ws-telemedicine`,
    envApiUrl && `${envApiUrl.replace(/\/api\/?$/, "")}/ws-telemedicine`,
    `${originProtocol}//${originHost}/ws-telemedicine`,
    `${originProtocol}//${host}:8080/ws-telemedicine`,
    `${originProtocol}//localhost:8080/ws-telemedicine`,
    `${originProtocol}//127.0.0.1:8080/ws-telemedicine`,
    "/ws-telemedicine",
  ].filter(Boolean);

  return [...new Set(candidates)];
};

const toBearerToken = (token) => {
  if (!token) {
    return null;
  }

  const normalized = String(token).trim();
  if (!normalized) {
    return null;
  }

  if (/^Bearer\s+/i.test(normalized)) {
    return normalized;
  }

  return `Bearer ${normalized}`;
};

const parseFrameBody = (frame) => {
  if (!frame || typeof frame.body !== "string") {
    return null;
  }

  try {
    return JSON.parse(frame.body);
  } catch {
    return null;
  }
};

const normalizeAppointmentId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isDoctorJoinedPayload = (payload, appointmentId) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (payload.signalType !== DOCTOR_JOINED_SIGNAL_TYPE) {
    return false;
  }

  if (String(payload.callerRole || "").toLowerCase() !== "doctor") {
    return false;
  }

  const expectedAppointmentId = normalizeAppointmentId(appointmentId);
  const payloadAppointmentId = normalizeAppointmentId(payload.appointmentId);

  if (expectedAppointmentId === null) {
    return true;
  }

  return payloadAppointmentId === expectedAppointmentId;
};

export default function useDoctorJoinedConsultationListener({
  token,
  enabled = true,
  appointmentId = null,
  onDoctorJoined,
} = {}) {
  const [lastDoctorJoinedEvent, setLastDoctorJoinedEvent] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const latestHandlerRef = useRef(onDoctorJoined);

  useEffect(() => {
    latestHandlerRef.current = onDoctorJoined;
  }, [onDoctorJoined]);

  useEffect(() => {
    const authHeader = toBearerToken(token);
    if (!enabled || !authHeader) {
      setIsConnected(false);
      return undefined;
    }

    let disposed = false;
    let activeClient = null;
    const candidates = buildTelemedicineSockJsCandidates();

    const tryConnect = (index) => {
      if (disposed || index >= candidates.length) {
        if (!disposed) {
          setIsConnected(false);
          setConnectionError(
            "Unable to connect to telemedicine websocket endpoint",
          );
        }
        return;
      }

      const wsUrl = candidates[index];
      const client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        connectHeaders: {
          Authorization: authHeader,
          authorization: authHeader,
        },
        reconnectDelay: 0,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: () => {},
        onConnect: () => {
          if (disposed) {
            return;
          }

          setIsConnected(true);
          setConnectionError(null);

          client.subscribe("/user/queue/calls", (frame) => {
            const payload = parseFrameBody(frame);
            if (!isDoctorJoinedPayload(payload, appointmentId)) {
              return;
            }

            setLastDoctorJoinedEvent(payload);
            if (typeof latestHandlerRef.current === "function") {
              latestHandlerRef.current(payload);
            }
          });
        },
        onStompError: () => {
          if (disposed || activeClient !== client) {
            return;
          }

          setIsConnected(false);
          client.deactivate();
          tryConnect(index + 1);
        },
        onWebSocketError: () => {
          if (disposed || activeClient !== client) {
            return;
          }

          setIsConnected(false);
          client.deactivate();
          tryConnect(index + 1);
        },
        onWebSocketClose: () => {
          if (disposed || activeClient !== client) {
            return;
          }

          setIsConnected(false);
          tryConnect(index + 1);
        },
      });

      activeClient = client;
      client.activate();
    };

    tryConnect(0);

    return () => {
      disposed = true;
      setIsConnected(false);
      if (activeClient) {
        activeClient.deactivate();
      }
    };
  }, [appointmentId, enabled, token]);

  return {
    lastDoctorJoinedEvent,
    isConnected,
    connectionError,
  };
}
