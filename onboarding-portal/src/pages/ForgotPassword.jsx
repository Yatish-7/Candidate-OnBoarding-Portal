import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import { Alert, Button, Card, Field, Input, useToast } from '../ui/index.js'
import { requestPasswordReset } from '../api/auth.js'
import { getErrorMessage } from '../utils/errors.js'
import { isAllowedEmail } from '../utils/emailDomains.js'

// "Forgot password" — ask for an email; the backend emails a reset link if the
// account exists. We always show the same generic confirmation either way.
export default function ForgotPassword() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Please enter your email')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email')
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not send the reset link'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
          <Card>
            {sentTo ? (
              <>
                <h1 className="mb-2 text-xl font-semibold text-ink">Check your email</h1>
                <Alert
                  tone="success"
                  title="Reset link sent"
                  message={
                    <>
                      If an account exists for <b>{sentTo}</b>, we&apos;ve emailed a link to reset your password.
                      It expires in 60 minutes.
                    </>
                  }
                />
                <p className="mt-3 text-[13px] text-muted">
                  Didn&apos;t get it? Check your spam folder, or{' '}
                  <button type="button" className="text-brand hover:underline" onClick={() => setSentTo(null)}>
                    try another email
                  </button>
                  .
                </p>
              </>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <h1 className="text-xl font-semibold text-ink">Forgot your password?</h1>
                <p className="mb-5 mt-1 text-sm text-muted">
                  Enter your work email and we&apos;ll send you a link to reset it.
                </p>
                <Field label="Email" required error={error} htmlFor="fp-email">
                  <Input
                    id="fp-email"
                    size="lg"
                    prefix={<MailOutlined />}
                    placeholder="you@intellectt.com"
                    autoComplete="username"
                    value={email}
                    invalid={!!error}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Button type="submit" variant="primary" size="lg" block loading={submitting} className="mt-5">
                  Send reset link
                </Button>
                {!isAllowedEmail(email) && email.includes('@') && (
                  <p className="mt-2 text-xs text-muted">Use your company email (for example name@intellectt.com).</p>
                )}
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
