import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  LoaderCircle,
  Plus,
  Pill,
  Printer,
  Sparkles,
  Trash2,
  UserRound,
  AlertTriangle,
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import ReturnToConsultationDashboardButton from "../../components/consultation/ReturnToConsultationDashboardButton";
import { appointmentAPI } from "../../utils/api";

const EMPTY_MED = {
  name: "",
  dosage: "",
  quantity: "",
  frequency: "",
  duration: "",
  instructions: "",
};

const FREQUENCY_OPTIONS = [
  { value: "", label: "Select frequency" },
  { value: "OD", label: "Once daily" },
  { value: "BD", label: "Twice daily" },
  { value: "TDS", label: "Three times daily" },
  {
    value: "1-0-1",
    label: "1-0-1 - 1 in the morning, 0 at noon, 1 at night",
  },
  {
    value: "1-1-1",
    label: "1-1-1 - 1 three times a day (morning, noon, night)",
  },
  { value: "0-0-1", label: "0-0-1 - 1 only at night" },
  { value: "1-0-0", label: "1-0-0 - 1 only in the morning" },
  { value: "QID", label: "Four times daily" },
  { value: "SOS", label: "When required" },
  { value: "PRN", label: "As needed" },
  { value: "Stat", label: "Immediately" },
  { value: "HS", label: "At bedtime" },
  { value: "OW", label: "Once a week" },
  { value: "BW", label: "Twice a week" },
];

const DURATION_OPTIONS = [
  { value: "", label: "Select duration" },
  { value: "1 day", label: "1 day" },
  { value: "3 days", label: "3 days" },
  { value: "5 days", label: "5 days" },
  { value: "7 days", label: "7 days" },
  { value: "10 days", label: "10 days" },
  { value: "14 days", label: "14 days" },
  { value: "1 month", label: "1 month" },
  { value: "2 months", label: "2 months" },
  { value: "3 months", label: "3 months" },
  { value: "Ongoing", label: "Ongoing" },
];

const INSTRUCTIONS_OPTIONS = [
  { value: "", label: "Select instructions" },
  { value: "Before food", label: "Before food" },
  { value: "After food", label: "After food" },
  { value: "With food", label: "With food" },
  { value: "Empty stomach", label: "Empty stomach" },
  { value: "At bedtime", label: "At bedtime" },
  { value: "With water", label: "With water" },
  { value: "Chew before swallow", label: "Chew before swallow" },
  { value: "Do not crush", label: "Do not crush" },
  { value: "Dissolve in water", label: "Dissolve in water" },
];

const normalizeReturnPath = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  return trimmed;
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const normalizeTimeInputValue = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const parts = value.trim().split(":");
  if (parts.length < 2) {
    return "";
  }
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
};

