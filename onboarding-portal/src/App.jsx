import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import CandidateList from './pages/CandidateList.jsx'
import CandidateNew from './pages/CandidateNew.jsx'
import CandidateDetail from './pages/CandidateDetail.jsx'
import CandidateEdit from './pages/CandidateEdit.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import UserManagement from './pages/UserManagement.jsx'
import TeamManagement from './pages/TeamManagement.jsx'
import AuditLog from './pages/AuditLog.jsx'
import NotFound from './pages/NotFound.jsx'
import { CANDIDATE_ROLES } from './utils/roles.js'

// All the pages of the app and the URL each one lives at.
export default function App() {
  return (
    <Routes>
      {/* Public pages (no sidebar): the marketing landing page and the login form */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Signed-in users only (the page checks); outside the layout so a forced change shows nothing else */}
      <Route path="/change-password" element={<ChangePassword />} />

      {/* Every route nested here needs a logged-in user and is shown inside AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Candidate pages are for the workflow roles; Admin (users/teams only) is blocked */}
        <Route
          path="/candidates"
          element={
            <ProtectedRoute roles={CANDIDATE_ROLES}>
              <CandidateList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidates/new"
          element={
            <ProtectedRoute roles={['RECRUITER']}>
              <CandidateNew />
            </ProtectedRoute>
          }
        />
        {/* ":id" is a placeholder: /candidates/7 gives id = "7" */}
        <Route
          path="/candidates/:id"
          element={
            <ProtectedRoute roles={CANDIDATE_ROLES}>
              <CandidateDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidates/:id/edit"
          element={
            <ProtectedRoute roles={['HR']}>
              <CandidateEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/teams"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'SALES_LEAD', 'SALES_MANAGER']}>
              <TeamManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
