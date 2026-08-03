import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Bell,
  CheckCheck,
  Check,
  CheckCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../auth/AuthProvider";
import { notificationAPI } from "../utils/api";
import { useNavigate } from "react-router-dom";
import {
  connectNotificationRealtime,
  emitNotificationSync,
  subscribeNotificationSync,
} from "../utils/notificationRealtime";
import {
  isMonthlyWeightReminder,
  markMonthlyWeightReminderAsRead,
  mergeNotificationsWithMonthlyWeightReminder,
} from "../utils/monthlyWeightReminder";
import PageHeader from "../components/ui/PageHeader";
import PageLoadingState from "../components/ui/PageLoadingState";
import PageErrorState from "../components/ui/PageErrorState";
import PageEmptyState from "../components/ui/PageEmptyState";

const NOTIFICATION_FILTER_STORAGE_KEY = "vb.notifications.filter";

const getNotificationCategory = (type) => {
  if (!type) return "system";
  if (type.startsWith("APPOINTMENT_")) return "appointments";
  if (type === "REMINDER" || type === "WEIGHT_MONTHLY_REMINDER") {
    return "reminders";
  }
  return "system";
};

const getNotificationId = (notification) =>
  notification?.notificationId ?? notification?.id ?? null;

const getNotificationTimestamp = (notification) =>
  notification?.createdAt ?? notification?.timestamp ?? null;

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

