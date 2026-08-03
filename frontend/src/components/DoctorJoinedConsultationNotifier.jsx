import { useCallback, useEffect, useState } from "react";
import ParticipantJoinedNotification from "./ParticipantJoinedNotification";

const DOCTOR_JOINED_EVENT_NAME = "vb:doctor-joined-consultation";

const getJoinedDisplayName = (payload) => {
  const doctorName = String(payload?.callerName || "Doctor").trim();
  if (doctorName) {
    return doctorName;
  }

  return "Doctor";
};

const getJoinedHeadline = (payload) => {
  const reason = String(payload?.reason || "").trim();
  if (reason) {
    return reason;
  }

  return "Doctor joined the consultation";
};

const getJoinedFooterText = (payload) => {
  const callType = String(payload?.callType || "video").toLowerCase();
  return callType === "audio"
    ? "Audio session is ready"
    : "Video session is ready";
};

const getBrowserNotificationBody = (payload) => {
  const appointmentId = payload?.appointmentId
    ? `Appointment #${payload.appointmentId}`
    : "Consultation room";
  const callType = String(payload?.callType || "video").toLowerCase();
  return callType === "audio"
    ? `${appointmentId} is ready for audio consultation.`
    : `${appointmentId} is ready for video consultation.`;
};

const shouldRequestPermission = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  window.Notification.permission === "default";

const showBrowserNotification = async (payload) => {
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

  const notification = new window.Notification(
    "Doctor joined your consultation",
    {
      body: getBrowserNotificationBody(payload),
      tag: `doctor-joined-${payload?.appointmentId || "consultation"}`,
      renotify: true,
    },
  );

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

const DoctorJoinedConsultationNotifier = () => {
  const [notificationState, setNotificationState] = useState({
    isOpen: false,
    participantName: "Doctor",
    callType: "video",
    headline: "Doctor joined the consultation",
    statusText: "Your consultation room is now active.",
    footerText: "Video session is ready",
  });

  const handleDoctorJoined = useCallback((event) => {
    const payload = event?.detail || {};
    const participantName = getJoinedDisplayName(payload);
    const callType =
      String(payload?.callType || "video").toLowerCase() === "audio"
        ? "audio"
        : "video";
    const headline = getJoinedHeadline(payload);

    setNotificationState({
      isOpen: true,
      participantName,
      callType,
      headline,
      statusText: "Your consultation room is now active.",
      footerText: getJoinedFooterText(payload),
    });
    void showBrowserNotification(payload);
  }, []);

  useEffect(() => {
    window.addEventListener(DOCTOR_JOINED_EVENT_NAME, handleDoctorJoined);
    return () => {
      window.removeEventListener(DOCTOR_JOINED_EVENT_NAME, handleDoctorJoined);
    };
  }, [handleDoctorJoined]);

  const handleDismiss = () => {
    setNotificationState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  return (
    <ParticipantJoinedNotification
      isOpen={notificationState.isOpen}
      participantName={notificationState.participantName}
      callType={notificationState.callType}
      headline={notificationState.headline}
      statusText={notificationState.statusText}
      footerText={notificationState.footerText}
      onDismiss={handleDismiss}
      autoDismissMs={5000}
    />
  );
};

export default DoctorJoinedConsultationNotifier;
