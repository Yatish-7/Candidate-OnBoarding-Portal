import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, App as AntApp, Button, Card, Form, Input, Spin, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import Logo from '../components/Logo.jsx'
import PublicFooter from '../components/PublicFooter.jsx'
import { changePassword } from '../api/auth.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { PASSWORD_HINT, passwordRules } from '../utils/passwordRules.js'
import { homePathForRole } from '../utils/roles.js'

// "Change password" for a signed-in user. Also the page everyone lands on after their
// first sign-in (or after an admin set a new password for them): until they choose
// their own password the backend refuses everything else.
export default function ChangePassword() {
  const { user, loading, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Spin fullscreen />
  if (!user) return <Navigate to="/login" replace />

  const forced = user.mustChangePassword

  async function handleFinish(values) {
    setSubmitting(true)
    try {
      await changePassword(values.currentPassword, values.password)
      await refreshUser() // picks up mustChangePassword = false
      message.success('Your password has been changed')
      navigate(homePathForRole(user.role), { replace: true })
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not change the password'))
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
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
              {forced ? 'Choose your own password' : 'Change password'}
            </Typography.Title>
            {forced ? (
              <Alert
                type="info"
                showIcon
                style={{ margin: '12px 0 20px' }}
                message="Your password was set by an administrator."
                description="For your security, choose a new password that only you know before continuing."
              />
            ) : (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
                Signed in as {user.email}. Other devices will be signed out.
              </Typography.Paragraph>
            )}

            <Form layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
              <Form.Item
                label={forced ? 'Temporary password' : 'Current password'}
                name="currentPassword"
                rules={[{ required: true, message: 'Enter your current password' }]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
              </Form.Item>

              <Form.Item
                label="New password"
                name="password"
                dependencies={['currentPassword']}
                rules={[
                  ...passwordRules('Enter a new password'),
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (value && value === getFieldValue('currentPassword')) {
                        return Promise.reject(new Error('Choose a different password from the current one'))
                      }
                      return Promise.resolve()
                    },
                  }),
                ]}
                extra={PASSWORD_HINT}
                hasFeedback
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>

              <Form.Item
                label="Confirm new password"
                name="confirm"
                dependencies={['password']}
                hasFeedback
                rules={[
                  { required: true, message: 'Re-enter the new password' },
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
                Change password
              </Button>
            </Form>
          </Card>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            {forced ? (
              <Button type="link" onClick={() => logout().then(() => navigate('/login'))} style={{ color: '#64748b' }}>
                Sign out instead
              </Button>
            ) : (
              <Link to={homePathForRole(user.role)} style={{ color: '#64748b', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeftOutlined /> Back to the portal
              </Link>
            )}
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
