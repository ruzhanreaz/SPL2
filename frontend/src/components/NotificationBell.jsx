import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, Video } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { notificationAPI } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../utils/timezoneUtils";
import {
  connectNotificationRealtime,
  emitNotificationSync,
  subscribeNotificationSync,
} from "../utils/notificationRealtime";
import {
  getMonthlyWeightReminderUnreadCount,
  isMonthlyWeightReminder,
  markMonthlyWeightReminderAsRead,
  mergeNotificationsWithMonthlyWeightReminder,
} from "../utils/monthlyWeightReminder";

const isPatientRole = (role) =>
  String(role || "")
    .toUpperCase()
    .includes("PATIENT");

const isInProgressQueueNotification = (notification) => {
  if (!notification || notification.type !== "QUEUE_UPDATE") {
    return false;
  }

  const status = String(notification.appointmentStatus || "").toUpperCase();
  if (status === "IN_PROGRESS") {
    return true;
  }

  const title = String(notification.title || "").toLowerCase();
  const message = String(notification.message || "").toLowerCase();
  return (
    title.includes("in progress") ||
    message.includes("in progress") ||
    message.includes("join your telemedicine call")
  );
};

const NotificationBell = ({ closeSignal = 0, onOpenChange }) => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const setDropdownOpen = useCallback(
    (open) => {
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange],
  );

  const getNotificationId = (notification) =>
    notification?.notificationId ?? notification?.id ?? null;

  const getNotificationTimestamp = (notification) =>
    notification?.createdAt ?? notification?.timestamp ?? null;

  const fetchUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await notificationAPI.getUnreadCount(token);
      setUnreadCount(
        (Number(count) || 0) + getMonthlyWeightReminderUnreadCount(user),
      );
    } catch (error) {
      if (error?.status === 401) {
        setUnreadCount(0);
        return;
      }
      console.error("Failed to fetch unread count:", error);
    }
  }, [token, user]);

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await notificationAPI.getAllNotifications(token);
      setNotifications(
        mergeNotificationsWithMonthlyWeightReminder(data || [], user),
      );
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  // Keep unread count fresh via polling + visibility/focus + local sync events.
  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    const onVisibleOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
        if (isOpen) {
          fetchNotifications();
        }
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
      }
    }, 5000);

    const unsubscribeSync = subscribeNotificationSync(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    });

    window.addEventListener("focus", onVisibleOrFocus);
    document.addEventListener("visibilitychange", onVisibleOrFocus);

    return () => {
      clearInterval(interval);
      unsubscribeSync();
      window.removeEventListener("focus", onVisibleOrFocus);
      document.removeEventListener("visibilitychange", onVisibleOrFocus);
    };
  }, [token, isOpen, fetchUnreadCount, fetchNotifications]);

  // Realtime push for instant updates when backend emits notification events.
  useEffect(() => {
    if (!token) return undefined;

    return connectNotificationRealtime({
      token,
      onMessage: () => {
        fetchUnreadCount();
        if (isOpen) {
          fetchNotifications();
        }
        emitNotificationSync({ source: "bell", reason: "realtime" });
      },
    });
  }, [token, isOpen, fetchUnreadCount, fetchNotifications]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && token) {
      fetchNotifications();
    }
  }, [isOpen, token, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setDropdownOpen]);

  useEffect(() => {
    setDropdownOpen(false);
  }, [closeSignal, setDropdownOpen]);

  const handleMarkAsRead = async (notificationId) => {
    if (!notificationId) return;

    const target = notifications.find(
      (notif) => getNotificationId(notif) === notificationId,
    );
    if (isMonthlyWeightReminder(target)) {
      markMonthlyWeightReminderAsRead(user);
      setNotifications((prev) =>
        prev.map((notif) =>
          getNotificationId(notif) === notificationId
            ? { ...notif, isRead: true }
            : notif,
        ),
      );
      fetchUnreadCount();
      emitNotificationSync({ source: "bell", reason: "mark-read" });
      return;
    }

    try {
      await notificationAPI.markAsRead(notificationId, token);
      setNotifications((prev) =>
        prev.map((notif) =>
          getNotificationId(notif) === notificationId
            ? { ...notif, isRead: true }
            : notif,
        ),
      );
      fetchUnreadCount();
      emitNotificationSync({ source: "bell", reason: "mark-read" });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead(token);
      markMonthlyWeightReminderAsRead(user);
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true })),
      );
      setUnreadCount(0);
      emitNotificationSync({ source: "bell", reason: "mark-all" });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "APPOINTMENT_REQUEST":
        return "📅";
      case "APPOINTMENT_CONFIRMED":
        return "✅";
      case "APPOINTMENT_REJECTED":
        return "❌";
      case "APPOINTMENT_CANCELLED":
        return "🚫";
      case "APPOINTMENT_COMPLETED":
        return "🏁";
      case "QUEUE_UPDATE":
        return "🚦";
      case "SCHEDULE_CHANGED":
        return "🗓️";
      case "REMINDER":
        return "⏰";
      case "WEIGHT_MONTHLY_REMINDER":
        return "⚖️";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setDropdownOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="fixed top-14 left-2 right-2 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] sm:max-h-[32rem] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 text-center leading-tight"
              >
                <CheckCheck size={14} />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-sm">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification, index) => {
                  const notificationId = getNotificationId(notification);
                  const notificationKey =
                    notificationId ??
                    `${notification.type || "notification"}-${notification.createdAt || notification.timestamp || index}-${index}`;

                  return (
                    <div
                      key={notificationKey}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? "bg-primary-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          {isInProgressQueueNotification(notification) &&
                            notification.relatedEntityId &&
                            notification.appointmentType === "ONLINE" &&
                            isPatientRole(user?.role) && (
                              <button
                                onClick={() => {
                                  setDropdownOpen(false);
                                  navigate(
                                    `/patient/telemedicine?appointmentId=${notification.relatedEntityId}`,
                                  );
                                }}
                                className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full text-center leading-tight hover:bg-primary-700 transition-colors"
                              >
                                <Video className="w-3.5 h-3.5" />
                                Join Consultation
                              </button>
                            )}
                          {notification.type === "WEIGHT_MONTHLY_REMINDER" && (
                            <button
                              onClick={() => {
                                setDropdownOpen(false);
                                navigate(
                                  "/profile?section=medical&edit=1&focus=weight",
                                );
                              }}
                              className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full text-center leading-tight hover:bg-primary-700 transition-colors"
                            >
                              Update Weight
                            </button>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {formatRelativeTime(
                              getNotificationTimestamp(notification),
                            )}
                          </p>
                        </div>

                        {/* Mark as read button */}
                        <div className="flex-shrink-0">
                          {!notification.isRead && notificationId ? (
                            <button
                              onClick={() => handleMarkAsRead(notificationId)}
                              className="p-1 text-primary-600 hover:bg-primary-100 rounded-full transition-colors"
                              title="Mark as read"
                            >
                              <Check size={16} />
                            </button>
                          ) : (
                            <div className="p-1 text-gray-400">
                              <CheckCheck size={16} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-center flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/notifications");
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium text-center leading-tight"
              >
                View All Notifications
              </button>
              <button
                onClick={() => setDropdownOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-600 font-medium text-center leading-tight"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
