import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/auth'
import { LoginPage } from './pages/Login'
import { TherapistSetupPage } from './pages/TherapistSetup'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/Dashboard'
import { PatientsPage } from './pages/Patients'
import { PatientDetailPage } from './pages/PatientDetail'
import { PlanBuilderPage } from './pages/PlanBuilder'
import { ExerciseLibraryPage } from './pages/ExerciseLibrary'
import { ReviewQueuePage } from './pages/ReviewQueue'
import { ShortcutsPage } from './pages/Shortcuts'
import { MessagesPage } from './pages/Messages'
import { CompliancePage } from './pages/Compliance'
// Paciente
import { PatientLayout } from './components/PatientLayout'
import { PatientHomePage } from './pages/patient/Home'
import { PatientExercisePage } from './pages/patient/Exercise'
import { PatientHistoryPage } from './pages/patient/History'
import { PatientMessagesPage } from './pages/patient/Messages'
import { PatientConsentPage } from './pages/patient/Consent'
import { PatientLinkPage } from './pages/patient/Link'
import { JoinPage } from './pages/patient/Join'

const THERAPIST_ROLES = ['therapist', 'clinic_admin']
const PATIENT_ROLES = ['patient_adult', 'patient_senior', 'parent', 'caregiver']

function RoleRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <TherapistSetupPage />
  if (THERAPIST_ROLES.includes(profile.role)) return <Navigate to="/dashboard" replace />
  if (PATIENT_ROLES.includes(profile.role)) return <Navigate to="/patient" replace />
  return <div style={{ padding: 40 }}>Role desconhecido.</div>
}

function RequireTherapist({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <TherapistSetupPage />
  if (!THERAPIST_ROLES.includes(profile.role))
    return <div style={{ padding: 40, color: 'var(--error)' }}>Acesso reservado a terapeutas.</div>
  return <>{children}</>
}

function RequirePatient({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/patient/consent" replace />
  if (!PATIENT_ROLES.includes(profile.role))
    return <div style={{ padding: 40, color: 'var(--error)' }}>Acesso reservado a utentes.</div>
  return <>{children}</>
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" /></div>

  return (
    <Routes>
      <Route path="/login" element={session ? <RoleRedirect /> : <LoginPage />} />

      {/* Área terapeuta */}
      <Route path="/dashboard" element={<RequireTherapist><Layout /></RequireTherapist>}>
        <Route index element={<DashboardPage />} />
      </Route>
      <Route element={<RequireTherapist><Layout /></RequireTherapist>}>
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:patientId" element={<PatientDetailPage />} />
        <Route path="patients/:patientId/plan/new" element={<PlanBuilderPage />} />
        <Route path="patients/:patientId/plan/:planId" element={<PlanBuilderPage />} />
        <Route path="exercises" element={<ExerciseLibraryPage />} />
        <Route path="reviews" element={<ReviewQueuePage />} />
        <Route path="shortcuts" element={<ShortcutsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:patientId" element={<MessagesPage />} />
        <Route path="compliance" element={<CompliancePage />} />
      </Route>

      {/* Link de convite por email — público */}
      <Route path="/join" element={<JoinPage />} />

      {/* Área paciente — onboarding (sem perfil) */}
      <Route path="/patient/consent" element={<PatientConsentPage />} />
      <Route path="/patient/link" element={<PatientLinkPage />} />

      {/* Área paciente — app principal */}
      <Route path="/patient" element={<RequirePatient><PatientLayout /></RequirePatient>}>
        <Route index element={<PatientHomePage />} />
        <Route path="exercise/:exerciseId" element={<PatientExercisePage />} />
        <Route path="history" element={<PatientHistoryPage />} />
        <Route path="messages" element={<PatientMessagesPage />} />
      </Route>

      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
