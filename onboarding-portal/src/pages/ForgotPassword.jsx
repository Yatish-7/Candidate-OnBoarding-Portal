import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, App as AntApp, Button, Card, Form, Input, Typography } from 'antd'
import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons'
import Logo from '../components/Logo.jsx'
import PublicFooter from '../components/PublicFooter.jsx'
import { requestPasswordReset } from '../api/auth.js'
import { getErrorMessage } from '../utils/errors.js'

// "Forgot password" — ask for an email; the backend emails a reset link if the
// account exists. We always show the same generic confirmation either way.
export default function ForgotPassword() {
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState(null) // the email we submitted (shows the success note)

  async function handleFinish(values) {
    setSubmitting(true)
    try {
      await requestPasswordReset(values.email)
      setSentTo(values.email)
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not send the reset link'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7fa' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420 }} className="oi-fade-up">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Logo height={44} />
          </div>

          <Card>
            {sentTo ? (
              <>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
                  Check your email
                </Typography.Title>
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message="Reset link sent"
                  description={
                    <>
                      If an account exists for <b>{sentTo}</b>, we&apos;ve emailed a link to reset your
                      password. It expires in 60 minutes.
                    </>
                  }
                />
                <Typography.Paragraph type="secondary" style={{ fontSize: 13, margin: '12px 0 0' }}>
                  Didn&apos;t get it? Check your spam folder, or{' '}
                  <a onClick={() => setSentTo(null)} style={{ cursor: 'pointer' }}>
                    try another email
                  </a>
                  .
                </Typography.Paragraph>
              </>
            ) : (
              <>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
                  Forgot your password?
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
                  Enter your work email and we&apos;ll send you a link to reset it.
                </Typography.Paragraph>

                <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email' },
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="you@intellectt.com" autoComplete="username" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={submitting}>
                    Send reset link
                  </Button>
                </Form>
              </>
            )}
          </Card>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/login" style={{ color: '#64748b', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeftOutlined /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
