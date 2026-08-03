import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Trash2,
  Power,
  UserPlus,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from "lucide-react";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { doctorAssistantAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";

const MyAssistants = () => {
  const toast = useToast();
  const { showConfirm, ConfirmDialog } = useConfirm();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [assistants, setAssistants] = useState([]);
  const [loadingAssistants, setLoadingAssistants] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sortField, setSortField] = useState("lastName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [contextMenu, setContextMenu] = useState({
    id: null,
    x: 0,
    y: 0,
    isActive: false,
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  const fetchAssistants = useCallback(async () => {
    try {
      setLoadingAssistants(true);
      const data = await doctorAssistantAPI.getAssistants(token);
      setAssistants(data);
    } catch (err) {
      console.error("Error fetching assistants:", err);
    } finally {
      setLoadingAssistants(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  useEffect(() => {
    const handler = (e) => {
      if (
        !e.target.closest(".actions-menu") &&
        !e.target.closest(".context-menu")
      ) {
        setOpenMenuId(null);
      }
      if (!e.target.closest(".context-menu")) {
        setContextMenu({ id: null, x: 0, y: 0, isActive: false });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear messages when user starts typing
    if (error) setError(null);
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!formData.password) {
      setError("Password is required");
      return;
    }

    // Email validation
    const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      // Prepare data (exclude confirmPassword)
      const assistantData = { ...formData };
      delete assistantData.confirmPassword;

      await doctorAssistantAPI.createAssistant(assistantData, token);

      // Show success message
      toast.success("Assistant account created successfully!");
      setSuccess(true);

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        password: "",
        confirmPassword: "",
      });

      // Refresh assistants list
      fetchAssistants();

      // Hide form
      setShowForm(false);

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.message || "Failed to add assistant. Please try again.");
      console.error("Error adding assistant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    });
    setError(null);
    setSuccess(false);
    setShowForm(false);
  };

  const handleToggleStatus = async (assistantId) => {
    try {
      await doctorAssistantAPI.toggleAssistantStatus(assistantId, token);
      toast.success("Assistant status updated");
      fetchAssistants();
    } catch (err) {
      const msg = err.message || "Failed to update assistant status";
      setError(msg);
      toast.error(msg);
      console.error("Error toggling assistant status:", err);
    }
  };

  const handleDelete = async (assistantId) => {
    showConfirm({
      title: "Delete Assistant",
      message:
        "Are you sure you want to delete this assistant? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await doctorAssistantAPI.deleteAssistant(assistantId, token);

          toast.success("Assistant deleted successfully");
          // Refresh assistants list
          fetchAssistants();
        } catch (err) {
          toast.error(err.message || "Failed to delete assistant");
          console.error("Error deleting assistant:", err);
        }
      },
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const sortedAssistants = [...assistants].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle name sorting
    if (sortField === "name") {
      aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
      bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
    } else if (typeof aValue === "string") {
      aValue = (aValue || "").toLowerCase();
      bValue = (bValue || "").toLowerCase();
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <DashboardLayout>
      <div className="w-full">
        {/* Header with Add Button */}
        <div className="flex items-center justify-between gap-3 mb-4 md:mb-6 relative">
          <h1 className="app-page-title">My Assistants</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Assistant account created successfully!</span>
          </div>
        )}

        {/* Add Assistant Form (Collapsible) */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <div
              className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Add Assistant
                  </h2>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  aria-label="Close add assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      placeholder="First Name"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      placeholder="Last Name"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                    <input
                      type="email"
                      name="email"
                      pattern="[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
                      title="Please enter a valid email address"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="Email"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      required
                      placeholder="Phone Number"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      placeholder="Password (min 8 chars)"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      minLength={8}
                      placeholder="Confirm Password"
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? "Creating..." : "Create Assistant"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Assistants List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {loadingAssistants ? (
            <div className="text-center py-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-gray-600 mt-2">Loading assistants...</p>
            </div>
          ) : assistants.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              No assistants added yet. Click the "Add Assistant" button above to
              add your first assistant.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto max-h-[560px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Name {getSortIcon("name")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort("email")}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Email {getSortIcon("email")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort("isActive")}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Status {getSortIcon("isActive")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedAssistants.map((assistant) => (
                      <tr
                        key={assistant.assistantId}
                        className="hover:bg-gray-50 select-none"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            id: assistant.assistantId,
                            x: e.clientX,
                            y: e.clientY,
                            isActive: assistant.isActive,
                          });
                        }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {assistant.firstName} {assistant.lastName}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {assistant.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {assistant.phoneNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              assistant.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {assistant.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                          <div className="actions-menu inline-block">
                            <button
                              onClick={(e) => {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setMenuPos({
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
                                setOpenMenuId(
                                  openMenuId === assistant.assistantId
                                    ? null
                                    : assistant.assistantId,
                                );
                              }}
                              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {sortedAssistants.map((assistant) => (
                  <div
                    key={assistant.assistantId}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {assistant.firstName} {assistant.lastName}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          {assistant.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {assistant.phoneNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${
                            assistant.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {assistant.isActive ? "Active" : "Inactive"}
                        </span>
                        <div className="actions-menu">
                          <button
                            onClick={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setMenuPos({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              });
                              setOpenMenuId(
                                openMenuId === assistant.assistantId
                                  ? null
                                  : assistant.assistantId,
                              );
                            }}
                            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {openMenuId !== null && (
        <div
          className="actions-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {(() => {
            const asst = assistants.find((a) => a.assistantId === openMenuId);
            if (!asst) return null;
            return (
              <>
                <button
                  onClick={() => {
                    handleToggleStatus(asst.assistantId);
                    setOpenMenuId(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-t-lg ${asst.isActive ? "text-orange-600" : "text-green-600"}`}
                >
                  <Power className="w-4 h-4" />
                  {asst.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    handleDelete(asst.assistantId);
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            );
          })()}
        </div>
      )}
      {contextMenu.id !== null && (
        <div
          className="context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              handleToggleStatus(contextMenu.id);
              setContextMenu({ id: null, x: 0, y: 0, isActive: false });
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-t-lg ${contextMenu.isActive ? "text-orange-600" : "text-green-600"}`}
          >
            <Power className="w-4 h-4" />
            {contextMenu.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => {
              handleDelete(contextMenu.id);
              setContextMenu({ id: null, x: 0, y: 0, isActive: false });
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
      <button
        onClick={() => setShowForm(!showForm)}
        className={`fixed z-40 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
          showForm
            ? "bg-gray-600 hover:bg-gray-700"
            : "bg-primary-600 hover:bg-primary-700"
        }`}
        style={{
          bottom: "max(1.5rem, env(safe-area-inset-bottom))",
          right: "max(1.5rem, env(safe-area-inset-right))",
        }}
        aria-label={showForm ? "Cancel add assistant" : "Add assistant"}
      >
        <UserPlus className="h-4 w-4" />
        <span>{showForm ? "Cancel" : "Add Assistant"}</span>
      </button>
      <ConfirmDialog />
    </DashboardLayout>
  );
};

export default MyAssistants;
