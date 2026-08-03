import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Stethoscope } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { publicAPI } from "../utils/api";
import StarRating from "../components/StarRating";
import Footer from "../components/Footer";
import usePageMeta from "../hooks/usePageMeta";
import { trackEvent } from "../utils/analytics";
import AvatarCircle from "../components/AvatarCircle";

const getDoctorDisplayName = (doctor) => {
  const firstName = (doctor?.firstName || "").trim();
  const lastName = (doctor?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || doctor?.name || "Doctor";
};

const getDoctorExperience = (doctor) => {
  if (typeof doctor?.yearsOfExperience === "number") {
    return doctor.yearsOfExperience;
  }
  if (typeof doctor?.yearOfExperience === "number") {
    return doctor.yearOfExperience;
  }
  return 0;
};

const getDoctorSpecialization = (doctor) => {
  const specialization = (doctor?.specialization || "").trim();
  return specialization || "General Practice";
};

const getDoctorAverageRating = (doctor) => {
  const value = Number(doctor?.averageRating);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, value));
};

const getDoctorTotalRatings = (doctor) => {
  const value = Number(doctor?.totalRatings);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
};

const DoctorList = () => {
  usePageMeta({
    title: "Find Doctors | VitaBridge",
    description:
      "Browse verified doctors by specialization, location, and experience on VitaBridge.",
  });

  const { isAuthenticated } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDoctors = async () => {
      try {
        const data = await publicAPI.getDoctorsBrief();
        if (isMounted) {
          setDoctors(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load doctors");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDoctors();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const specialties = useMemo(() => {
    const grouped = new Map();
    doctors.forEach((doctor) => {
      const key = getDoctorSpecialization(doctor);
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([name, count]) => ({
        name,
        description: `${count} available doctor${count > 1 ? "s" : ""}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) {
      return doctors;
    }

    return doctors.filter((doctor) => {
      const fullName = getDoctorDisplayName(doctor).toLowerCase();
      const specialization = getDoctorSpecialization(doctor).toLowerCase();
      return fullName.includes(query) || specialization.includes(query);
    });
  }, [doctors, debouncedSearchQuery]);

  return (
    <main className="page-shell">
      {/* Header */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <h1 className="page-title">Our Doctors</h1>
          <p className="page-subtitle">
            Browse verified doctors and open full professional profiles. Sign in
            when you are ready to book appointments.
          </p>
        </div>
      </section>

      {/* Doctors */}
      <section className="section-shell bg-gray-50">
        <div className="section-container">
          {/* Info Banner */}
          <div className="mb-6 rounded-xl border border-primary-100 bg-primary-50 p-4 sm:p-5">
            <p className="text-center text-sm text-primary-800 sm:text-[15px]">
              <strong>Note:</strong> Public users can view professional doctor
              profiles.
              {!isAuthenticated && (
                <>
                  {" "}
                  For booking features,{" "}
                  <Link
                    to="/login"
                    state={{ from: { pathname: "/patient/appointments" } }}
                    className="font-semibold underline"
                    onClick={() => trackEvent("doctor_list_login_click")}
                  >
                    log in
                  </Link>{" "}
                  or{" "}
                  <Link
                    to="/register"
                    className="font-semibold underline"
                    onClick={() => trackEvent("doctor_list_register_click")}
                  >
                    register
                  </Link>
                  .
                </>
              )}
            </p>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Available Doctors
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-gray-500">
              Discover available doctors by specialty, location, and experience.
            </p>
          </div>

          {!loading && !error && (
            <div className="mx-auto mt-4 max-w-xl">
              <label htmlFor="doctor-search" className="sr-only">
                Search doctors by name or specialization
              </label>
              <input
                id="doctor-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or specialization"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none ring-primary-200 transition focus:border-primary-500 focus:ring-2"
              />
            </div>
          )}

          {loading && (
            <div className="mt-6 text-center text-gray-600">
              Loading doctors...
            </div>
          )}
          {error && (
            <div className="mt-6 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredDoctors.map((doctor) => (
                <div
                  key={doctor.doctorId}
                  className="group card-surface card-hover"
                >
                  <div className="flex items-center gap-3">
                    <AvatarCircle
                      profile={doctor}
                      sizeClassName="w-12 h-12"
                      textClassName="text-sm"
                      alt={`Dr. ${getDoctorDisplayName(doctor)}`}
                    />
                    <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                      Dr. {getDoctorDisplayName(doctor)}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm font-medium text-primary-700">
                    {getDoctorSpecialization(doctor)}
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between gap-2">
                      <StarRating
                        rating={Math.round(getDoctorAverageRating(doctor))}
                        size="sm"
                      />
                      <span className="text-xs font-medium text-amber-700">
                        {getDoctorAverageRating(doctor).toFixed(1)} (
                        {getDoctorTotalRatings(doctor)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-primary-600" />
                      <span>
                        {getDoctorExperience(doctor)} years experience
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary-600" />
                      <span>{doctor.location || "Bangladesh"}</span>
                    </div>
                  </div>
                  <p className="mt-5 text-xs text-gray-500">
                    Sign in to view full profile details and book appointments.
                  </p>
                  <Link
                    to={`/doctors/${doctor.doctorId}`}
                    className="mt-4 inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                  >
                    View Profile
                  </Link>
                </div>
              ))}
            </div>
          )}
          {!loading && !error && filteredDoctors.length === 0 && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white px-4 py-5 text-center text-sm text-gray-600">
              No doctors found for that name or specialization.
            </div>
          )}
        </div>
      </section>

      {/* Specialties */}
      <section className="section-shell bg-white">
        <div className="section-container">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Our Specialties
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-gray-500">
              A quick overview of major specialties available on VitaBridge.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {specialties.map((specialty) => (
              <div
                key={specialty.name}
                className="group card-surface card-hover"
              >
                <div className="icon-chip mb-4 transition-colors group-hover:bg-primary-100">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {specialty.name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {specialty.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default DoctorList;
