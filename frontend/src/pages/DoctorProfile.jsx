import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BriefcaseMedical,
  Building2,
  Calendar,
  GraduationCap,
  IdCard,
  Clock,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import usePageMeta from "../hooks/usePageMeta";
import { publicAPI } from "../utils/api";
import Footer from "../components/Footer";
import StarRating from "../components/StarRating";
import AvatarCircle from "../components/AvatarCircle";

const getFullName = (doctor) => {
  const firstName = (doctor?.firstName || "").trim();
  const lastName = (doctor?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Doctor";
};

const toDisplayValue = (value, fallback = "Not provided") => {
  const text = `${value ?? ""}`.trim();
  return text || fallback;
};

const formatDayName = (dayOfWeek) => {
  const names = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };

  return names[dayOfWeek] || "Day TBD";
};

const formatTime = (value) => {
  if (!value) return "Time TBD";

  const parts = String(value).split(":");
  const hours = Number(parts[0]);
  const minutes = parts[1] || "00";

  if (!Number.isFinite(hours)) return String(value);

  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${minutes.padStart(2, "0")} ${suffix}`;
};

const DoctorProfile = () => {
  const { doctorId } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDoctor = async () => {
      try {
        setLoading(true);
        const [data, reviewData] = await Promise.all([
          publicAPI.getDoctorProfile(doctorId),
          publicAPI.getDoctorReviews(doctorId),
        ]);

        let scheduleData = null;
        try {
          scheduleData = await publicAPI.getDoctorSchedule(doctorId);
        } catch {
          scheduleData = null;
        }

        if (active) {
          setDoctor(data || null);
          setSchedule(scheduleData || null);
          setReviews(Array.isArray(reviewData) ? reviewData : []);
          setError("");
        }
      } catch (err) {
        if (active) {
          setDoctor(null);
          setSchedule(null);
          setReviews([]);
          setError(err.message || "Failed to load doctor profile");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (doctorId) {
      loadDoctor();
    }

    return () => {
      active = false;
    };
  }, [doctorId]);

  const doctorName = useMemo(() => getFullName(doctor), [doctor]);
  const weeklyAvailability = useMemo(() => {
    const slots = Array.isArray(schedule?.weeklySchedules)
      ? schedule.weeklySchedules.filter((slot) => slot?.isAvailable)
      : [];

    return [...slots].sort((left, right) => {
      const dayDiff = (left.dayOfWeek || 0) - (right.dayOfWeek || 0);
      if (dayDiff !== 0) return dayDiff;

      return String(left.startTime || "").localeCompare(
        String(right.startTime || ""),
      );
    });
  }, [schedule]);

  const hasAvailability = weeklyAvailability.length > 0;
  usePageMeta({
    title: `${doctorName ? `Dr. ${doctorName}` : "Doctor"} | VitaBridge`,
    description:
      "View a complete professional doctor profile including specialization, experience, location, and consultation details.",
  });

  return (
    <main className="page-shell">
      <section className="section-shell bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-white">
        <div className="section-container">
          <Link
            to="/doctors"
            className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 hover:bg-white/20"
          >
            Back to Doctor List
          </Link>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-8 text-white/90">
              Loading doctor profile...
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              {error}
            </div>
          ) : doctor ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur lg:col-span-2">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide text-white/90">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified Doctor Profile
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <AvatarCircle
                    profile={doctor}
                    sizeClassName="w-16 h-16 sm:w-20 sm:h-20"
                    textClassName="text-xl sm:text-2xl"
                    fallbackClassName="bg-white/20 text-white border border-white/30"
                    alt={`Dr. ${doctorName}`}
                  />
                  <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                    Dr. {doctorName}
                  </h1>
                </div>
                <p className="mt-2 text-lg font-medium text-cyan-200">
                  {toDisplayValue(doctor.specialization, "General Practice")}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100/90 sm:text-base">
                  {toDisplayValue(
                    doctor.about,
                    "Experienced physician committed to evidence-based care, patient education, and continuity of treatment.",
                  )}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <ProfileStat
                    icon={BriefcaseMedical}
                    label="Experience"
                    value={`${doctor.yearOfExperience || 0} years`}
                  />
                  <ProfileStat
                    icon={MapPin}
                    label="Location"
                    value={toDisplayValue(doctor.location, "Bangladesh")}
                  />
                  <ProfileStat
                    icon={Stethoscope}
                    label="Consultation Fee"
                    value={`BDT ${Number(doctor.consultationFee || 0).toFixed(2)}`}
                  />
                  <ProfileStat
                    icon={Building2}
                    label="Hospital"
                    value={toDisplayValue(doctor.hospitalAffiliation)}
                  />
                </div>

                <div className="mt-6 rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    <Calendar className="h-3.5 w-3.5" />
                    Weekly Availability
                  </p>

                  {hasAvailability ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {weeklyAvailability.map((slot) => (
                        <div
                          key={
                            slot.weeklyScheduleId ||
                            `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`
                          }
                          className="rounded-2xl border border-white/15 bg-slate-950/20 p-3"
                        >
                          <p className="text-sm font-semibold text-white">
                            {formatDayName(slot.dayOfWeek)}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-2 text-sm text-cyan-100">
                            <Clock className="h-4 w-4" />
                            {formatTime(slot.startTime)} -{" "}
                            {formatTime(slot.endTime)}
                          </p>
                          <p className="mt-1 text-xs text-slate-200/80">
                            {slot.consultationType || "BOTH"} consultation
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-100/80">
                      No weekly schedule has been published yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900">
                  Professional Details
                </h2>
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                  <DetailRow
                    label="Degrees & Certifications"
                    value={toDisplayValue(doctor.qualifications)}
                    icon={GraduationCap}
                  />
                  <DetailRow
                    label="BMDC registration Number"
                    value={toDisplayValue(doctor.registrationNumber)}
                    icon={Building2}
                  />
                  <DetailRow
                    label="Clinical Experience"
                    value={`${doctor.yearOfExperience || 0} years`}
                    icon={BriefcaseMedical}
                  />
                </div>
                <div className="mt-6 rounded-xl border border-primary-100 bg-primary-50 p-4 text-xs text-primary-800">
                  To book an appointment with this doctor, sign in and use the
                  patient doctor finder.
                  <div className="mt-3">
                    <Link
                      to="/login"
                      state={{ from: { pathname: "/patient/appointments" } }}
                      className="inline-flex rounded-full bg-primary-600 px-3 py-1.5 font-semibold text-white hover:bg-primary-700"
                    >
                      Sign In to Book
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
                <h2 className="text-base font-bold text-slate-900">
                  Patient Reviews
                </h2>
                {reviews.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {reviews.slice(0, 8).map((review, index) => (
                      <div
                        key={`${review.appointmentId || "review"}-${index}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {review.patientName || "Anonymous Patient"}
                          </p>
                          <span className="text-xs text-slate-500">
                            {review.ratedAt
                              ? new Date(review.ratedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : ""}
                          </span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <StarRating
                            rating={Number(review.rating) || 0}
                            readOnly
                            size="sm"
                            showLabel={false}
                          />
                          <span className="text-xs font-semibold text-amber-700">
                            {Number(review.rating) || 0}/5
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {review.reviewText?.trim() || "No written comment."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
};

const ProfileStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
    <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-100">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
    <p className="mt-1 text-sm font-semibold text-white">{value}</p>
  </div>
);

const DetailRow = ({ label, value, icon: Icon = null }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800">
      {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
      <span>{value}</span>
    </p>
  </div>
);

export default DoctorProfile;
