import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  FileText,
  Upload,
  Search,
  Trash2,
  Download,
  Eye,
  X,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
  SlidersHorizontal,
  MoreVertical,
  HardDrive,
  RefreshCw,
  PenSquare,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { appointmentAPI, documentAPI, labAnalyticsAPI } from "../../utils/api";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthProvider";

const MyDocuments = () => {
  const toast = useToast();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const patientId = user?.patientId || user?.userId || user?.id || "";
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [peopleFilter, setPeopleFilter] = useState("anyone");
  const [modifiedFilter, setModifiedFilter] = useState("any");
  const [issuedFilter, setIssuedFilter] = useState("any");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [customIssuedDateFrom, setCustomIssuedDateFrom] = useState("");
  const [customIssuedDateTo, setCustomIssuedDateTo] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const filterBarRef = useRef(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState("REPORT");
  const [documentName, setDocumentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [issuedAt, setIssuedAt] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    documentId: null,
  });
  const [editModal, setEditModal] = useState({
    show: false,
    mode: "rename",
    document: null,
    documentName: "",
    issuedAt: "",
  });
  const [deleting, setDeleting] = useState(false);
  const [updatingDocument, setUpdatingDocument] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("uploadedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [contextMenu, setContextMenu] = useState({ id: null, x: 0, y: 0 });
  const uploadInputRef = useRef(null);
  const [showStoragePanel, setShowStoragePanel] = useState(false);
  const [storageInfo, setStorageInfo] = useState({
    usedBytes: 0,
    totalBytes: 0,
    remainingBytes: 0,
    usagePercentage: 0,
    documentCount: 0,
    reportUsedBytes: 0,
    reportCount: 0,
    prescriptionUsedBytes: 0,
    prescriptionCount: 0,
  });
  const [storageLoading, setStorageLoading] = useState(true);
  const [accessList, setAccessList] = useState([]);
  const [accessLoading, setAccessLoading] = useState(true);
  const [revokingAccessId, setRevokingAccessId] = useState(null);
  const [activeSubpage, setActiveSubpage] = useState("documents");

  const getDateRangeForFilter = useCallback((filterValue, from, to) => {
    if (filterValue === "7days" || filterValue === "30days") {
      const now = new Date();
      const days = filterValue === "7days" ? 7 : 30;
      const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return {
        from: fromDate.toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      };
    }

    if (filterValue === "custom") {
      return {
        from: from || null,
        to: to || null,
      };
    }

    return { from: null, to: null };
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!token) {
      setDocuments([]);
      setError("Authentication required. Please login.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const uploadedRange = getDateRangeForFilter(
        modifiedFilter,
        customDateFrom,
        customDateTo,
      );
      const issuedRange = getDateRangeForFilter(
        issuedFilter,
        customIssuedDateFrom,
        customIssuedDateTo,
      );

      const response = await documentAPI.getDocumentsQuery(
        {
          documentType: typeFilter,
          q: debouncedSearchQuery.trim() || null,
          uploadedFrom: uploadedRange.from,
          uploadedTo: uploadedRange.to,
          issuedFrom: issuedRange.from,
          issuedTo: issuedRange.to,
          sortField,
          sortOrder,
          page,
          size: pageSize,
        },
        token,
      );

      setDocuments(response?.items || []);
      setTotalElements(response?.totalElements || 0);
      setTotalPages(response?.totalPages || 0);
      setPage(response?.page ?? 0);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [
    token,
    typeFilter,
    modifiedFilter,
    issuedFilter,
    customDateFrom,
    customDateTo,
    customIssuedDateFrom,
    customIssuedDateTo,
    debouncedSearchQuery,
    sortField,
    sortOrder,
    page,
    pageSize,
    getDateRangeForFilter,
  ]);

  const fetchStorageInfo = useCallback(async () => {
    if (!token) {
      setStorageInfo({
        usedBytes: 0,
        totalBytes: 0,
        remainingBytes: 0,
        usagePercentage: 0,
        documentCount: 0,
        reportUsedBytes: 0,
        reportCount: 0,
        prescriptionUsedBytes: 0,
        prescriptionCount: 0,
      });
      setStorageLoading(false);
      return;
    }

    try {
      setStorageLoading(true);
      const info = await documentAPI.getStorageInfo(token);
      setStorageInfo(info);
    } catch (err) {
      console.error("Error fetching storage info:", err);
    } finally {
      setStorageLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(0);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  // Fetch documents + storage data for current query
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setStorageLoading(false);
      return;
    }

    fetchDocuments();
  }, [token, fetchDocuments]);

  useEffect(() => {
    if (!token) return;
    fetchStorageInfo();
  }, [token, fetchStorageInfo]);

  const refreshDocumentAccessList = useCallback(async () => {
    if (!token) {
      setAccessList([]);
      setAccessLoading(false);
      return;
    }

    try {
      setAccessLoading(true);
      const list = await appointmentAPI.getPatientDocumentAccessList(token);
      const normalized = Array.isArray(list) ? list : [];
      setAccessList(normalized);

      const hasActive = normalized.some((item) => item?.active);
      if (hasActive) {
        window.localStorage.setItem("patientDocAccessAttention", "1");
      } else {
        window.localStorage.removeItem("patientDocAccessAttention");
      }
      window.dispatchEvent(new Event("patient-doc-access-updated"));
    } catch (err) {
      console.error("Error loading document access list:", err);
      setAccessList([]);
    } finally {
      setAccessLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshDocumentAccessList();
  }, [refreshDocumentAccessList]);

  const handleRevokeAccess = async (appointmentId) => {
    try {
      setRevokingAccessId(appointmentId);
      await appointmentAPI.revokeDocumentAccess(appointmentId, token);
      toast.success("Document access removed");
      await refreshDocumentAccessList();
    } catch (err) {
      toast.error(err.message || "Failed to remove document access");
    } finally {
      setRevokingAccessId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (
        !e.target.closest(".actions-menu") &&
        !e.target.closest(".context-menu")
      ) {
        setOpenMenuId(null);
      }
      if (!e.target.closest(".context-menu")) {
        setContextMenu({ id: null, x: 0, y: 0 });
      }
      if (
        !e.target.closest(".storage-panel") &&
        !e.target.closest(".storage-toggle")
      ) {
        setShowStoragePanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(0);
  };

  useEffect(() => {
    setPage(0);
  }, [
    typeFilter,
    modifiedFilter,
    issuedFilter,
    customDateFrom,
    customDateTo,
    customIssuedDateFrom,
    customIssuedDateTo,
    pageSize,
  ]);

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const visibleDocuments = useMemo(() => {
    if (peopleFilter === "me") {
      return documents.filter((doc) => !doc.uploadedBy);
    }
    if (peopleFilter !== "anyone") {
      return documents.filter((doc) => doc.uploadedBy === peopleFilter);
    }
    return documents;
  }, [documents, peopleFilter]);

  const processSelectedFile = (file, clearInput) => {
    if (!file) return;

    if (storageInfo.totalBytes > 0 && storageInfo.remainingBytes <= 0) {
      toast.error("Storage is full. Delete some files before uploading.");
      if (clearInput) clearInput();
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      if (clearInput) clearInput();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      toast.error("File size must be less than 10MB");
      if (clearInput) clearInput();
      return;
    }

    if (storageInfo.totalBytes > 0 && file.size > storageInfo.remainingBytes) {
      toast.error(
        `Not enough storage available. You have ${formatBytes(storageInfo.remainingBytes)} left.`,
      );
      if (clearInput) clearInput();
      return;
    }

    setSelectedFile(file);
    // Auto-fill name from filename (strip .pdf extension for cleaner editing)
    const baseName = file.name.toLowerCase().endsWith(".pdf")
      ? file.name.slice(0, -4)
      : file.name;
    setDocumentName(baseName);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    processSelectedFile(file, () => {
      e.target.value = "";
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    processSelectedFile(file);
  };

  const handleUpload = async () => {
    if (storageInfo.totalBytes > 0 && storageInfo.remainingBytes <= 0) {
      toast.error("Storage is full. Delete some files before uploading.");
      return;
    }

    if (!documentName.trim()) {
      toast.warning("Please enter a document name");
      return;
    }
    if (!selectedFile) {
      toast.warning("Please select a file");
      return;
    }

    if (
      storageInfo.totalBytes > 0 &&
      selectedFile.size > storageInfo.remainingBytes
    ) {
      toast.error(
        `Not enough storage available. You have ${formatBytes(storageInfo.remainingBytes)} left.`,
      );
      return;
    }

    // Client-side duplicate check
    const normalizedName = documentName.trim().toLowerCase().endsWith(".pdf")
      ? documentName.trim()
      : documentName.trim() + ".pdf";
    const isDuplicate = documents.some(
      (doc) => doc.fileName.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(
        `A document named "${normalizedName}" already exists. Please choose a different name.`,
      );
      return;
    }

    setUploading(true);

    try {
      await documentAPI.uploadDocument(
        selectedFile,
        uploadType,
        documentName,
        token,
        issuedAt || null,
      );

      if (uploadType === "REPORT" && patientId) {
        try {
          await labAnalyticsAPI.uploadReport(
            patientId,
            selectedFile,
            issuedAt || null,
          );
        } catch (analysisErr) {
          console.error("Report auto-analysis failed:", analysisErr);
          toast.warning(
            "Document uploaded, but automatic health analysis failed. You can retry from Health Analysis.",
          );
        }
      }

      // Refresh documents list
      setPage(0);
      await fetchDocuments();
      await fetchStorageInfo();

      resetUploadForm();
      if (uploadType === "REPORT" && patientId) {
        toast.success("Report uploaded and analyzed successfully!");
      } else {
        toast.success("Document uploaded successfully!");
      }
    } catch (err) {
      console.error("Error uploading document:", err);
      toast.error(
        err.message || "Failed to upload document. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      await documentAPI.deleteDocument(deleteModal.documentId, token);

      // Refresh documents list
      if (visibleDocuments.length === 1 && page > 0) {
        setPage((prev) => Math.max(prev - 1, 0));
      } else {
        await fetchDocuments();
      }
      await fetchStorageInfo();

      setDeleteModal({ show: false, documentId: null });
      toast.success("Document deleted successfully!");
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error(
        err.message || "Failed to delete document. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const result = await documentAPI.getDocumentContent(documentId, token, {
        download: true,
      });
      const fileName = result.fileName || `document_${documentId}`;
      const normalizedType = normalizeMimeType(result.contentType, fileName);
      const blob = new Blob([result.blob], { type: normalizedType });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading document:", err);
      toast.error(
        err.message || "Failed to download document. Please try again.",
      );
    }
  };

  const handleView = async (documentId) => {
    try {
      const result = await documentAPI.getDocumentContent(documentId, token, {
        download: false,
      });
      const normalizedType = normalizeMimeType(
        result.contentType,
        result.fileName,
      );
      const blob = new Blob([result.blob], { type: normalizedType });
      const objectUrl = window.URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 300000);
    } catch (err) {
      console.error("Error opening document:", err);
      toast.error(err.message || "Failed to open document. Please try again.");
    }
  };

  const normalizeMimeType = (mimeType, fileName) => {
    const normalized = (mimeType || "").toLowerCase();
    if (
      normalized &&
      normalized !== "application/octet-stream" &&
      normalized !== "application/download"
    ) {
      return mimeType;
    }

    const lowerName = (fileName || "").toLowerCase();
    if (lowerName.endsWith(".pdf")) {
      return "application/pdf";
    }

    return "application/octet-stream";
  };

  const handleUseForHealthAnalysis = (doc) => {
    if (!doc) return;

    if (doc.documentType !== "REPORT") {
      toast.info("Only report documents can be used for Health Analysis");
      return;
    }

    navigate("/patient/health-analysis", {
      state: {
        openSelectReportModal: true,
        reportDocumentId: doc.documentId,
      },
    });
  };

  const toDateInputValue = (dateValue) => {
    if (!dateValue) return "";
    const raw = String(dateValue);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  };

  const toDocumentNameInputValue = (fileName) => {
    if (!fileName) return "";
    return fileName.toLowerCase().endsWith(".pdf")
      ? fileName.slice(0, -4)
      : fileName;
  };

  const openDocumentEditModal = (doc, mode) => {
    if (!doc) return;
    setEditModal({
      show: true,
      mode,
      document: doc,
      documentName: toDocumentNameInputValue(doc.fileName),
      issuedAt: toDateInputValue(doc.issuedAt),
    });
  };

  const closeDocumentEditModal = () => {
    if (updatingDocument) return;
    setEditModal({
      show: false,
      mode: "rename",
      document: null,
      documentName: "",
      issuedAt: "",
    });
  };

  const handleSaveDocumentEdit = async () => {
    const doc = editModal.document;
    if (!doc?.documentId) return;

    const payload = {};

    if (editModal.mode === "rename") {
      if (!editModal.documentName.trim()) {
        toast.warning("Please enter a document name");
        return;
      }
      payload.documentName = editModal.documentName.trim();
    }

    if (editModal.mode === "issuedAt") {
      payload.issuedAt = editModal.issuedAt || "";
    }

    try {
      setUpdatingDocument(true);
      await documentAPI.updateDocumentMetadata(doc.documentId, payload, token);
      await fetchDocuments();
      closeDocumentEditModal();
      toast.success(
        editModal.mode === "rename"
          ? "Document renamed successfully"
          : "Issued date updated successfully",
      );
    } catch (err) {
      console.error("Error updating document metadata:", err);
      toast.error(err.message || "Failed to update document");
    } finally {
      setUpdatingDocument(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getActiveDateFilterLabel = (filterValue, from, to, fallbackLabel) => {
    if (filterValue === "any") return fallbackLabel;
    if (filterValue === "7days") return "Last 7 days";
    if (filterValue === "30days") return "Last 30 days";
    if (filterValue === "custom") {
      if (from && to) return `${from} to ${to}`;
      if (from) return `From ${from}`;
      if (to) return `Until ${to}`;
      return "Custom range";
    }
    return fallbackLabel;
  };

  const uniqueDoctors = [
    ...new Set(
      documents.filter((doc) => doc.uploadedBy).map((doc) => doc.uploadedBy),
    ),
  ];

  const formatBytes = (bytes) => {
    const safeBytes = Number(bytes) || 0;
    if (safeBytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(safeBytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = safeBytes / 1024 ** unitIndex;
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const isStorageFull =
    storageInfo.totalBytes > 0 && storageInfo.remainingBytes <= 0;
  const isNearLimit = storageInfo.usagePercentage >= 80;
  const isCriticalLimit = storageInfo.usagePercentage >= 90;
  const hasActiveDocumentAccess = accessList.some((item) => item?.active);
  const accessButtonClasses = hasActiveDocumentAccess
    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
    : "border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100";

  function resetUploadForm() {
    setIssuedAt("");
    setUploadModal(false);
    setSelectedFile(null);
    setDocumentName("");
    setUploadType("REPORT");
  }

  const renderDocumentActions = (doc, onClose) => (
    <>
      <button
        onClick={() => {
          handleView(doc.documentId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
      >
        <Eye className="w-4 h-4" />
        View
      </button>
      <button
        onClick={() => {
          openDocumentEditModal(doc, "rename");
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <PenSquare className="w-4 h-4" />
        Rename
      </button>
      <button
        onClick={() => {
          openDocumentEditModal(doc, "issuedAt");
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
      >
        <CalendarDays className="w-4 h-4" />
        Edit Issued Date
      </button>
      <button
        onClick={() => {
          handleDownload(doc.documentId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
      {doc.documentType === "REPORT" && (
        <button
          onClick={() => {
            handleUseForHealthAnalysis(doc);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Use for Health Analysis
        </button>
      )}
      <button
        onClick={() => {
          setDeleteModal({ show: true, documentId: doc.documentId });
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </>
  );

  return (
    <DashboardLayout>
      <div className="relative">
        {/* Header */}
        <div className="mb-4 md:mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="app-page-title">
              {activeSubpage === "access"
                ? "My Document Access"
                : "My Documents"}
            </h1>
          </div>

          <div className="flex flex-col items-end gap-2"></div>
        </div>

        {activeSubpage === "access" ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="flex max-h-[min(82vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Doctor Document Access
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Review active access grants and revoke them when needed.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshDocumentAccessList}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    aria-label="Refresh document access"
                    title="Refresh document access"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubpage("documents")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    aria-label="Close document access"
                    title="Close document access"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {accessLoading ? (
                  <p className="text-xs text-gray-500">
                    Loading access records...
                  </p>
                ) : accessList.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No active or recent document access grants.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {accessList.map((access) => (
                      <div
                        key={`${access.grantId}-${access.appointmentId}`}
                        className={`rounded-lg border p-3 ${
                          access.active
                            ? "border-red-200 bg-red-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Dr. {access.doctorName || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-600">
                              Appointment #{access.appointmentId} •{" "}
                              {access.appointmentDate || "N/A"} •{" "}
                              {access.appointmentStatus || "N/A"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {access.active
                                ? `Access active${access.expiresAt ? ` until ${new Date(access.expiresAt).toLocaleString()}` : " until consultation ends"}`
                                : `Access ended${access.revokedAt ? ` at ${new Date(access.revokedAt).toLocaleString()}` : ""}`}
                            </p>
                          </div>
                          {access.active && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRevokeAccess(access.appointmentId)
                              }
                              disabled={
                                revokingAccessId === access.appointmentId
                              }
                              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {revokingAccessId === access.appointmentId
                                ? "Removing..."
                                : "Remove Access"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Loading documents...</div>
              </div>
            ) : (
              <>
                {/* Filter Bar */}
                <div ref={filterBarRef} className="w-full mb-4 md:mb-6">
                  {/* Mobile: single-row toolbar */}
                  <div className="md:hidden">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search documents"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
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
                            sortField !== "uploadedAt" ||
                            sortOrder !== "desc" ||
                            typeFilter !== "ALL" ||
                            peopleFilter !== "anyone" ||
                            modifiedFilter !== "any" ||
                            issuedFilter !== "any"
                              ? "border-primary-300 bg-primary-50 text-primary-700"
                              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          aria-label="Open sorting and filter settings"
                          title="Sort & filters"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>

                        {openDropdown === "mobileSettings" && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-2 w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">
                                Sort
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={sortField}
                                  onChange={(e) => {
                                    setSortField(e.target.value);
                                    setPage(0);
                                  }}
                                  className="col-span-2 border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="uploadedAt">
                                    Uploaded Date
                                  </option>
                                  <option value="issuedAt">Issued Date</option>
                                  <option value="fileName">Title</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSortOrder("asc");
                                    setPage(0);
                                  }}
                                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                    sortOrder === "asc"
                                      ? "border-primary-300 bg-primary-50 text-primary-700"
                                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                  }`}
                                >
                                  Ascending
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSortOrder("desc");
                                    setPage(0);
                                  }}
                                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                    sortOrder === "desc"
                                      ? "border-primary-300 bg-primary-50 text-primary-700"
                                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                                  }`}
                                >
                                  Descending
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">
                                Filters
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={typeFilter}
                                  onChange={(e) =>
                                    setTypeFilter(e.target.value)
                                  }
                                  className="border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="ALL">Any type</option>
                                  <option value="REPORT">Report</option>
                                  <option value="PRESCRIPTION">
                                    Prescription
                                  </option>
                                </select>

                                <select
                                  value={peopleFilter}
                                  onChange={(e) =>
                                    setPeopleFilter(e.target.value)
                                  }
                                  className="border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="anyone">Anyone</option>
                                  <option value="me">Me</option>
                                  {uniqueDoctors.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={modifiedFilter}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setModifiedFilter(value);
                                    if (value !== "custom") {
                                      setCustomDateFrom("");
                                      setCustomDateTo("");
                                    }
                                  }}
                                  className="border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="any">
                                    Uploaded: Any time
                                  </option>
                                  <option value="7days">
                                    Uploaded: Last 7 days
                                  </option>
                                  <option value="30days">
                                    Uploaded: Last 30 days
                                  </option>
                                  <option value="custom">
                                    Uploaded: Custom
                                  </option>
                                </select>

                                <select
                                  value={issuedFilter}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setIssuedFilter(value);
                                    if (value !== "custom") {
                                      setCustomIssuedDateFrom("");
                                      setCustomIssuedDateTo("");
                                    }
                                  }}
                                  className="border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="any">Issued: Any time</option>
                                  <option value="7days">
                                    Issued: Last 7 days
                                  </option>
                                  <option value="30days">
                                    Issued: Last 30 days
                                  </option>
                                  <option value="custom">Issued: Custom</option>
                                </select>
                              </div>
                            </div>

                            {(modifiedFilter === "custom" ||
                              issuedFilter === "custom") && (
                              <div className="space-y-2 border-t border-gray-100 pt-3">
                                {modifiedFilter === "custom" && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      value={customDateFrom}
                                      onChange={(e) =>
                                        setCustomDateFrom(e.target.value)
                                      }
                                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                                      aria-label="Uploaded from date"
                                    />
                                    <input
                                      type="date"
                                      value={customDateTo}
                                      onChange={(e) =>
                                        setCustomDateTo(e.target.value)
                                      }
                                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                                      aria-label="Uploaded to date"
                                    />
                                  </div>
                                )}

                                {issuedFilter === "custom" && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      value={customIssuedDateFrom}
                                      onChange={(e) =>
                                        setCustomIssuedDateFrom(e.target.value)
                                      }
                                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                                      aria-label="Issued from date"
                                    />
                                    <input
                                      type="date"
                                      value={customIssuedDateTo}
                                      onChange={(e) =>
                                        setCustomIssuedDateTo(e.target.value)
                                      }
                                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                                      aria-label="Issued to date"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveSubpage("access")}
                        className={`shrink-0 inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${accessButtonClasses}`}
                      >
                        Access
                      </button>

                      <button
                        onClick={() => setUploadModal(true)}
                        disabled={isStorageFull}
                        className="shrink-0 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold px-3 py-2 rounded-full transition-colors inline-flex items-center justify-center gap-1.5 text-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {isStorageFull ? "Full" : "Upload"}
                      </button>
                    </div>
                  </div>

                  {/* Desktop: original expanded controls */}
                  <div className="hidden md:flex w-full flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                    {/* Search */}
                    <div className="relative w-full lg:flex-1 lg:min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div className="w-full lg:w-auto lg:shrink-0 flex flex-wrap items-center justify-end gap-2">
                      {/* Filter chips */}
                      <div className="flex gap-2 flex-wrap items-center justify-end">
                        {/* Type */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === "type" ? null : "type",
                              )
                            }
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                              typeFilter !== "ALL"
                                ? "bg-primary-50 border-primary-300 text-primary-700"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {typeFilter === "ALL"
                              ? "Type"
                              : typeFilter === "REPORT"
                                ? "Report"
                                : "Prescription"}
                            {typeFilter !== "ALL" ? (
                              <X
                                className="w-3.5 h-3.5 ml-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTypeFilter("ALL");
                                }}
                              />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {openDropdown === "type" && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[150px] py-1">
                              {[
                                { value: "ALL", label: "Any type" },
                                { value: "REPORT", label: "Report" },
                                {
                                  value: "PRESCRIPTION",
                                  label: "Prescription",
                                },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setTypeFilter(opt.value);
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                    typeFilter === opt.value
                                      ? "text-primary-600 font-medium"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {opt.label}
                                  {typeFilter === opt.value && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* People */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === "people" ? null : "people",
                              )
                            }
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                              peopleFilter !== "anyone"
                                ? "bg-primary-50 border-primary-300 text-primary-700"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {peopleFilter === "anyone"
                              ? "People"
                              : peopleFilter === "me"
                                ? "Me"
                                : peopleFilter}
                            {peopleFilter !== "anyone" ? (
                              <X
                                className="w-3.5 h-3.5 ml-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPeopleFilter("anyone");
                                }}
                              />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {openDropdown === "people" && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                              {[
                                { value: "anyone", label: "Anyone" },
                                { value: "me", label: "Me" },
                                ...uniqueDoctors.map((name) => ({
                                  value: name,
                                  label: name,
                                })),
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setPeopleFilter(opt.value);
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                    peopleFilter === opt.value
                                      ? "text-primary-600 font-medium"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {opt.label}
                                  {peopleFilter === opt.value && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Uploaded */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === "modified" ? null : "modified",
                              )
                            }
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                              modifiedFilter !== "any"
                                ? "bg-primary-50 border-primary-300 text-primary-700"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {getActiveDateFilterLabel(
                              modifiedFilter,
                              customDateFrom,
                              customDateTo,
                              "Uploaded",
                            )}
                            {modifiedFilter !== "any" ? (
                              <X
                                className="w-3.5 h-3.5 ml-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModifiedFilter("any");
                                  setCustomDateFrom("");
                                  setCustomDateTo("");
                                }}
                              />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {openDropdown === "modified" && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
                              {[
                                { value: "any", label: "Any time" },
                                { value: "7days", label: "Last 7 days" },
                                { value: "30days", label: "Last 30 days" },
                                { value: "custom", label: "Custom range" },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setModifiedFilter(opt.value);
                                    if (opt.value !== "custom")
                                      setOpenDropdown(null);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                    modifiedFilter === opt.value
                                      ? "text-primary-600 font-medium"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {opt.label}
                                  {modifiedFilter === opt.value && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ))}
                              {modifiedFilter === "custom" && (
                                <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                      From
                                    </label>
                                    <input
                                      type="date"
                                      value={customDateFrom}
                                      onChange={(e) =>
                                        setCustomDateFrom(e.target.value)
                                      }
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                      To
                                    </label>
                                    <input
                                      type="date"
                                      value={customDateTo}
                                      onChange={(e) =>
                                        setCustomDateTo(e.target.value)
                                      }
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Issued */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === "issued" ? null : "issued",
                              )
                            }
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                              issuedFilter !== "any"
                                ? "bg-primary-50 border-primary-300 text-primary-700"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {getActiveDateFilterLabel(
                              issuedFilter,
                              customIssuedDateFrom,
                              customIssuedDateTo,
                              "Issued",
                            )}
                            {issuedFilter !== "any" ? (
                              <X
                                className="w-3.5 h-3.5 ml-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIssuedFilter("any");
                                  setCustomIssuedDateFrom("");
                                  setCustomIssuedDateTo("");
                                }}
                              />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {openDropdown === "issued" && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
                              {[
                                { value: "any", label: "Any time" },
                                { value: "7days", label: "Last 7 days" },
                                { value: "30days", label: "Last 30 days" },
                                { value: "custom", label: "Custom range" },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setIssuedFilter(opt.value);
                                    if (opt.value !== "custom")
                                      setOpenDropdown(null);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                    issuedFilter === opt.value
                                      ? "text-primary-600 font-medium"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {opt.label}
                                  {issuedFilter === opt.value && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ))}
                              {issuedFilter === "custom" && (
                                <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                      From
                                    </label>
                                    <input
                                      type="date"
                                      value={customIssuedDateFrom}
                                      onChange={(e) =>
                                        setCustomIssuedDateFrom(e.target.value)
                                      }
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                      To
                                    </label>
                                    <input
                                      type="date"
                                      value={customIssuedDateTo}
                                      onChange={(e) =>
                                        setCustomIssuedDateTo(e.target.value)
                                      }
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload Button */}
                      <button
                        type="button"
                        onClick={() => setActiveSubpage("access")}
                        className={`shrink-0 inline-flex items-center justify-center rounded-full border px-4 sm:px-5 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${accessButtonClasses}`}
                      >
                        Access
                      </button>

                      <button
                        onClick={() => setUploadModal(true)}
                        disabled={isStorageFull}
                        className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold px-4 sm:px-5 py-2 rounded-full transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        {isStorageFull ? "Storage Full" : "Upload"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Documents Table */}
                <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto max-h-[500px] overflow-y-auto">
                  {visibleDocuments.length === 0 ? (
                    <div className="p-8 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">
                        {searchQuery ||
                        typeFilter !== "ALL" ||
                        peopleFilter !== "anyone" ||
                        modifiedFilter !== "any" ||
                        issuedFilter !== "any"
                          ? "No documents match your filters"
                          : "No documents found"}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort("fileName")}
                              className="flex items-center gap-1 hover:text-gray-700"
                            >
                              Title {getSortIcon("fileName")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Uploaded By
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort("issuedAt")}
                              className="flex items-center gap-1 hover:text-gray-700"
                            >
                              Issued Date {getSortIcon("issuedAt")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort("uploadedAt")}
                              className="flex items-center gap-1 hover:text-gray-700"
                            >
                              Uploaded Date {getSortIcon("uploadedAt")}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {visibleDocuments.map((doc) => (
                          <tr
                            key={doc.documentId}
                            className="hover:bg-gray-50 select-none"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({
                                id: doc.documentId,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                <button
                                  type="button"
                                  onClick={() => handleView(doc.documentId)}
                                  className="text-sm font-medium text-gray-900 hover:text-primary-600 hover:underline text-left"
                                >
                                  {doc.fileName}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  doc.documentType === "REPORT"
                                    ? "bg-primary-100 text-primary-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {doc.documentType}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {doc.uploadedBy || "You"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(doc.issuedAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(doc.uploadedAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
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
                                      openMenuId === doc.documentId
                                        ? null
                                        : doc.documentId,
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
                  )}
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {visibleDocuments.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        {searchQuery ||
                        typeFilter !== "ALL" ||
                        peopleFilter !== "anyone" ||
                        modifiedFilter !== "any" ||
                        issuedFilter !== "any"
                          ? "No documents match your filters"
                          : "No documents found"}
                      </p>
                    </div>
                  ) : (
                    visibleDocuments.map((doc) => (
                      <div
                        key={doc.documentId}
                        className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            id: doc.documentId,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleView(doc.documentId)}
                                className="text-sm font-medium text-gray-900 break-words hover:text-primary-600 hover:underline text-left"
                              >
                                {doc.fileName}
                              </button>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {doc.uploadedBy || "You"} &bull; Uploaded:{" "}
                                {formatDate(doc.uploadedAt)}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Issued: {formatDate(doc.issuedAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                doc.documentType === "REPORT"
                                  ? "bg-primary-100 text-primary-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {doc.documentType}
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
                                    openMenuId === doc.documentId
                                      ? null
                                      : doc.documentId,
                                  );
                                }}
                                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                              >
                                <MoreVertical className="w-5 h-5 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-gray-600">
                      Showing page {page + 1} of {totalPages} ({totalElements}{" "}
                      documents)
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Rows</label>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                      >
                        {[10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                        disabled={page === 0}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((prev) =>
                            Math.min(prev + 1, Math.max(totalPages - 1, 0)),
                          )
                        }
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Upload Document
              </h2>
              <button
                onClick={resetUploadForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {isStorageFull && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Storage is full. Delete some files before uploading new ones.
                </div>
              )}

              {/* Document Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="e.g. Blood Test Results March 2026"
                  disabled={isStorageFull}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  .pdf will be appended automatically if omitted
                </p>
              </div>

              {/* Document Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="REPORT"
                      checked={uploadType === "REPORT"}
                      onChange={(e) => setUploadType(e.target.value)}
                      disabled={isStorageFull}
                      className="mr-2"
                    />
                    <span>Report</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="PRESCRIPTION"
                      checked={uploadType === "PRESCRIPTION"}
                      onChange={(e) => setUploadType(e.target.value)}
                      disabled={isStorageFull}
                      className="mr-2"
                    />
                    <span>Prescription</span>
                  </label>
                </div>
              </div>

              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Issued Date
                </label>
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  disabled={isStorageFull}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The date when the report/prescription was issued (optional)
                </p>
              </div>

              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select PDF File *
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
                    isDragging
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <p className="text-sm text-gray-700">
                    Drag and drop your PDF here
                  </p>
                  <p className="text-xs text-gray-500 my-2">or</p>
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={isStorageFull}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-100 disabled:bg-gray-200 disabled:text-gray-500 rounded-md hover:bg-primary-200 transition-colors"
                  >
                    Browse files
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected: {selectedFile.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Only PDF files, max 10MB
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpload}
                disabled={
                  uploading ||
                  !selectedFile ||
                  !documentName.trim() ||
                  isStorageFull
                }
                className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <button
                onClick={resetUploadForm}
                disabled={uploading}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editModal.mode === "rename"
                  ? "Rename Document"
                  : "Edit Issued Date"}
              </h2>
              <button
                onClick={closeDocumentEditModal}
                disabled={updatingDocument}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {editModal.mode === "rename" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Name
                  </label>
                  <input
                    type="text"
                    value={editModal.documentName}
                    onChange={(e) =>
                      setEditModal((prev) => ({
                        ...prev,
                        documentName: e.target.value,
                      }))
                    }
                    placeholder="Enter a new name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    .pdf will be appended automatically if omitted
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issued Date
                  </label>
                  <input
                    type="date"
                    value={editModal.issuedAt}
                    onChange={(e) =>
                      setEditModal((prev) => ({
                        ...prev,
                        issuedAt: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to clear issued date.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveDocumentEdit}
                disabled={
                  updatingDocument ||
                  (editModal.mode === "rename" &&
                    !editModal.documentName.trim())
                }
                className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {updatingDocument ? "Saving..." : "Save"}
              </button>
              <button
                onClick={closeDocumentEditModal}
                disabled={updatingDocument}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Delete Document
              </h2>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this document? This action cannot
              be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() =>
                  setDeleteModal({ show: false, documentId: null })
                }
                disabled={deleting}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {openMenuId !== null && (
        <div
          className="actions-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {(() => {
            const doc = documents.find((d) => d.documentId === openMenuId);
            if (!doc) return null;
            return renderDocumentActions(doc, () => setOpenMenuId(null));
          })()}
        </div>
      )}
      {contextMenu.id !== null && (
        <div
          className="context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {(() => {
            const doc = documents.find((d) => d.documentId === contextMenu.id);
            if (!doc) return null;
            return renderDocumentActions(doc, () =>
              setContextMenu({ id: null, x: 0, y: 0 }),
            );
          })()}
        </div>
      )}
      {activeSubpage === "documents" && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="relative flex items-end justify-end">
            {showStoragePanel && (
              <div className="storage-panel absolute right-0 bottom-full mb-3 w-[320px] max-w-[90vw] bg-white border border-gray-200 rounded-xl p-4 shadow-lg z-40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">
                      Storage
                    </h2>
                    {storageLoading ? (
                      <p className="text-sm text-gray-500 mt-1">
                        Loading storage usage...
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">
                        {formatBytes(storageInfo.usedBytes)} used of{" "}
                        {formatBytes(storageInfo.totalBytes)}
                      </p>
                    )}
                  </div>
                  {!storageLoading && (
                    <div className="text-sm text-gray-600">
                      {storageInfo.documentCount} file
                      {storageInfo.documentCount === 1 ? "" : "s"}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        storageInfo.usagePercentage >= 90
                          ? "bg-red-500"
                          : storageInfo.usagePercentage >= 75
                            ? "bg-amber-500"
                            : "bg-primary-600"
                      }`}
                      style={{
                        width: `${Math.min(storageInfo.usagePercentage || 0, 100)}%`,
                      }}
                    />
                  </div>
                  {!storageLoading && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                      <span>{storageInfo.usagePercentage}% used</span>
                      <span>
                        {formatBytes(storageInfo.remainingBytes)} available
                      </span>
                    </div>
                  )}
                </div>

                {!storageLoading && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <p className="text-xs text-gray-500">Reports</p>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        {formatBytes(storageInfo.reportUsedBytes)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {storageInfo.reportCount} file
                        {storageInfo.reportCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <p className="text-xs text-gray-500">Prescriptions</p>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        {formatBytes(storageInfo.prescriptionUsedBytes)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {storageInfo.prescriptionCount} file
                        {storageInfo.prescriptionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowStoragePanel((prev) => !prev)}
              className={`storage-toggle relative inline-flex items-center justify-center w-10 h-10 rounded-full border shadow-md transition-colors ${
                isCriticalLimit
                  ? "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                  : isNearLimit
                    ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
              }`}
              aria-label="View storage info"
              title="View storage info"
            >
              <HardDrive className="w-4 h-4" />
              {isNearLimit && (
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${isCriticalLimit ? "bg-red-500" : "bg-amber-500"}`}
                />
              )}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default MyDocuments;
