import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CreateAppointmentPage } from './pages/CreateAppointmentPage';
import { CreateBarberPage } from './pages/CreateBarberPage';
import { CreateSalonPage } from './pages/CreateSalonPage';
import { CreateServicePage } from './pages/CreateServicePage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { CustomerBookingPage } from './pages/CustomerBookingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TeamPage } from './pages/TeamPage';
import { SmsSettingsPage } from './pages/SmsSettingsPage';
import { RevenueReportPage } from './pages/RevenueReportPage';
import { BarberRevenuePage } from './pages/BarberRevenuePage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import './App.css';

const dashboardRoles = ['SUPER_ADMIN', 'ADMIN', 'BARBER', 'CUSTOMER'] as const;
const adminRoles = ['SUPER_ADMIN', 'ADMIN'] as const;

function SalonEntry() {
  const { slug } = useParams();
  return (
    <Navigate to={`/login?salon=${encodeURIComponent(slug ?? '')}`} replace />
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/s/:slug" element={<SalonEntry />} />
        <Route element={<ProtectedRoute allowedRoles={[...dashboardRoles]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/salons/new"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <CreateSalonPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services/new"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <CreateServicePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/barbers/new"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <CreateBarberPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <TeamPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles, 'BARBER']}>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/book" element={<CustomerBookingPage />} />
            <Route
              path="/appointments/new"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <CreateAppointmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route path="/my-revenue" element={<ProtectedRoute allowedRoles={['BARBER']}><BarberRevenuePage /></ProtectedRoute>} />
            <Route
              path="/reports/revenue"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <RevenueReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/notifications"
              element={<NotificationSettingsPage />}
            />
            <Route
              path="/settings/sms"
              element={
                <ProtectedRoute allowedRoles={[...adminRoles]}>
                  <SmsSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