const Notifications = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const filterBarRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState(() => {
    try {
      return localStorage.getItem(NOTIFICATION_FILTER_STORAGE_KEY) || "all";
    } catch {
      return "all";
    }
  });

  const fetchNotifications = useCallback(
    async (options = {}) => {
      const { silent = false } = options;

      if (!token) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        const data = await notificationAPI.getAllNotifications(token);
        setNotifications(
          mergeNotificationsWithMonthlyWeightReminder(
            Array.isArray(data) ? data : [],
            user,
          ),
        );
      } catch (err) {
        setError(err?.message || "Failed to load notifications");
        console.error("Error fetching notifications:", err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [token, user],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!token) return undefined;

    const refreshFromSignal = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications({ silent: true });
      }
    };

    const interval = setInterval(refreshFromSignal, 5000);
    const unsubscribeSync = subscribeNotificationSync(() =>
      fetchNotifications({ silent: true }),
    );

    window.addEventListener("focus", refreshFromSignal);
    document.addEventListener("visibilitychange", refreshFromSignal);

    return () => {
      clearInterval(interval);
      unsubscribeSync();
      window.removeEventListener("focus", refreshFromSignal);
      document.removeEventListener("visibilitychange", refreshFromSignal);
    };
  }, [token, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterBarRef.current &&
        !filterBarRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    return connectNotificationRealtime({
      token,
      onMessage: () => {
        fetchNotifications({ silent: true });
        emitNotificationSync({
          source: "notifications-page",
          reason: "realtime",
        });
      },
    });
  }, [token, fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    const target = notifications.find(
      (n) => getNotificationId(n) === notificationId,
    );
    if (isMonthlyWeightReminder(target)) {
      markMonthlyWeightReminderAsRead(user);
      setNotifications((prev) =>
        prev.map((n) =>
          getNotificationId(n) === notificationId ? { ...n, isRead: true } : n,
        ),
      );
      emitNotificationSync({
        source: "notifications-page",
        reason: "mark-read",
      });
      return;
    }

    try {
      await notificationAPI.markAsRead(notificationId, token);
      setNotifications((prev) =>
        prev.map((n) =>
          getNotificationId(n) === notificationId ? { ...n, isRead: true } : n,
        ),
      );
      emitNotificationSync({
        source: "notifications-page",
        reason: "mark-read",
      });
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead(token);
      markMonthlyWeightReminderAsRead(user);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      emitNotificationSync({
        source: "notifications-page",
        reason: "mark-all",
      });
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleFilterChange = (nextFilter) => {
    setActiveFilter(nextFilter);
    localStorage.setItem(NOTIFICATION_FILTER_STORAGE_KEY, nextFilter);
  };

  const handleOpenRatingFromNotification = async (notification) => {
    const appointmentId = notification?.relatedEntityId;
    if (!appointmentId) return;

    const notificationId = getNotificationId(notification);
    if (!notification?.isRead && notificationId) {
      await handleMarkAsRead(notificationId);
    }

    navigate(`/patient/appointments?rate=1&appointmentId=${appointmentId}`);
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
      case "PRESCRIPTION_RECEIVED":
        return "💊";
      case "REVIEW_REQUEST":
        return "⭐";
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

  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Just now";

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  const filteredNotifications = useMemo(() => {
    const scoped =
      activeFilter === "all"
        ? notifications
        : activeFilter === "unread"
          ? notifications.filter((n) => !n.isRead)
          : notifications.filter(
              (n) => getNotificationCategory(n.type) === activeFilter,
            );

    const query = searchQuery.trim().toLowerCase();
    if (!query) return scoped;

    return scoped.filter((notification) => {
      const haystack = [
        notification.title,
        notification.message,
        notification.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [notifications, activeFilter, searchQuery]);

  const filterCounts = useMemo(() => {
    const counts = {
      all: notifications.length,
      unread: 0,
      appointments: 0,
      reminders: 0,
      system: 0,
    };

    notifications.forEach((n) => {
      if (!n.isRead) counts.unread += 1;
      counts[getNotificationCategory(n.type)] += 1;
    });

    return counts;
  }, [notifications]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoadingState message="Loading notifications..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageErrorState message={error} onRetry={fetchNotifications} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <PageHeader
          title="Notifications"
          actions={
            hasUnread && notifications.length > 0 ? (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-full transition-colors text-sm text-center leading-tight"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All as Read
              </button>
            ) : null
          }
        />

        <div ref={filterBarRef} className="w-full mb-4 md:mb-6">
          <div className="md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search notifications"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "mobileSettings"
                        ? null
                        : "mobileSettings",
                    )
                  }
                  className={`h-9 w-9 rounded-full border inline-flex items-center justify-center transition-colors ${
                    activeFilter !== "all"
                      ? "border-primary-300 bg-primary-50 text-primary-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-label="Open notification filters"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                {openDropdown === "mobileSettings" && (
                  <div className="absolute top-full right-0 mt-2 w-[min(92vw,20rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Filter
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "all", label: "All" },
                        { value: "unread", label: "Unread" },
                        { value: "appointments", label: "Appointments" },
                        { value: "reminders", label: "Reminders" },
                        { value: "system", label: "System" },
                      ].map((filter) => {
                        const isActive = activeFilter === filter.value;
                        return (
                          <button
                            key={filter.value}
                            type="button"
                            onClick={() => handleFilterChange(filter.value)}
                            className={`rounded-lg border px-2 py-1.5 text-xs font-medium text-left transition-colors ${
                              isActive
                                ? "border-primary-300 bg-primary-50 text-primary-700"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {filter.label} ({filterCounts[filter.value]})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
            <div className="relative w-full lg:flex-1 lg:min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:shrink-0">
              {[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread" },
                { value: "appointments", label: "Appointments" },
                { value: "reminders", label: "Reminders" },
                { value: "system", label: "System" },
              ].map((filter) => {
                const isActive = activeFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => handleFilterChange(filter.value)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold text-center leading-tight border transition-colors ${
                      isActive
                        ? "bg-primary-600 border-primary-600 text-white"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {filterCounts[filter.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <PageEmptyState
            icon={Bell}
            title={
              notifications.length === 0
                ? "No notifications"
                : "No notifications in this category"
            }
            description={
              notifications.length === 0
                ? "You're all caught up!"
                : "Try a different filter to see more updates."
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {filteredNotifications.map((notification, index) => {
              const notificationId = getNotificationId(notification);
              const notificationTimestamp =
                getNotificationTimestamp(notification);

              return (
                <div
                  key={
                    notificationId ??
                    `${notification.type || "notification"}-${notificationTimestamp || "time-unknown"}-${index}`
                  }
                  className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${!notification.isRead ? "bg-primary-50" : "hover:bg-gray-50"}`}
                >
                  <div className="text-2xl flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {notification.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {notification.message}
                    </p>

                    {isInProgressQueueNotification(notification) &&
                      notification.relatedEntityId &&
                      notification.appointmentType === "ONLINE" &&
                      isPatientRole(user?.role) && (
                        <button
                          onClick={() => {
                            navigate(
                              `/patient/telemedicine?appointmentId=${notification.relatedEntityId}`,
                            );
                          }}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full text-center leading-tight hover:bg-primary-700 transition-colors"
                        >
                          🎥 Join Consultation
                        </button>
                      )}

                    {notification.type === "WEIGHT_MONTHLY_REMINDER" && (
                      <button
                        onClick={() => {
                          navigate(
                            "/profile?section=medical&edit=1&focus=weight",
                          );
                        }}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full text-center leading-tight hover:bg-primary-700 transition-colors"
                      >
                        Update Weight
                      </button>
                    )}

                    {(notification.type === "REVIEW_REQUEST" ||
                      notification.type === "APPOINTMENT_COMPLETED") &&
                      notification.relatedEntityType === "APPOINTMENT" &&
                      notification.relatedEntityId &&
                      String(user?.role || "").toUpperCase() === "PATIENT" && (
                        <button
                          onClick={() =>
                            handleOpenRatingFromNotification(notification)
                          }
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded-full text-center leading-tight hover:bg-amber-700 transition-colors"
                        >
                          Rate Now
                        </button>
                      )}

                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(notificationTimestamp)}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    {!notification.isRead && notificationId ? (
                      <button
                        onClick={() => handleMarkAsRead(notificationId)}
                        className="p-1.5 text-primary-600 hover:bg-primary-100 rounded-full transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="p-1.5 text-gray-300">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
