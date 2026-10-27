import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, App as AntApp, Button, Col, Form, Grid, Input, Row, Select, Spin, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import Logo from '../components/Logo.jsx'
import PublicFooter from '../components/PublicFooter.jsx'
import { useAuth } from '../context/AuthContext.js'
import { getMockUserOptions, MOCK_PASSWORD } from '../mocks/data.js'
import { getErrorMessage } from '../utils/errors.js'
import { homePathForRole } from '../utils/roles.js'
import { USE_MOCKS } from '../utils/env.js'
import { companyEmailRule } from '../utils/emailDomains.js'
import { clearSignedOutReason, getSignedOutReason } from '../utils/session.js'

// Left half of the login page (hidden on phones): the brand, styled like the
// landing hero — the logo floats over a soft brand glow on a light, airy panel
// (no white card), so the company mark reads cleanly and not dull.
function BrandPanel() {
  return (
    <div
      style={{
        height: '100%',
        padding: 56,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 20,
        borderRight: '1px solid #e8edf3',
        background:
          'radial-gradient(700px 380px at 22% 8%, rgba(43, 76, 155, 0.12), transparent 60%),' +
          'radial-gradient(560px 360px at 12% 70%, rgba(28, 159, 217, 0.1), transparent 60%),' +
          'radial-gradient(620px 380px at 90% 92%, rgba(225, 53, 42, 0.07), transparent 60%),' +
          '#f7f9fc',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div className="oi-logo-stage">
          <span className="oi-logo-glow" aria-hidden="true" />
          <Logo className="oi-logo-float" height={92} />
        </div>
      </div>
      <Typography.Title level={2} style={{ color: '#0f172a', margin: '4px 0 0', maxWidth: 460, lineHeight: 1.25 }}>
        Candidate onboarding, start to finish.
      </Typography.Title>
      <Typography.Paragraph style={{ color: '#475569', fontSize: 16, maxWidth: 450, margin: 0 }}>
        Submit, review and approve placed candidates — Sales Lead, HR, Contracts and Accounts, all in one clean workflow.
      </Typography.Paragraph>
    </div>
  )
}

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = AntApp.useApp()
  // Form.useForm gives us a handle to fill in fields from code (used by the mock-user picker)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  // Why the user was just signed out, if anything (read once, then cleared)
  const [signedOutReason] = useState(getSignedOutReason)
  useEffect(() => clearSignedOutReason(), [])
  // screens.md is true on tablets and wider, where the brand panel (with its logo) is visible
  const screens = Grid.useBreakpoint()

  if (loading) {
    return <Spin fullscreen />
  }

  // Already logged in? Skip the login page.
  if (user) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  // Runs only when all fields pass validation
  async function handleFinish(values) {
    setSubmitting(true)
    try {
      const loggedIn = await login(values.email, values.password)
      const home = homePathForRole(loggedIn.role)
      // Go back to the page they tried to open before being sent to login (or their home)
      navigate(location.state?.from?.pathname ?? home, { replace: true })
    } catch (error) {
      message.error(getErrorMessage(error, 'Login failed'))
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <Row style={{ flex: 1 }}>
        {/* xs={0} hides this column on phones */}
        <Col xs={0} md={12} lg={13}>
          <BrandPanel />
        </Col>

        <Col
          xs={24}
          md={12}
          lg={11}
          style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}
        >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380 }} className="oi-fade-up">
          <Link to="/" style={{ color: '#94a3b8', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
            <ArrowLeftOutlined /> Back to home
          </Link>
          {/* On phones the brand panel is hidden, so show the logo here instead */}
          {!screens.md && (
            <div style={{ marginBottom: 32 }}>
              <Logo size="md" />
            </div>
          )}
          {/* Why they were signed out (idle timeout, signed in elsewhere, ...) */}
          {signedOutReason && (
            <Alert type="info" showIcon closable title={signedOutReason} style={{ marginBottom: 20 }} />
          )}
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Welcome back
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>
            Sign in with your work email to continue.
          </Typography.Paragraph>

          <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
                companyEmailRule,
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="you@intellectt.com" autoComplete="username" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>

            <div style={{ textAlign: 'right', margin: '-8px 0 16px' }}>
              <Link to="/forgot-password" style={{ fontSize: 13 }}>
                Forgot password?
              </Link>
            </div>

            <Button type="primary" htmlType="submit" block loading={submitting}>
              Sign in
            </Button>
          </Form>

          {/* Acceptable-use notice shown before sign-in */}
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 20, marginBottom: 0, textAlign: 'center' }}>
            For authorized Intellectt users only. Sign-ins and changes are logged, and
            candidate data must be used only for onboarding.
          </Typography.Paragraph>

          {USE_MOCKS && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 28 }}
              title="Mock mode"
              description={
                <>
                  <div style={{ marginBottom: 8 }}>
                    Every mock user's password is <b>{MOCK_PASSWORD}</b>. Pick one to fill the form:
                  </div>
                  <Select
                    placeholder="Choose a mock user"
                    options={getMockUserOptions()}
                    style={{ width: '100%' }}
                    onChange={(email) => form.setFieldsValue({ email, password: MOCK_PASSWORD })}
                  />
                </>
              }
            />
          )}
        </div>
        </div>
        <PublicFooter />
        </Col>
      </Row>
    </div>
  )
}
