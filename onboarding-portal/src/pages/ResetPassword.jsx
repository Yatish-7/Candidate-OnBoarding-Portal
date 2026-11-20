import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import { Alert, Button, Card, Field, PasswordInput, useToast } from '../ui/index.js'
import { resetPassword } from '../api/auth.js'
import { getErrorMessage } from '../utils/errors.js'
import { PASSWORD_HINT, validatePassword } from '../utils/passwordRules.js'

// "Reset password" — reached from the emailed link (…/reset-password?token=XYZ).
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const toast = useToast()
  const [values, setValues] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))

  function validate() {
    const next = {}
    const pw = validatePassword(values.password, 'Enter a new password')
    if (pw) next.password = pw
    if (!values.confirm) next.confirm = 'Re-enter the password'
    else if (values.confirm !== values.password) next.confirm = 'The passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await resetPassword(token, values.password)
      setDone(true)
      toast.success('Password reset — you can now sign in')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not reset the password'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
          <Card>
            {!token ? (
              <>
                <h1 className="mb-2 text-xl font-semibold text-ink">Invalid reset link</h1>
                <Alert tone="error" title="This link is missing or invalid" message="Request a new password reset link to continue." />
                <Button variant="primary" block className="mt-4" onClick={() => navigate('/forgot-password')}>
                  Request a new link
                </Button>
              </>
            ) : done ? (
              <>
                <h1 className="mb-2 text-xl font-semibold text-ink">Password reset</h1>
                <Alert tone="success" title="All set" message="Your password has been changed. You can now sign in with your new password." />
                <Button variant="primary" block className="mt-4" onClick={() => navigate('/login')}>
                  Go to sign in
                </Button>
              </>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <h1 className="text-xl font-semibold text-ink">Choose a new password</h1>
                <p className="mb-5 mt-1 text-sm text-muted">Enter a new password for your account.</p>
                <div className="space-y-4">
                  <Field label="New password" required error={errors.password} hint={!errors.password && PASSWORD_HINT}>
                    <PasswordInput size="lg" autoComplete="new-password" value={values.password} invalid={!!errors.password} onChange={set('password')} />
                  </Field>
                  <Field label="Confirm password" required error={errors.confirm}>
                    <PasswordInput size="lg" autoComplete="new-password" value={values.confirm} invalid={!!errors.confirm} onChange={set('confirm')} />
                  </Field>
                </div>
                <Button type="submit" variant="primary" size="lg" block loading={submitting} className="mt-5">
                  Reset password
                </Button>
              </form>
            )}
          </Card>
          <div className="mt-4 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
              <ArrowLeftOutlined /> Back to sign in
            </Link>
          </div>
    </AuthShell>
  )
}
