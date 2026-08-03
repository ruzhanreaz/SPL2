import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import ReturnToConsultationDashboardButton from "../../components/consultation/ReturnToConsultationDashboardButton";
import { appointmentAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import {
  FileText,
  Pill,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
} from "lucide-react";

const EMPTY_MED = {
  name: "",
  dosage: "",
  quantity: "",
  frequency: "",
  duration: "",
  instructions: "",
};

const normalizeReturnPath = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  return trimmed;
};

const guessMimeTypeFromFileName = (fileName = "") => {
  const ext = String(fileName).split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  const map = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
  };
  return map[ext] || "application/octet-stream";
};

const OfflineConsultationActions = () => {
  const { appointmentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const toast = useToast();

  const initialTab =
    searchParams.get("tab") === "prescription" ? "prescription" : "documents";
  const returnToFromQuery = useMemo(
    () => normalizeReturnPath(searchParams.get("returnTo")),
    [searchParams],
  );
  const returnToFromState = useMemo(
    () => normalizeReturnPath(location.state?.from),
    [location.state],
  );
  const returnPath = returnToFromState || returnToFromQuery;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [patientIdForConsultation, setPatientIdForConsultation] = useState("");
  const [accessStatus, setAccessStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [prescription, setPrescription] = useState(null);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [previewingPrescription, setPreviewingPrescription] = useState(false);
  const [form, setForm] = useState({
    diagnosis: "",
    chiefComplaints: "",
    pastHistory: "",
    drugHistory: "",
    onExamination: "",
    followUpNumber: "",
    followUpInstruction: "",
    emergencyInstruction: "",
    medications: [{ ...EMPTY_MED }],
    labTests: "",
    advice: "",
    followUpDate: "",
  });

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    if (returnToFromQuery) {
      nextParams.set("returnTo", returnToFromQuery);
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, returnToFromQuery, searchParams, setSearchParams]);

  const backLabel = useMemo(() => {
    if (returnPath?.startsWith("/doctor/telemedicine")) {
      return "Back to Consultation";
    }
    if (returnPath?.startsWith("/doctor/appointments")) {
      return "Back to Appointments";
    }
    return "Back";
  }, [returnPath]);

  const handleBack = useCallback(() => {
    if (returnPath) {
      navigate(returnPath);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/doctor/appointments");
  }, [navigate, returnPath]);

  const hasDocumentAccess = useMemo(() => {
    return Boolean(accessStatus?.hasAccess);
  }, [accessStatus]);

  const loadData = useCallback(async () => {
    if (!token || !appointmentId) return;

    try {
      setLoading(true);
      const appointments = await appointmentAPI.getDoctorAppointments(token);
      const selectedAppointment = (
        Array.isArray(appointments) ? appointments : []
      ).find((item) => String(item.appointmentId) === String(appointmentId));

      if (!selectedAppointment) {
        throw new Error("Appointment not found or inaccessible.");
      }
      setPatientIdForConsultation(
        selectedAppointment?.patientId != null
          ? String(selectedAppointment.patientId)
          : "",
      );

      const status = await appointmentAPI.getPatientAccessStatusForDoctor(
        appointmentId,
        token,
      );
      setAccessStatus(status || {});

      if (status?.hasAccess) {
        const docs = await appointmentAPI.getPatientDocumentsForDoctor(
          appointmentId,
          token,
        );
        setDocuments(Array.isArray(docs) ? docs : []);
      } else {
        setDocuments([]);
      }

      try {
        const latest = await appointmentAPI.getPrescription(
          appointmentId,
          token,
        );
        setPrescription(latest || null);
        if (latest) {
          setForm((prev) => ({
            ...prev,
            diagnosis: latest.diagnosis || "",
            chiefComplaints: latest.chiefComplaints || "",
            pastHistory: latest.pastHistory || "",
            drugHistory: latest.drugHistory || "",
            onExamination: latest.onExamination || "",
            followUpNumber:
              latest.followUpNumber != null
                ? String(latest.followUpNumber)
                : "",
            followUpInstruction: latest.followUpInstruction || "",
            emergencyInstruction: latest.emergencyInstruction || "",
            medications:
              latest.medications && latest.medications.length > 0
                ? latest.medications
                : [{ ...EMPTY_MED }],
            labTests: latest.labTests || "",
            advice: latest.advice || "",
            followUpDate: latest.followUpDate || "",
          }));
        }
      } catch {
        setPrescription(null);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load offline consultation actions");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, token, toast]);

  const handleOpenDocument = useCallback(
    async (documentId) => {
      if (!appointmentId || !documentId || !token) return;

      const popup = window.open("", "_blank");

      if (popup) {
        popup.document.title = "Opening document...";
        popup.document.body.innerHTML =
          '<div style="font-family: sans-serif; padding: 24px;">Opening document...</div>';
      }

      try {
        const result = await appointmentAPI.openPatientDocumentForDoctor(
          appointmentId,
          documentId,
          token,
        );

        const hasUsableMime =
          result.contentType &&
          result.contentType !== "application/octet-stream" &&
          result.contentType !== "application/download";
        const normalizedMime = hasUsableMime
          ? result.contentType
          : guessMimeTypeFromFileName(result.fileName);
        const normalizedBlob = new Blob([result.blob], {
          type: normalizedMime,
        });
        const objectUrl = URL.createObjectURL(normalizedBlob);

        if (popup) {
          popup.location.href = objectUrl;
        } else {
          const link = document.createElement("a");
          link.href = objectUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.click();
        }

        window.setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 300000);
      } catch (err) {
        if (popup) popup.close();
        toast.error(err.message || "Failed to open document");
      }
    },
    [appointmentId, toast, token],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateMedication = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.medications];
      next[index] = {
        ...next[index],
        [key]: value,
      };
      return {
        ...prev,
        medications: next,
      };
    });
  };

  const addMedication = () => {
    setForm((prev) => ({
      ...prev,
      medications: [...prev.medications, { ...EMPTY_MED }],
    }));
  };

  const removeMedication = (index) => {
    setForm((prev) => {
      const next = prev.medications.filter((_, idx) => idx !== index);
      return {
        ...prev,
        medications: next.length > 0 ? next : [{ ...EMPTY_MED }],
      };
    });
  };

  const savePrescription = async () => {
    try {
      setSavingPrescription(true);

      const payload = {
        ...form,
        followUpNumber:
          form.followUpNumber !== "" ? Number(form.followUpNumber) : null,
        followUpDate: form.followUpDate || null,
      };

      const saved = await appointmentAPI.createPrescription(
        appointmentId,
        payload,
        token,
      );
      setPrescription(saved);
      toast.success("Prescription saved successfully");
    } catch (err) {
      toast.error(err.message || "Failed to save prescription");
    } finally {
      setSavingPrescription(false);
    }
  };

  const previewPrescriptionPdf = async () => {
    try {
      setPreviewingPrescription(true);

      const payload = {
        ...form,
        followUpNumber:
          form.followUpNumber !== "" ? Number(form.followUpNumber) : null,
        followUpDate: form.followUpDate || null,
      };

      const pdfBlob = await appointmentAPI.previewPrescriptionPdf(
        appointmentId,
        payload,
        token,
      );

      const pdfUrl = URL.createObjectURL(pdfBlob);
      const opened = window.open(pdfUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.warning("Popup blocked. Please allow popups and try again.");
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 60000);
    } catch (err) {
      toast.error(err.message || "Failed to preview prescription PDF");
    } finally {
      setPreviewingPrescription(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading consultation actions...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Consultation Actions
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              Appointment #{appointmentId}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReturnToConsultationDashboardButton
              patientId={patientIdForConsultation}
            />
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("documents")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === "documents"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              Document Access
            </button>
            <button
              onClick={() => setActiveTab("prescription")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === "prescription"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Pill className="h-4 w-4" />
              Prescription
            </button>
          </div>
        </div>

        {activeTab === "documents" && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            {!hasDocumentAccess ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                The patient has not granted document access yet, or access has
                expired.
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-600">
                    Access granted. {documents.length} document
                    {documents.length === 1 ? "" : "s"} available.
                  </p>
                  <button
                    onClick={loadData}
                    className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>

                {documents.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No documents available.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.documentId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.documentType} • {doc.uploadedAt || "N/A"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(doc.documentId)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Open File
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "prescription" && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gradient-to-br from-white to-primary-50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <Pill className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-gray-900">
              Prescription editor moved
            </h3>
            <p className="mt-2 text-sm text-gray-600 max-w-xl mx-auto">
              The prescription workflow now lives in a dedicated page so the
              document access screen stays focused.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/doctor/appointments/${appointmentId}/prescription`,
                    {
                      state: { from: `${location.pathname}${location.search}` },
                    },
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <Pill className="h-4 w-4" />
                Open Prescription Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" />
                Back to Documents
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OfflineConsultationActions;
