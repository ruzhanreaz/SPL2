import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Calendar,
  Clock,
  Video,
  MapPin,
  AlertCircle,
  CheckCircle,
  Hash,
  Info,
  ChevronRight,
  Shuffle,
  Timer,
  Star,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { appointmentAPI } from "../utils/api";
import { useToast } from "./ToastProvider";
import { useAuth } from "../auth/AuthProvider";

const BookAppointmentModal = ({
  doctor,
  onClose,
  onSuccess,
  isEmbedded = false,
}) => {
  const toast = useToast();
  const { token } = useAuth();
  const [step, setStep] = useState(1); // 1: Type+Date, 2: Time preference, 3: Review, 4: Success
  const [appointmentType, setAppointmentType] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [usePreferredTime, setUsePreferredTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState("PAY_NOW");
  const [error, setError] = useState(null);
  const [bookingConflict, setBookingConflict] = useState(null);
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !booking) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, booking]);

  const toLocalISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const minDate = toLocalISODate(new Date());
  const maxDate = toLocalISODate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  );

  const fetchSlots = useCallback(
    async (date) => {
      if (!date || !doctor?.doctorId) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const slots = await appointmentAPI.getAvailableTimeSlots(
          doctor.doctorId,
          date,
          token,
        );
        setAvailableSlots(slots || []);
      } catch {
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [doctor?.doctorId, token],
  );

  useEffect(() => {
    if (usePreferredTime === true && selectedDate) fetchSlots(selectedDate);
  }, [usePreferredTime, selectedDate, fetchSlots]);

  const handleStep1Next = () => {
    if (!appointmentType) {
      toast.warning("Please select appointment type");
      return;
    }
    if (!selectedDate) {
      toast.warning("Please select a date");
      return;
    }
    setBookingConflict(null);
    setError(null);
    setStep(2);
  };

  const handleStep2Next = () => {
    if (usePreferredTime === null) {
      toast.warning("Please select a time preference");
      return;
    }
    if (usePreferredTime && !selectedSlot) {
      toast.warning("Please select a time slot");
      return;
    }
    setBookingConflict(null);
    setError(null);
    setStep(3);
  };

  const isBookingConflictError = (err) => {
    if (!err) return false;
    if (err.status === 409) return true;
    return [
      "APPOINTMENT_SLOT_UNAVAILABLE",
      "APPOINTMENT_BOOKING_CONFLICT",
    ].includes(err.code);
  };

  const buildBookingConflictState = (err) => {
    const rawMessage = String(err?.message || "").toLowerCase();
    const slotConflict =
      rawMessage.includes("slot") ||
      rawMessage.includes("booked by another") ||
      usePreferredTime === true;

    if (slotConflict) {
      return {
        type: "SLOT_TAKEN",
        message:
          "That time slot was just booked by someone else. Please choose another available slot.",
      };
    }

    return {
      type: "DAY_FULL",
      message:
        "No more queue slots are available for this date. Please choose another date.",
    };
  };

  const handleTryAnotherSlot = async () => {
    setBookingConflict(null);
    setError(null);
    setStep(2);
    if (selectedDate) {
      await fetchSlots(selectedDate);
    }
  };

  const handleBookAppointment = async () => {
    try {
      setBooking(true);
      setError(null);
      setBookingConflict(null);
      const appointmentData = {
        doctorId: doctor.doctorId,
        appointmentDate: selectedDate,
        preferredTime:
          usePreferredTime && selectedSlot ? selectedSlot.time : null,
        appointmentType,
        paymentMode,
        notes,
        clientOrigin: window.location.origin,
      };
      const res = await appointmentAPI.bookAppointment(appointmentData, token);
      setResult(res);
      // Redirect to aamarpay payment page, or stay on the local success state for pay-later bookings.
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        setStep(4);
        onSuccess && onSuccess(res);
      }
    } catch (err) {
      if (isBookingConflictError(err)) {
        const conflictState = buildBookingConflictState(err);
        setBookingConflict(conflictState);
        setError(conflictState.message);

        if (conflictState.type === "SLOT_TAKEN") {
          setStep(2);
          setSelectedSlot(null);
          if (selectedDate) {
            await fetchSlots(selectedDate);
          }
        } else {
          setStep(1);
        }
        return;
      }

      setError(err.message || "Failed to book appointment. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };

  const freeSlots = availableSlots.filter((s) => s.available);
  const isTodaySelected = selectedDate === minDate;
  const stepLabels = ["Type & Date", "Time", "Review & Pay"];
  const consultationFee = doctor?.consultationFee;

  const content = (
    <div
      className={
        isEmbedded
          ? "h-full flex flex-col"
          : "bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
      }
    >
      {step < 4 && (
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 z-10 relative">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Book Appointment
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Dr. {doctor.firstName} {doctor.lastName}
              {doctor.specialization ? ` · ${doctor.specialization}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {step < 4 && (
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {stepLabels.map((label, idx) => {
              const sid = idx + 1;
              return (
                <React.Fragment key={sid}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${sid === step ? "bg-primary-600 text-white" : sid < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}
                    >
                      {sid < step ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        sid
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${sid === step ? "text-primary-600" : sid < step ? "text-green-600" : "text-gray-400"}`}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-2 ${step > sid ? "bg-green-400" : "bg-gray-200"}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="w-full">
              <p className="text-sm text-red-700">{error}</p>
              {bookingConflict && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {bookingConflict.type === "SLOT_TAKEN" && (
                    <button
                      type="button"
                      onClick={handleTryAnotherSlot}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                      Choose Another Slot
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBookingConflict(null);
                      setError(null);
                      setStep(1);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Change Date
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Back to Doctor List
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Type + Date */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Consultation Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    value: "ONLINE",
                    icon: Video,
                    label: "Online",
                    sub: "Video Consultation",
                  },
                  {
                    value: "IN_PERSON",
                    icon: MapPin,
                    label: "In-Person",
                    sub: "Visit Clinic",
                  },
                ].map(({ value, icon, label, sub }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setAppointmentType(value);
                      setError(null);
                      setBookingConflict(null);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${appointmentType === value ? "border-primary-600 bg-primary-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${appointmentType === value ? "bg-primary-100" : "bg-gray-100"}`}
                    >
                      {React.createElement(icon, {
                        className: `w-5 h-5 ${appointmentType === value ? "text-primary-600" : "text-gray-500"}`,
                      })}
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-sm font-semibold ${appointmentType === value ? "text-primary-700" : "text-gray-700"}`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                    </div>
                    {appointmentType === value && (
                      <CheckCircle className="w-4 h-4 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Appointment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setBookingConflict(null);
                  setError(null);
                }}
                min={minDate}
                max={maxDate}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Bookings available up to 30 days ahead.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes / Reason{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefly describe your symptoms or reason for visit..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800 resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 2: Time Preference */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              How would you like to schedule your time?
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  setUsePreferredTime(false);
                  setSelectedSlot(null);
                  setBookingConflict(null);
                  setError(null);
                }}
                className={`text-left p-4 rounded-xl border-2 ${usePreferredTime === false ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-primary-300"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${usePreferredTime === false ? "bg-primary-100" : "bg-gray-100"}`}
                  >
                    <Shuffle
                      className={`w-4 h-4 ${usePreferredTime === false ? "text-primary-600" : "text-gray-500"}`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold ${usePreferredTime === false ? "text-primary-700" : "text-gray-700"}`}
                    >
                      Join Queue
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      System assigns next available slot. You get a queue token.
                    </p>
                  </div>
                </div>
                {usePreferredTime === false && (
                  <div className="mt-3 bg-primary-100 rounded-lg px-3 py-2 text-xs text-primary-700">
                    Serial number assigned immediately.
                  </div>
                )}
              </button>
              <button
                onClick={() => {
                  setUsePreferredTime(true);
                  setBookingConflict(null);
                  setError(null);
                  if (selectedDate) fetchSlots(selectedDate);
                }}
                className={`text-left p-4 rounded-xl border-2 ${usePreferredTime === true ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-primary-300"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${usePreferredTime === true ? "bg-primary-100" : "bg-gray-100"}`}
                  >
                    <Star
                      className={`w-4 h-4 ${usePreferredTime === true ? "text-primary-600" : "text-gray-500"}`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold ${usePreferredTime === true ? "text-primary-700" : "text-gray-700"}`}
                    >
                      Choose a Slot
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Pick a specific time from the doctor's available openings.
                    </p>
                  </div>
                </div>
                {usePreferredTime === true && (
                  <div className="mt-3 bg-primary-100 rounded-lg px-3 py-2 text-xs text-primary-700">
                    Priority token assigned to your chosen slot.
                  </div>
                )}
              </button>
            </div>

            {usePreferredTime === true && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Available Slots — {formatDate(selectedDate)}
                </p>
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p className="font-semibold">Note</p>
                  <p className="mt-1 leading-relaxed">
                    The time shown for each slot is approximate only. Actual
                    timing may change based on queue flow and clinic conditions.
                  </p>
                </div>
                {isTodaySelected && (
                  <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                    Past slots are not bookable today. Only upcoming times are
                    shown.
                  </div>
                )}
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-gray-500">
                      Loading slots…
                    </span>
                  </div>
                ) : freeSlots.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                    No available slots on this day. Consider joining the queue
                    or choosing another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {freeSlots.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setBookingConflict(null);
                          setError(null);
                        }}
                        className={`py-2.5 px-3 rounded-lg border text-sm font-semibold flex flex-col items-center gap-0.5 ${selectedSlot?.time === slot.time ? "bg-primary-600 border-primary-600 text-white shadow" : "bg-white border-gray-200 text-gray-700 hover:border-primary-400 hover:bg-primary-50"}`}
                      >
                        <span>{formatTime(slot.time)}</span>
                        {slot.serialNumber != null && (
                          <span
                            className={`text-xs font-normal ${selectedSlot?.time === slot.time ? "text-primary-100" : "text-gray-400"}`}
                          >
                            #{slot.serialNumber}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedSlot && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-4 py-2.5">
                    <Timer className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Selected: <strong>{formatTime(selectedSlot.time)}</strong>
                    </span>
                    {selectedSlot.serialNumber != null && (
                      <span className="ml-auto text-xs font-semibold bg-primary-100 text-primary-600 rounded px-2 py-0.5">
                        Queue #{selectedSlot.serialNumber}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Review your appointment details before payment.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-100">
              <ReviewRow
                icon={appointmentType === "ONLINE" ? Video : MapPin}
                label="Type"
                value={
                  appointmentType === "ONLINE"
                    ? "Online — Video Consultation"
                    : "In-Person — Visit Clinic"
                }
              />
              <ReviewRow
                icon={Calendar}
                label="Date"
                value={formatDate(selectedDate)}
              />
              <ReviewRow
                icon={Clock}
                label="Scheduling"
                value={
                  usePreferredTime
                    ? `Preferred Slot — ${selectedSlot ? `${formatTime(selectedSlot.time)}${selectedSlot.serialNumber != null ? ` (Queue #${selectedSlot.serialNumber})` : ""}` : ""}`
                    : "Queue — Next available slot"
                }
              />
              {notes && <ReviewRow icon={Info} label="Notes" value={notes} />}
              <ReviewRow
                icon={CreditCard}
                label="Consultation Fee"
                value={
                  consultationFee != null
                    ? `৳ ${consultationFee.toFixed(2)} BDT`
                    : "Not specified"
                }
              />
              <ReviewRow
                icon={CreditCard}
                label="Payment"
                value={
                  paymentMode === "PAY_LATER"
                    ? "Pay Later (Offline)"
                    : "Pay Now (Online)"
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMode("PAY_NOW")}
                className={`text-left p-4 rounded-xl border-2 ${paymentMode === "PAY_NOW" ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-primary-300"}`}
              >
                <p
                  className={`text-sm font-semibold ${paymentMode === "PAY_NOW" ? "text-primary-700" : "text-gray-700"}`}
                >
                  Pay Now
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Pay securely via aamarpay and auto-confirm your appointment.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("PAY_LATER")}
                className={`text-left p-4 rounded-xl border-2 ${paymentMode === "PAY_LATER" ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-primary-300"}`}
              >
                <p
                  className={`text-sm font-semibold ${paymentMode === "PAY_LATER" ? "text-primary-700" : "text-gray-700"}`}
                >
                  Pay Later
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Book now and complete payment offline. Doctor or assistant
                  will confirm payment.
                </p>
              </button>
            </div>
            <div className="flex items-start gap-3 bg-primary-50 border border-primary-100 rounded-lg px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
              {paymentMode === "PAY_NOW" ? (
                <p className="text-xs text-primary-700 leading-relaxed">
                  You will be redirected to aamarpay's secure payment page to
                  complete the transaction. Your appointment will be
                  auto-confirmed once payment is successful.
                </p>
              ) : (
                <p className="text-xs text-primary-700 leading-relaxed">
                  Your booking will be saved with payment pending. After your
                  offline payment is received, doctor or assistant can mark
                  payment as confirmed.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && result && (
          <div className="flex flex-col items-center text-center py-4 space-y-5">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Appointment Booked!
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Dr. {doctor.firstName} {doctor.lastName} ·{" "}
                {formatDate(selectedDate)}
              </p>
            </div>
            {result.serialNumber != null && (
              <div className="w-full bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-100 mb-2">
                  {result.isPreferredSlot
                    ? "Priority Queue Token"
                    : "Queue Token"}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Hash className="w-6 h-6 text-primary-200" />
                  <span className="text-5xl font-black tracking-wide">
                    {result.serialNumber}
                  </span>
                </div>
                {result.appointmentTime && (
                  <p className="text-sm text-primary-100 mt-3">
                    Estimated time:{" "}
                    <span className="font-semibold text-white">
                      {formatTime(result.appointmentTime)}
                    </span>
                  </p>
                )}
                {result.isPreferredSlot && (
                  <div className="mt-2 flex items-center justify-center gap-1 text-xs text-primary-100">
                    <Star className="w-3 h-3" />
                    <span>Reserved slot</span>
                  </div>
                )}
              </div>
            )}
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl text-left divide-y divide-gray-100">
              <ReviewRow
                icon={appointmentType === "ONLINE" ? Video : MapPin}
                label="Type"
                value={
                  appointmentType === "ONLINE"
                    ? "Online Consultation"
                    : "In-Person Visit"
                }
                small
              />
              <ReviewRow
                icon={Calendar}
                label="Date"
                value={formatDate(selectedDate)}
                small
              />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Monitor your queue position in the Live Queue section once
              confirmed.
            </p>
          </div>
        )}
      </div>

      {step === 1 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4">
          <button
            onClick={handleStep1Next}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={() => {
              setStep(1);
              setError(null);
            }}
            className="w-full sm:w-auto px-5 py-3 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleStep2Next}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2"
          >
            Review <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      {step === 3 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={() => {
              setStep(2);
              setError(null);
            }}
            className="w-full sm:w-auto px-5 py-3 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleBookAppointment}
            disabled={booking}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {booking ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                {paymentMode === "PAY_NOW" ? "Preparing Payment…" : "Booking…"}
              </>
            ) : paymentMode === "PAY_NOW" ? (
              <>
                <CreditCard className="w-4 h-4" /> Pay{" "}
                {consultationFee != null
                  ? `৳${consultationFee.toFixed(0)}`
                  : ""}{" "}
                Now
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" /> Book With Pay Later
              </>
            )}
          </button>
        </div>
      )}
      {step === 4 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );

  if (isEmbedded) return content;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55] p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !booking) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      {content}
    </div>
  );
};

const ReviewRow = ({ icon, label, value, small }) => (
  <div className={`flex items-center gap-4 px-5 ${small ? "py-3" : "py-4"}`}>
    <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
      {React.createElement(icon, { className: "w-4 h-4 text-primary-600" })}
    </div>
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  </div>
);

export default BookAppointmentModal;
