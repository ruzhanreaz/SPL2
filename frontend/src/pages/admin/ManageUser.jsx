import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { adminAPI, doctorAPI } from "../../utils/api";
import {
  UserCog,
  UserPlus,
  X,
  SlidersHorizontal,
  MoreVertical,
} from "lucide-react";
import { useToast } from "../../components/ToastProvider";
import { adminUi } from "../../constants/adminUi";

const ROLE_ORDER = ["ADMIN", "DOCTOR", "ASSISTANT", "PATIENT"];

const isValidPhoneNumber = (phoneNumber) => {
  const cleanedPhone = phoneNumber.replace(/[\s()-]/g, "");
  return /^\+?[1-9]\d{6,14}$/.test(cleanedPhone);
};

const getRouteMode = (pathname) => {
  if (
    pathname.endsWith("/users/add-doctor") ||
    pathname.endsWith("/doctors/add")
  ) {
    return "add-doctor";
  }
  if (
    pathname.endsWith("/users/add-admin") ||
    pathname.endsWith("/add-admin")
  ) {
    return "add-admin";
  }
  return "list";
};

const initialDoctorForm = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  specialization: "",
  yearOfExperience: "",
  location: "",
  consultationFee: "",
  qualifications: "",
  languages: "",
  hospitalAffiliation: "",
  about: "",
};

const initialAdminForm = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
};

