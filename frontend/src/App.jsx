import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./pages/Services";
import AiDoctorSuggestionPublic from "./pages/AiDoctorSuggestionPublic";
import DoctorList from "./pages/DoctorList";
import DoctorProfile from "./pages/DoctorProfile";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";

// Role-specific dashboards
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageDoctors from "./pages/admin/ManageDoctors";
import AdminComplaints from "./pages/admin/Complaints";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminAppointment from "./pages/admin/Appointment";
import DailyReports from "./pages/admin/DailyReports";
import ManageUser from "./pages/admin/ManageUser";
import AdminPayment from "./pages/admin/Payment";
import PatientDashboard from "./pages/patient/PatientDashboard";
import FindDoctor from "./pages/patient/FindDoctor";
import AiDoctorSuggestion from "./pages/patient/AiDoctorSuggestion";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import MyAssistants from "./pages/doctor/MyAssistants";
import Schedule from "./pages/doctor/Schedule";
import DoctorMyAppointments from "./pages/doctor/MyAppointments";
import DoctorLiveQueue from "./pages/doctor/LiveQueue";
import DoctorReviews from "./pages/doctor/DoctorReviews";
import OfflineConsultationActions from "./pages/doctor/OfflineConsultationActions";
import PatientHealthTrends from "./pages/doctor/PatientHealthTrends";
import PrescriptionEditor from "./pages/doctor/PrescriptionEditor";
import AssistantDashboard from "./pages/assistant/AssistantDashboard";
import AssistantLiveQueue from "./pages/assistant/LiveQueue";
import PatientMyAppointments from "./pages/patient/MyAppointments";
import PatientLiveQueue from "./pages/patient/LiveQueue";
import MyDocuments from "./pages/patient/MyDocuments";
import HealthAnalysis from "./pages/patient/HealthAnalysis";
import HealthAnalysisTable from "./pages/patient/HealthAnalysisTable";
import PatientComplaints from "./pages/patient/Complaints";
import DoctorTelemedicineHub from "./pages/doctor/TelemedicineHub";
import PatientTelemedicineHub from "./pages/patient/TelemedicineHub";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import PaymentAlreadyConfirmed from "./pages/PaymentAlreadyConfirmed";
import PaymentInvoiceGate from "./pages/PaymentInvoiceGate";

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";
import DoctorJoinedConsultationNotifier from "./components/DoctorJoinedConsultationNotifier";
import QueueInProgressNotifier from "./components/QueueInProgressNotifier";
import { SidebarStateProvider } from "./components/SidebarStateContext";
import { PageTitleProvider } from "./components/PageTitleContext";
import { publicLinks } from "./constants/navigation";

function App() {
  const publicRoutes = [
    { path: "/", element: <Home /> },
    { path: "/about", element: <About /> },
    { path: "/services", element: <Services /> },
    { path: "/ai-doctor-suggestion", element: <AiDoctorSuggestionPublic /> },
    { path: "/doctors", element: <DoctorList /> },
    { path: "/doctors/:doctorId", element: <DoctorProfile /> },
    { path: "/contact", element: <Contact /> },
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },
    { path: "/payment/success", element: <PaymentSuccess /> },
    { path: "/payment/failed", element: <PaymentFailed /> },
    {
      path: "/payment/already-confirmed",
      element: <PaymentAlreadyConfirmed />,
    },
    { path: "/payment/:invoiceNo", element: <PaymentInvoiceGate /> },
  ];

  const protectedRoutes = [
    { path: "/profile", element: <Profile /> },
    { path: "/notifications", element: <Notifications /> },
    { path: "/admin/dashboard", element: <AdminDashboard /> },
    { path: "/admin/doctors", element: <ManageDoctors /> },
    {
      path: "/admin/doctors/add",
      element: <ManageUser initialSubpage="add-doctor" />,
    },
    {
      path: "/admin/add-admin",
      element: <ManageUser initialSubpage="add-admin" />,
    },
    { path: "/admin/complaints", element: <AdminComplaints /> },
    { path: "/admin/users", element: <ManageUser /> },
    {
      path: "/admin/users/add-doctor",
      element: <ManageUser initialSubpage="add-doctor" />,
    },
    {
      path: "/admin/users/add-admin",
      element: <ManageUser initialSubpage="add-admin" />,
    },
    { path: "/admin/appointments", element: <AdminAppointment /> },
    { path: "/admin/payments", element: <AdminPayment /> },
    { path: "/admin/reports", element: <DailyReports /> },
    { path: "/admin/profile", element: <AdminProfile /> },
    { path: "/patient/dashboard", element: <PatientDashboard /> },
    { path: "/patient/documents", element: <MyDocuments /> },
    { path: "/patient/health-analysis", element: <HealthAnalysis /> },
    {
      path: "/patient/health-analysis/table",
      element: <HealthAnalysisTable />,
    },
    { path: "/patient/find-doctor", element: <FindDoctor /> },
    {
      path: "/patient/ai-doctor-suggestion",
      element: <AiDoctorSuggestion />,
    },
    { path: "/patient/appointments", element: <PatientMyAppointments /> },
    { path: "/patient/live-queue", element: <PatientLiveQueue /> },
    { path: "/patient/complaints", element: <PatientComplaints /> },
    { path: "/patient/telemedicine", element: <PatientTelemedicineHub /> },
    { path: "/doctor/dashboard", element: <DoctorDashboard /> },
    { path: "/doctor/schedule", element: <Schedule /> },
    { path: "/doctor/appointments", element: <DoctorMyAppointments /> },
    {
      path: "/doctor/appointments/:appointmentId/prescription",
      element: <PrescriptionEditor />,
    },
    {
      path: "/doctor/appointments/:appointmentId/offline",
      element: <OfflineConsultationActions />,
    },
    {
      path: "/doctor/appointments/:appointmentId/patient-health-trends/:patientId",
      element: <PatientHealthTrends />,
    },
    { path: "/doctor/live-queue", element: <DoctorLiveQueue /> },
    { path: "/doctor/reviews", element: <DoctorReviews /> },
    { path: "/doctor/telemedicine", element: <DoctorTelemedicineHub /> },
    { path: "/doctor/assistants", element: <MyAssistants /> },
    { path: "/assistant/dashboard", element: <AssistantDashboard /> },
    { path: "/assistant/schedule", element: <Schedule isAssistantMode /> },
    {
      path: "/assistant/appointments",
      element: <DoctorMyAppointments isAssistantMode />,
    },
    {
      path: "/assistant/reviews",
      element: <DoctorReviews isAssistantMode />,
    },
    { path: "/assistant/live-queue", element: <AssistantLiveQueue /> },
  ];

  return (
    <Router>
      <AuthProvider>
        <SidebarStateProvider>
          <PageTitleProvider>
            <ToastProvider>
              <DoctorJoinedConsultationNotifier />
              <QueueInProgressNotifier />
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <Navbar links={publicLinks} />
              <div id="main-content" tabIndex={-1}>
                <Routes>
                  {publicRoutes.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={route.element}
                    />
                  ))}
                  {protectedRoutes.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<ProtectedRoute>{route.element}</ProtectedRoute>}
                    />
                  ))}
                </Routes>
              </div>
            </ToastProvider>
          </PageTitleProvider>
        </SidebarStateProvider>
      </AuthProvider>
    </Router>
  );
}
export default App;
