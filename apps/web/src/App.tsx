import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CreateSalonPage } from './pages/CreateSalonPage';
import { CreateBarberPage } from './pages/CreateBarberPage';
import { CreateServicePage } from './pages/CreateServicePage';
import './App.css';
const Placeholder = ({ title, text }: { title: string; text: string }) => (
  <div className="empty-page">
    <h1>{title}</h1>
    <p>{text}</p>
  </div>
);
const dashboardRoles = ['SUPER_ADMIN', 'ADMIN', 'BARBER', 'CUSTOMER'] as const;
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute allowedRoles={[...dashboardRoles]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/salons/new" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><CreateSalonPage /></ProtectedRoute>} />
            <Route path="/services/new" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><CreateServicePage /></ProtectedRoute>} />
            <Route path="/barbers/new" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><CreateBarberPage /></ProtectedRoute>} />
            <Route
              path="/team"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                  <Placeholder
                    title="مدیریت تیم"
                    text="این بخش فقط برای مدیر مجموعه قابل مشاهده است."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <Placeholder
                  title="نوبت‌ها"
                  text="مدیریت نوبت‌ها در فاز بعدی تکمیل می‌شود."
                />
              }
            />
            <Route
              path="/customers"
              element={
                <Placeholder
                  title="مشتریان"
                  text="فهرست مشتریان به‌زودی اینجا قرار می‌گیرد."
                />
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
