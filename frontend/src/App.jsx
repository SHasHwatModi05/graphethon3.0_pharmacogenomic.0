// App.jsx — Multi-role routing hub
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import DoctorDashboard from './pages/DoctorDashboard';
import NurseDashboard from './pages/NurseDashboard';
import PatientDashboard from './pages/PatientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import './App.css';

function AuthenticatedLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

import useDarkMode from './hooks/useDarkMode';

export default function App() {
  useDarkMode();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Doctor routes */}
      <Route
        path="/doctor/*"
        element={
          <ProtectedRoute allowedRoles={['doctor', 'admin']}>
            <AuthenticatedLayout>
              <DoctorDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Doctor analytics */}
      <Route
        path="/doctor/analytics"
        element={
          <ProtectedRoute allowedRoles={['doctor', 'admin']}>
            <AuthenticatedLayout>
              <AnalyticsDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Nurse routes */}
      <Route
        path="/nurse/*"
        element={
          <ProtectedRoute allowedRoles={['nurse', 'admin']}>
            <AuthenticatedLayout>
              <NurseDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Patient routes */}
      <Route
        path="/patient/*"
        element={
          <ProtectedRoute allowedRoles={['patient', 'admin']}>
            <AuthenticatedLayout>
              <PatientDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuthenticatedLayout>
              <AdminDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}