export default function ManageUser({ initialSubpage = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doctorForm, setDoctorForm] = useState(initialDoctorForm);
  const [adminForm, setAdminForm] = useState(initialAdminForm);
  const [openDropdown, setOpenDropdown] = useState(null);

  const routeMode = useMemo(
    () => getRouteMode(location.pathname),
    [location.pathname],
  );
  const panelMode = routeMode === "list" ? initialSubpage || "list" : routeMode;

  const loadUsers = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await adminAPI.getAllUsers(token);
      setUsers(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const roleMatched =
      roleFilter === "ALL" ? users : users.filter((u) => u.role === roleFilter);
    const q = query.toLowerCase().trim();
    if (!q) return roleMatched;

    return roleMatched.filter(
      (u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [users, roleFilter, query]);

  const roleSummary = useMemo(() => {
    return users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const toggleStatus = async (userId) => {
    try {
      const updated = await adminAPI.toggleUserStatus(userId, token);
      setUsers((prev) => prev.map((u) => (u.userId === userId ? updated : u)));
    } catch (e) {
      setError(e.message || "Failed to update user status");
    }
  };

  const deleteUser = async (user) => {
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const label = fullName || user.email || `User #${user.userId}`;
    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await adminAPI.deleteUser(user.userId, token);
      setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      setError("");
      toast.success("User deleted successfully");
    } catch (e) {
      const message = e.message || "Failed to delete user";
      setError(message);
      toast.error(message);
    }
  };

  const validateForm = (formData) => {
    const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (formData.password !== formData.confirmPassword) {
      throw new Error("Passwords do not match");
    }
    if (!(formData.password || "").trim()) {
      throw new Error("Password is required");
    }
    if (!isValidPhoneNumber(formData.phoneNumber || "")) {
      throw new Error(
        "Phone number must contain 7-15 digits and may optionally start with +",
      );
    }
    if (!emailRegex.test(formData.email || "")) {
      throw new Error("Please enter a valid email address");
    }
  };

  const submitDoctor = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      validateForm(doctorForm);
      const { confirmPassword: _confirmPassword, ...doctorData } = doctorForm;
      doctorData.yearOfExperience = doctorData.yearOfExperience
        ? Number(doctorData.yearOfExperience)
        : null;
      doctorData.consultationFee = doctorData.consultationFee
        ? Number(doctorData.consultationFee)
        : null;
      await doctorAPI.addDoctor(doctorData, token);
      toast.success("Doctor account created successfully");
      setDoctorForm(initialDoctorForm);
      await loadUsers();
      navigate("/admin/users");
    } catch (e2) {
      const message = e2.message || "Failed to create doctor account";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      validateForm(adminForm);
      const { confirmPassword: _confirmPassword, ...adminData } = adminForm;
      await adminAPI.createAdmin(adminData, token);
      toast.success("Admin account created successfully");
      setAdminForm(initialAdminForm);
      await loadUsers();
      navigate("/admin/users");
    } catch (e2) {
      const message = e2.message || "Failed to create admin account";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeSubpage = () => {
    navigate("/admin/users");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".users-toolbar-dropdown")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 relative">
          <div>
            <h1 className="app-page-title">App Users</h1>
          </div>
        </div>

        <div className="w-full flex items-center gap-2 mb-4 md:mb-6">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className={adminUi.input}
            />
          </div>

          <div className="relative users-toolbar-dropdown shrink-0">
            <button
              type="button"
              onClick={() =>
                setOpenDropdown(
                  openDropdown === "roleFilterMenu" ? null : "roleFilterMenu",
                )
              }
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                roleFilter !== "ALL"
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              aria-label="Open user filters"
              title="Filter users"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {openDropdown === "roleFilterMenu" && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,20rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  User Filters
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter("ALL");
                      setOpenDropdown(null);
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      roleFilter === "ALL"
                        ? "border-primary-300 bg-primary-50 text-primary-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    All Users {users.length}
                  </button>
                  {ROLE_ORDER.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setRoleFilter(role);
                        setOpenDropdown(null);
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        roleFilter === role
                          ? "border-primary-300 bg-primary-50 text-primary-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {role}: {roleSummary[role] || 0}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:flex shrink-0 items-center gap-2">
            <button
              onClick={() => navigate("/admin/users/add-doctor")}
              className={`${adminUi.actionButton} bg-primary-600 text-white hover:bg-primary-700`}
            >
              <UserPlus className="h-4 w-4" />
              Add Doctor
            </button>
            <button
              onClick={() => navigate("/admin/users/add-admin")}
              className={`${adminUi.actionButton} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <UserCog className="h-4 w-4" />
              Add Admin
            </button>
          </div>

          <div className="relative users-toolbar-dropdown md:hidden shrink-0">
            <button
              type="button"
              onClick={() =>
                setOpenDropdown(
                  openDropdown === "mobileActionsMenu"
                    ? null
                    : "mobileActionsMenu",
                )
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50"
              aria-label="Open user actions"
              title="Actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {openDropdown === "mobileActionsMenu" && (
              <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    navigate("/admin/users/add-doctor");
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Doctor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    navigate("/admin/users/add-admin");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <UserCog className="h-4 w-4" />
                  Add Admin
                </button>
              </div>
            )}
          </div>
        </div>

        {panelMode !== "list" && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
            onClick={closeSubpage}
          >
            <div
              className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {panelMode === "add-doctor" ? "Add Doctor" : "Add Admin"}
                  </h2>
                </div>
                <button
                  onClick={closeSubpage}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  aria-label="Close subpage"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-5">
                {panelMode === "add-doctor" ? (
                  <form onSubmit={submitDoctor} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <input
                        value={doctorForm.firstName}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            firstName: e.target.value,
                          }))
                        }
                        required
                        placeholder="First Name"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        value={doctorForm.lastName}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            lastName: e.target.value,
                          }))
                        }
                        required
                        placeholder="Last Name"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        type="email"
                        value={doctorForm.email}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        required
                        placeholder="Email"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        value={doctorForm.phoneNumber}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            phoneNumber: e.target.value,
                          }))
                        }
                        required
                        placeholder="Phone Number"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        value={doctorForm.specialization}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            specialization: e.target.value,
                          }))
                        }
                        required
                        placeholder="Specialization"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        type="number"
                        min="0"
                        value={doctorForm.yearOfExperience}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            yearOfExperience: e.target.value,
                          }))
                        }
                        placeholder="Years of Experience"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        value={doctorForm.location}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        placeholder="Practice Location"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doctorForm.consultationFee}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            consultationFee: e.target.value,
                          }))
                        }
                        placeholder="Consultation Fee"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        value={doctorForm.qualifications}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            qualifications: e.target.value,
                          }))
                        }
                        placeholder="Qualifications (e.g., MBBS, FCPS)"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 md:col-span-2"
                      />
                      <input
                        value={doctorForm.languages}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            languages: e.target.value,
                          }))
                        }
                        placeholder="Languages (comma separated)"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        value={doctorForm.hospitalAffiliation}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            hospitalAffiliation: e.target.value,
                          }))
                        }
                        placeholder="Hospital Affiliation"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <textarea
                        value={doctorForm.about}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            about: e.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="About Doctor"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 md:col-span-2"
                      />
                      <input
                        type="password"
                        value={doctorForm.password}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        required
                        minLength={8}
                        placeholder="Password (min 8 chars)"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                      <input
                        type="password"
                        value={doctorForm.confirmPassword}
                        onChange={(e) =>
                          setDoctorForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                        minLength={8}
                        placeholder="Confirm Password"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 md:col-span-2"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {submitting ? "Creating..." : "Create Doctor"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDoctorForm(initialDoctorForm)}
                        className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={submitAdmin} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <input
                        value={adminForm.firstName}
                        onChange={(e) =>
                          setAdminForm((prev) => ({
                            ...prev,
                            firstName: e.target.value,
                          }))
                        }
                        required
                        placeholder="First Name"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        value={adminForm.lastName}
                        onChange={(e) =>
                          setAdminForm((prev) => ({
                            ...prev,
                            lastName: e.target.value,
                          }))
                        }
                        required
                        placeholder="Last Name"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="email"
                        value={adminForm.email}
                        onChange={(e) =>
                          setAdminForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        required
                        placeholder="Email"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        value={adminForm.phoneNumber}
                        onChange={(e) =>
                          setAdminForm((prev) => ({
                            ...prev,
                            phoneNumber: e.target.value,
                          }))
                        }
                        required
                        placeholder="Phone Number"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="password"
                        value={adminForm.password}
                        onChange={(e) =>
                          setAdminForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        required
                        minLength={8}
                        placeholder="Password (min 8 chars)"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="password"
                        value={adminForm.confirmPassword}
                        onChange={(e) =>
                          setAdminForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                        minLength={8}
                        placeholder="Confirm Password"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {submitting ? "Creating..." : "Create Admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminForm(initialAdminForm)}
                        className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading users...</div>
          </div>
        ) : (
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.userId} className="border-t border-gray-100">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {user.phoneNumber || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {user.role}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStatus(user.userId)}
                          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Toggle Status
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No users found for the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="md:hidden space-y-3">
            {visibleUsers.length > 0 ? (
              visibleUsers.map((user) => (
                <div
                  key={user.userId}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {user.email}
                      </div>
                      <div className="text-sm text-gray-600">
                        {user.phoneNumber || "-"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        user.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                      {user.role}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(user.userId)}
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Toggle Status
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
                No users found for the current filter.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
