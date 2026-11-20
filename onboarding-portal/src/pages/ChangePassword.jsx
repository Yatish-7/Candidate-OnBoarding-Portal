import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import { Alert, Button, Card, Field, FullscreenSpinner, PasswordInput, useToast } from '../ui/index.js'
import { changePassword } from '../api/auth.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { PASSWORD_HINT, validatePassword } from '../utils/passwordRules.js'
import { homePathForRole } from '../utils/roles.js'

// "Change password" for a signed-in user. Also the page everyone lands on after their
// first sign-in (until they choose their own password the backend refuses everything else).
export default function ChangePassword() {
  const { user, loading, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [values, setValues] = useState({ currentPassword: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/login" replace />

  const forced = user.mustChangePassword
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))

  function validate() {
    const next = {}
    if (!values.currentPassword) next.currentPassword = 'Enter your current password'
    const pw = validatePassword(values.password, 'Enter a new password')
    if (pw) next.password = pw
    else if (values.password === values.currentPassword) next.password = 'Choose a different password from the current one'
    if (!values.confirm) next.confirm = 'Re-enter the new password'
    else if (values.confirm !== values.password) next.confirm = 'The passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await changePassword(values.currentPassword, values.password)
      await refreshUser()
      toast.success('Your password has been changed')
      navigate(homePathForRole(user.role), { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change the password'))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
          <Card>
            <h1 className="text-xl font-semibold text-ink">{forced ? 'Choose your own password' : 'Change password'}</h1>
            {forced ? (
              <Alert
                tone="info"
                className="mb-5 mt-3"
                title="Your password was set by an administrator."
                message="For your security, choose a new password that only you know before continuing."
              />
            ) : (
              <p className="mb-5 mt-1 text-sm text-muted">Signed in as {user.email}. Other devices will be signed out.</p>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Field label={forced ? 'Temporary password' : 'Current password'} required error={errors.currentPassword}>
                <PasswordInput size="lg" autoComplete="current-password" value={values.currentPassword} invalid={!!errors.currentPassword} onChange={set('currentPassword')} />
              </Field>
              <Field label="New password" required error={errors.password} hint={!errors.password && PASSWORD_HINT}>
                <PasswordInput size="lg" autoComplete="new-password" value={values.password} invalid={!!errors.password} onChange={set('password')} />
              </Field>
              <Field label="Confirm new password" required error={errors.confirm}>
                <PasswordInput size="lg" autoComplete="new-password" value={values.confirm} invalid={!!errors.confirm} onChange={set('confirm')} />
              </Field>
              <Button type="submit" variant="primary" size="lg" block loading={submitting}>
                Change password
              </Button>
            </form>
          </Card>
          <div className="mt-4 text-center">
            {forced ? (
              <button
                type="button"
                className="text-[13px] text-muted hover:text-ink"
                onClick={() => logout().then(() => navigate('/login'))}
              >
                Sign out instead
              </button>
            ) : (
              <Link to={homePathForRole(user.role)} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
                <ArrowLeftOutlined /> Back to the portal
              </Link>
            )}
          </div>
    </AuthShell>
  )
}
