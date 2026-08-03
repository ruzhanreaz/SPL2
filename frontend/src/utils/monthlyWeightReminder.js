const MONTHLY_WEIGHT_REMINDER_TYPE = "WEIGHT_MONTHLY_REMINDER";

const isPatientUser = (user) =>
  String(user?.role || "").toUpperCase() === "PATIENT";

const getUserId = (user) => user?.patientId || user?.userId || user?.id || null;

const getMonthToken = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getReminderStorageKey = (userId, monthToken) =>
  `vb.weight-reminder.read.${userId}.${monthToken}`;

const getReminderId = (userId, monthToken) =>
  `weight-reminder-${userId}-${monthToken}`;

const isReminderRead = (userId, monthToken) => {
  try {
    return (
      localStorage.getItem(getReminderStorageKey(userId, monthToken)) === "1"
    );
  } catch {
    return false;
  }
};

export const markMonthlyWeightReminderAsRead = (user, date = new Date()) => {
  const userId = getUserId(user);
  if (!isPatientUser(user) || !userId) return;

  const monthToken = getMonthToken(date);
  try {
    localStorage.setItem(getReminderStorageKey(userId, monthToken), "1");
  } catch {
    // Ignore storage errors and continue without blocking the UI.
  }
};

export const getMonthlyWeightReminderNotification = (
  user,
  date = new Date(),
) => {
  const userId = getUserId(user);
  if (!isPatientUser(user) || !userId) return null;

  const monthToken = getMonthToken(date);
  const read = isReminderRead(userId, monthToken);
  const reminderId = getReminderId(userId, monthToken);

  return {
    notificationId: reminderId,
    id: reminderId,
    type: MONTHLY_WEIGHT_REMINDER_TYPE,
    title: "Monthly weight check-in",
    message:
      "Please review and update your weight in Profile if it has changed this month.",
    isRead: read,
    createdAt: `${monthToken}-01T00:00:00.000Z`,
  };
};

const getNotificationTimestampMs = (notification) => {
  const raw = notification?.createdAt ?? notification?.timestamp;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const mergeNotificationsWithMonthlyWeightReminder = (
  notifications,
  user,
) => {
  const list = Array.isArray(notifications) ? notifications : [];
  const reminder = getMonthlyWeightReminderNotification(user);

  const withoutReminder = list.filter((item) => {
    const itemId = item?.notificationId ?? item?.id;
    return itemId !== reminder?.notificationId;
  });

  const merged = reminder ? [...withoutReminder, reminder] : withoutReminder;

  return merged.sort(
    (a, b) => getNotificationTimestampMs(b) - getNotificationTimestampMs(a),
  );
};

export const getMonthlyWeightReminderUnreadCount = (user) => {
  const reminder = getMonthlyWeightReminderNotification(user);
  return reminder && !reminder.isRead ? 1 : 0;
};

export const isMonthlyWeightReminder = (notification) =>
  String(notification?.type || "") === MONTHLY_WEIGHT_REMINDER_TYPE;
