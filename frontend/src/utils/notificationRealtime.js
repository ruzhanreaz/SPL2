import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export const NOTIFICATION_SYNC_EVENT = "vb:notifications:sync";

const normalizeBaseUrl = (url) => {
  if (!url) return null;
  return String(url).replace(/\/+$/, "");
};

const toSockJsBaseUrl = (url) => {
  const base = normalizeBaseUrl(url);
  if (!base) return null;

  if (base.startsWith("wss://")) {
    return `https://${base.slice("wss://".length)}`;
  }

  if (base.startsWith("ws://")) {
    return `http://${base.slice("ws://".length)}`;
  }

  return base;
};

const buildWsCandidates = () => {
  const envApiUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  const envWsUrl = toSockJsBaseUrl(import.meta.env.VITE_WS_URL);
  const host = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const originWsBase = `${protocol}//${window.location.host}`;

  const candidates = [
    envWsUrl ? `${envWsUrl.replace(/\/ws$/, "")}/ws` : null,
    envApiUrl ? `${envApiUrl.replace(/\/api$/, "")}/ws` : null,
    `${originWsBase}/ws`,
    `${protocol}//${host}:8080/ws`,
    `${protocol}//localhost:8080/ws`,
    `${protocol}//127.0.0.1:8080/ws`,
  ].filter(Boolean);

  return [...new Set(candidates)];
};

export const emitNotificationSync = (detail = {}) => {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_SYNC_EVENT, { detail }));
};

export const subscribeNotificationSync = (handler) => {
  const listener = (event) => handler(event?.detail || {});
  window.addEventListener(NOTIFICATION_SYNC_EVENT, listener);
  return () => {
    window.removeEventListener(NOTIFICATION_SYNC_EVENT, listener);
  };
};

export const connectNotificationRealtime = ({ token, onMessage }) => {
  if (!token) {
    return () => {};
  }

  const candidates = buildWsCandidates();
  let activeClient = null;
  let disposed = false;

  const tryConnect = (index) => {
    if (disposed || index >= candidates.length) return;

    const wsUrl = candidates[index];
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        authorization: `Bearer ${token}`,
      },
      reconnectDelay: 0,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
      onConnect: () => {
        client.subscribe("/user/queue/notifications", (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            onMessage?.(payload);
          } catch {
            onMessage?.(null);
          }
        });
      },
      onStompError: () => {
        if (activeClient === client) {
          client.deactivate();
          tryConnect(index + 1);
        }
      },
      onWebSocketClose: () => {
        if (activeClient === client && !disposed) {
          tryConnect(index + 1);
        }
      },
      onWebSocketError: () => {
        if (activeClient === client && !disposed) {
          client.deactivate();
          tryConnect(index + 1);
        }
      },
    });

    activeClient = client;
    client.activate();
  };

  tryConnect(0);

  return () => {
    disposed = true;
    if (activeClient) {
      activeClient.deactivate();
    }
  };
};
