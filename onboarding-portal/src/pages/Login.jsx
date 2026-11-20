import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined, CheckOutlined, MailOutlined } from '@ant-design/icons'
import Logo from '../components/Logo.jsx'
import PublicFooter from '../components/PublicFooter.jsx'
import { Alert, Button, Field, FullscreenSpinner, Input, PasswordInput, Select, useToast } from '../ui/index.js'
import { useAuth } from '../context/AuthContext.js'
import { getMockUserOptions, MOCK_PASSWORD } from '../mocks/data.js'
import { getErrorMessage } from '../utils/errors.js'
import { homePathForRole } from '../utils/roles.js'
import { USE_MOCKS } from '../utils/env.js'
import { isAllowedEmail } from '../utils/emailDomains.js'
import { clearSignedOutReason, getSignedOutReason } from '../utils/session.js'

// Left half of the login page (hidden on phones): the brand, with the logo floating
// over a soft brand glow on a light, airy panel.
function BrandPanel() {
  return (
    <div
      className="relative hidden flex-col justify-center gap-6 overflow-hidden border-r border-line p-14 lg:flex"
      style={{
        background:
          'radial-gradient(700px 380px at 22% 8%, rgba(99, 102, 241, 0.14), transparent 60%),' +
          'radial-gradient(560px 360px at 12% 70%, rgba(139, 92, 246, 0.12), transparent 60%),' +
          'radial-gradient(620px 380px at 90% 92%, rgba(236, 72, 153, 0.06), transparent 60%),' +
          'transparent',
      }}
    >
      <span className="oi-orb" style={{ width: 300, height: 300, top: -80, left: -60, background: 'rgba(99,102,241,0.2)' }} />
      <span className="oi-orb" style={{ width: 260, height: 260, bottom: -70, left: 140, background: 'rgba(139,92,246,0.16)', animationDelay: '1.4s' }} />

      <div className="oi-logo-stage relative self-start">
        <span className="oi-logo-glow" aria-hidden="true" />
        <Logo className="oi-logo-float" height={88} />
      </div>
      <h2 className="relative max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight text-ink">
        Candidate onboarding, <span className="oi-gradient-text">start to finish.</span>
      </h2>
      <p className="relative max-w-md text-base leading-relaxed text-slate-600">
        Submit, review and approve placed candidates — Sales Lead, HR, Contracts and Accounts, all in one clean workflow.
      </p>
      <ul className="relative mt-1 space-y-2.5">
        {['Staged approvals with a full audit trail', 'Automatic email at every stage', 'Role-based access for every team'].map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
              <CheckOutlined className="text-[10px]" />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [signedOutReason] = useState(getSignedOutReason)
  const [showReason, setShowReason] = useState(true)
  useEffect(() => clearSignedOutReason(), [])

  if (loading) return <FullscreenSpinner />
  if (user) return <Navigate to={homePathForRole(user.role)} replace />

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))

  function validate() {
    const next = {}
    if (!values.email.trim()) next.email = 'Please enter your email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Please enter a valid email'
    else if (!isAllowedEmail(values.email)) next.email = 'Please use your correct company email id (for example name@intellectt.com)'
    if (!values.password) next.password = 'Please enter your password'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const loggedIn = await login(values.email, values.password)
      const home = homePathForRole(loggedIn.role)
      navigate(location.state?.from?.pathname ?? home, { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Login failed'))
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
      <BrandPanel />
      <div className="flex flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="oi-fade-up w-full max-w-sm">
            <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-faint hover:text-ink">
              <ArrowLeftOutlined /> Back to home
            </Link>
            {/* On phones the brand panel is hidden, so show the logo here instead */}
            <div className="mb-8 lg:hidden">
              <Logo size="md" />
            </div>
            {signedOutReason && showReason && (
              <Alert
                tone="info"
                className="mb-5"
                title={signedOutReason}
                action={
                  <button type="button" onClick={() => setShowReason(false)} className="text-faint hover:text-ink" aria-label="Dismiss">
                    ×
                  </button>
                }
              />
            )}
            <div className="rounded-2xl border border-line bg-white/80 p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-7">
            <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
            <p className="mb-7 mt-1 text-sm text-muted">Sign in with your work email to continue.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Field label="Email" required error={errors.email}>
                <Input
                  size="lg"
                  prefix={<MailOutlined />}
                  placeholder="you@intellectt.com"
                  autoComplete="username"
                  value={values.email}
                  invalid={!!errors.email}
                  onChange={set('email')}
                />
              </Field>
              <Field label="Password" required error={errors.password}>
                <PasswordInput size="lg" autoComplete="current-password" value={values.password} invalid={!!errors.password} onChange={set('password')} />
              </Field>
              <div className="-mt-1 text-right">
                <Link to="/forgot-password" className="text-[13px] text-brand hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" variant="primary" size="lg" block loading={submitting}>
                Sign in
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted">
              For authorized Intellectt users only. Sign-ins and changes are logged, and candidate data must be used only for onboarding.
            </p>
            </div>

            {USE_MOCKS && (
              <Alert
                tone="info"
                className="mt-7"
                title="Mock mode"
                message={
                  <div className="space-y-2">
                    <div>
                      Every mock user&apos;s password is <b>{MOCK_PASSWORD}</b>. Pick one to fill the form:
                    </div>
                    <Select
                      placeholder="Choose a mock user"
                      options={getMockUserOptions()}
                      onChange={(email) => setValues({ email, password: MOCK_PASSWORD })}
                    />
                  </div>
                }
              />
            )}
          </div>
        </div>
        <PublicFooter />
      </div>
    </div>
  )
}
