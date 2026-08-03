const CANDIDATE_FIELDS = [
  "profileImageUrl",
  "profileImage",
  "avatarUrl",
  "avatar",
  "imageUrl",
  "photoUrl",
];

export const resolveProfileImageUrl = (record) => {
  if (!record || typeof record !== "object") return "";

  for (const field of CANDIDATE_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

export const getProfileInitials = (record, fallback = "U") => {
  if (!record || typeof record !== "object") return fallback;

  const firstName = (record.firstName || "").trim();
  const lastName = (record.lastName || "").trim();

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  if (initials) {
    return initials;
  }

  const fullName = (record.fullName || record.name || "").trim();
  if (fullName) {
    return fullName.charAt(0).toUpperCase();
  }

  return fallback;
};
