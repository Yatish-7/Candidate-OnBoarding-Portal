import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, App as AntApp, Button, Card, Form, Input, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import Logo from '../components/Logo.jsx'
import PublicFooter from '../components/PublicFooter.jsx'
import { resetPassword } from '../api/auth.js'
import { getErrorMessage } from '../utils/errors.js'
import { PASSWORD_HINT, passwordRules } from '../utils/passwordRules.js'

// "Reset password" — reached from the emailed link (…/reset-password?token=XYZ).
// Reads the token from the URL, takes a new password, and calls the backend.
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleFinish(values) {
    setSubmitting(true)
    try {
      await resetPassword(token, values.password)
      setDone(true)
      message.success('Password reset — you can now sign in')
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not reset the password'))
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
            {!token ? (
              <>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
                  Invalid reset link
                </Typography.Title>
                <Alert
                  type="error"
                  showIcon
                  message="This link is missing or invalid"
                  description="Request a new password reset link to continue."
                />
                <Button type="primary" block style={{ marginTop: 16 }} onClick={() => navigate('/forgot-password')}>
                  Request a new link
                </Button>
              </>
            ) : done ? (
              <>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
                  Password reset
                </Typography.Title>
                <Alert
                  type="success"
                  showIcon
                  message="All set"
                  description="Your password has been changed. You can now sign in with your new password."
                />
                <Button type="primary" block style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
                  Go to sign in
                </Button>
              </>
            ) : (
              <>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
                  Choose a new password
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
                  Enter a new password for your account.
                </Typography.Paragraph>

                <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
                  <Form.Item
                    label="New password"
                    name="password"
                    rules={passwordRules('Enter a new password')}
                    extra={PASSWORD_HINT}
                    hasFeedback
                  >
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                  </Form.Item>

                  <Form.Item
                    label="Confirm password"
                    name="confirm"
                    dependencies={['password']}
                    hasFeedback
                    rules={[
                      { required: true, message: 'Re-enter the password' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error('The passwords do not match'))
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" block loading={submitting}>
                    Reset password
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