const ClinicalField = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required = false,
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-gray-600">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder || label}
      className="w-full resize-y rounded-xl border border-gray-300 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
    />
  </div>
);

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  className = "",
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-xs font-semibold text-gray-600">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder || label}
      className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-gray-600">{label}</label>
    <select
      value={value}
      onChange={onChange}
      className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const SectionHeader = ({ icon, title, subtitle, action }) => (
  <div className="mb-5 flex items-start justify-between gap-3">
    <div>
      <div className="flex items-center gap-2">
        {icon
          ? createElement(icon, { className: "h-5 w-5 text-primary-600" })
          : null}
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const PrescriptionEditor = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const toast = useToast();

  const returnPath = useMemo(
    () => normalizeReturnPath(location.state?.from) || "/doctor/appointments",
    [location.state],
  );

  const [loading, setLoading] = useState(true);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [previewingPrescription, setPreviewingPrescription] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [prescription, setPrescription] = useState(null);
  const [validationError, setValidationError] = useState("");

  const [form, setForm] = useState({
    chiefComplaints: "",
    pastHistory: "",
    drugHistory: "",
    onExamination: "",
    diagnosis: "",
    medications: [{ ...EMPTY_MED }],
    labTests: "",
    advice: "",
    followUpDate: "",
    followUpTime: "",
    followUpNumber: "",
    followUpInstruction: "",
    emergencyInstruction: "",
  });

  const loadData = useCallback(async () => {
    if (!token || !appointmentId) {
      return;
    }
    try {
      setLoading(true);
      const appointments = await appointmentAPI.getDoctorAppointments(token);
      const selectedAppointment = (
        Array.isArray(appointments) ? appointments : []
      ).find((item) => String(item.appointmentId) === String(appointmentId));
      if (!selectedAppointment) {
        throw new Error("Appointment not found or inaccessible.");
      }
      setAppointment(selectedAppointment);

      try {
        const latest = await appointmentAPI.getPrescription(
          appointmentId,
          token,
        );
        setPrescription(latest || null);
        if (latest) {
          setForm((prev) => ({
            ...prev,
            chiefComplaints: latest.chiefComplaints || "",
            pastHistory: latest.pastHistory || "",
            drugHistory: latest.drugHistory || "",
            onExamination: latest.onExamination || "",
            diagnosis: latest.diagnosis || "",
            medications:
              latest.medications && latest.medications.length > 0
                ? latest.medications
                : [{ ...EMPTY_MED }],
            labTests: latest.labTests || "",
            advice: latest.advice || "",
            followUpDate: latest.followUpDate || "",
            followUpTime: normalizeTimeInputValue(latest.followUpTime || ""),
            followUpNumber:
              latest.followUpNumber != null
                ? String(latest.followUpNumber)
                : "",
            followUpInstruction: latest.followUpInstruction || "",
            emergencyInstruction: latest.emergencyInstruction || "",
          }));
        }
      } catch {
        setPrescription(null);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load prescription editor");
      navigate(returnPath);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, navigate, returnPath, token, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const updateMedication = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.medications];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, medications: next };
    });
  };

  const addMedication = () =>
    setForm((prev) => ({
      ...prev,
      medications: [...prev.medications, { ...EMPTY_MED }],
    }));

  const removeMedication = (index) =>
    setForm((prev) => {
      const next = prev.medications.filter((_, i) => i !== index);
      return {
        ...prev,
        medications: next.length > 0 ? next : [{ ...EMPTY_MED }],
      };
    });

  const validate = () => {
    if (!form.diagnosis.trim()) {
      setValidationError("Diagnosis is required before saving.");
      return false;
    }
    const hasNamedMed = form.medications.some((m) => m.name.trim());
    if (!hasNamedMed) {
      setValidationError("At least one medication with a name is required.");
      return false;
    }

    if (form.followUpDate && !form.followUpTime) {
      setValidationError(
        "Please select a follow-up time to auto-assign the closest visit number.",
      );
      return false;
    }

    if (!form.followUpDate && form.followUpTime) {
      setValidationError(
        "Please select a follow-up date for the selected time.",
      );
      return false;
    }

    setValidationError("");
    return true;
  };

  const buildPayload = () => ({
    ...form,
    followUpNumber: null,
    followUpDate: form.followUpDate || null,
    followUpTime: form.followUpTime || null,
  });

  const savePrescription = async () => {
    if (!validate()) {
      return;
    }
    try {
      setSavingPrescription(true);
      const saved = await appointmentAPI.createPrescription(
        appointmentId,
        buildPayload(),
        token,
      );
      setPrescription(saved);
      setForm((prev) => ({
        ...prev,
        followUpDate: saved?.followUpDate || prev.followUpDate,
        followUpTime: normalizeTimeInputValue(saved?.followUpTime || ""),
        followUpNumber:
          saved?.followUpNumber != null ? String(saved.followUpNumber) : "",
      }));
      if (saved?.followUpBookedAppointmentId) {
        toast.success(
          `Prescription saved. Follow-up booked successfully (Appointment #${saved.followUpBookedAppointmentId})`,
        );
      } else {
        toast.success("Prescription saved to the patient's drive");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save prescription");
    } finally {
      setSavingPrescription(false);
    }
  };

  const previewPrescriptionPdf = async () => {
    if (!validate()) {
      return;
    }
    try {
      setPreviewingPrescription(true);
      const pdfBlob = await appointmentAPI.previewPrescriptionPdf(
        appointmentId,
        buildPayload(),
        token,
      );
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const opened = window.open(pdfUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.warning("Popup blocked. Please allow popups and try again.");
      }
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    } catch (err) {
      toast.error(err.message || "Failed to preview prescription PDF");
    } finally {
      setPreviewingPrescription(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600 shadow-sm">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary-600" />
            Loading prescription editor...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.12),_transparent_28%)]" />
          <div className="relative flex flex-col gap-4 p-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Prescription Studio
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">
                    Create and send prescription
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-gray-600">
                    Save the prescription directly to the patient&apos;s
                    document drive. You can preview the PDF before finalizing
                    it.
                  </p>
                </div>
              </div>

              <div className="flex w-fit flex-wrap items-center gap-2">
                <ReturnToConsultationDashboardButton
                  patientId={appointment?.patientId}
                />
                <button
                  onClick={() => navigate(returnPath, { replace: false })}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <UserRound className="h-4 w-4" />
                  Patient
                </div>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {appointment?.patientName || "Unknown patient"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </div>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {appointment?.appointmentDate || "-"}
                </p>
                <p className="text-sm text-gray-600">
                  {appointment?.appointmentTime || "Time TBD"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <HeartPulse className="h-4 w-4" />
                  Status
                </div>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {appointment?.status || "-"}
                </p>
                <p className="text-sm text-gray-600">
                  Last saved:{" "}
                  {prescription?.createdAt
                    ? formatDateTime(prescription.createdAt)
                    : "No prescription saved yet"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={FileText}
                title="Subjective"
                subtitle="Patient-reported history and complaints"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <ClinicalField
                  label="Chief Complaints"
                  value={form.chiefComplaints}
                  onChange={setField("chiefComplaints")}
                  placeholder="e.g. Fever for 3 days, headache, sore throat"
                  rows={3}
                />
                <ClinicalField
                  label="Past Medical History"
                  value={form.pastHistory}
                  onChange={setField("pastHistory")}
                  placeholder="e.g. Hypertension since 2018, appendectomy 2015"
                  rows={3}
                />
                <ClinicalField
                  label="Drug History / Current Medications"
                  value={form.drugHistory}
                  onChange={setField("drugHistory")}
                  placeholder="e.g. Metformin 500 mg twice daily, Amlodipine 5 mg once daily"
                  rows={3}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={HeartPulse}
                title="Objective"
                subtitle="Findings from physical examination"
              />
              <ClinicalField
                label="On Examination"
                value={form.onExamination}
                onChange={setField("onExamination")}
                placeholder="e.g. Temp 38.5 C, BP 130/85 mmHg, pulse 96 bpm"
                rows={4}
              />
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Pill}
                title="Assessment"
                subtitle="Diagnosis and clinical impression"
              />
              <ClinicalField
                label="Diagnosis"
                value={form.diagnosis}
                onChange={setField("diagnosis")}
                placeholder="e.g. Acute pharyngitis. Rule out streptococcal infection."
                rows={3}
                required
              />
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Pill}
                title="Plan: Medications"
                subtitle="Add the medicines to be dispensed. At least one named medication is required."
                action={
                  <button
                    type="button"
                    onClick={addMedication}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add medication
                  </button>
                }
              />

              <div className="space-y-4">
                {form.medications.map((med, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Medication {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMedication(index)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <InputField
                        label="Medicine Name"
                        value={med.name}
                        onChange={(e) =>
                          updateMedication(index, "name", e.target.value)
                        }
                        placeholder="e.g. Amoxicillin"
                        required
                      />
                      <InputField
                        label="Dosage / Strength"
                        value={med.dosage}
                        onChange={(e) =>
                          updateMedication(index, "dosage", e.target.value)
                        }
                        placeholder="e.g. 500mg"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <InputField
                        label="Quantity / Tablets"
                        value={med.quantity}
                        onChange={(e) =>
                          updateMedication(index, "quantity", e.target.value)
                        }
                        placeholder="e.g. 1 tablet"
                      />
                      <SelectField
                        label="Frequency"
                        value={med.frequency}
                        onChange={(e) =>
                          updateMedication(index, "frequency", e.target.value)
                        }
                        options={FREQUENCY_OPTIONS}
                      />
                      <SelectField
                        label="Duration"
                        value={med.duration}
                        onChange={(e) =>
                          updateMedication(index, "duration", e.target.value)
                        }
                        options={DURATION_OPTIONS}
                      />
                    </div>

                    <div className="mt-3">
                      <SelectField
                        label="Instructions"
                        value={med.instructions}
                        onChange={(e) =>
                          updateMedication(
                            index,
                            "instructions",
                            e.target.value,
                          )
                        }
                        options={INSTRUCTIONS_OPTIONS}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={FileText}
                title="Plan: Investigations and Advice"
                subtitle="Lab tests to order and general advice for the patient"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <ClinicalField
                  label="Lab Tests / Investigations"
                  value={form.labTests}
                  onChange={setField("labTests")}
                  placeholder="e.g. CBC, CRP, throat swab culture"
                  rows={3}
                />
                <ClinicalField
                  label="Advice to Patient"
                  value={form.advice}
                  onChange={setField("advice")}
                  placeholder="e.g. Rest for 3 days, increase fluids, avoid cold foods"
                  rows={3}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Clock3}
                title="Plan: Follow-up"
                subtitle="Scheduled review and emergency instructions"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Follow-up Date"
                  value={form.followUpDate}
                  onChange={setField("followUpDate")}
                  type="date"
                />
                <InputField
                  label="Preferred Follow-up Time"
                  value={form.followUpTime}
                  onChange={setField("followUpTime")}
                  type="time"
                />
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                  <p className="text-xs font-semibold text-gray-600">
                    Closest Visit No.
                  </p>
                  <p className="mt-1 font-semibold text-gray-800">
                    {form.followUpNumber ||
                      "Auto-assigned from preferred time when you save"}
                  </p>
                </div>
                <ClinicalField
                  label="Follow-up Instructions"
                  value={form.followUpInstruction}
                  onChange={setField("followUpInstruction")}
                  placeholder="e.g. Return if fever persists beyond 5 days"
                  rows={3}
                />
                <ClinicalField
                  label="Emergency Instructions"
                  value={form.emergencyInstruction}
                  onChange={setField("emergencyInstruction")}
                  placeholder="e.g. Go to ER immediately if breathing difficulty occurs"
                  rows={3}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-primary-600" />
                <h2 className="text-base font-semibold text-gray-900">
                  Save status
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Saving this prescription generates the PDF and stores it on the
                patient&apos;s document drive automatically.
              </p>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">Current status</p>
                <p className="mt-1">
                  {prescription?.createdAt
                    ? `Last saved: ${formatDateTime(prescription.createdAt)}`
                    : "No prescription saved yet"}
                </p>
              </div>
            </section>

            <section className="sticky top-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary-600" />
                <h2 className="text-base font-semibold text-gray-900">
                  Ready to send
                </h2>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Review the prescription, then preview or save it.
              </p>

              {validationError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {validationError}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={previewPrescriptionPdf}
                  disabled={previewingPrescription}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  {previewingPrescription ? "Generating PDF..." : "Preview PDF"}
                </button>
                <button
                  type="button"
                  onClick={savePrescription}
                  disabled={savingPrescription}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {savingPrescription ? "Saving..." : "Save Prescription"}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PrescriptionEditor;
