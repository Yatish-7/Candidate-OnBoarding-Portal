import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Space, Spin, Typography } from 'antd'
import { ArrowRightOutlined, AuditOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext.js'
import Logo from '../components/Logo.jsx'
import PublicFooter from '../components/PublicFooter.jsx'
import { homePathForRole } from '../utils/roles.js'

function Feature({ icon, title, text }) {
  return (
    <div className="oi-feature">
      <div className="oi-feature-icon">{icon}</div>
      <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: 6, fontSize: 15.5 }}>{title}</div>
      <div style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.6 }}>{text}</div>
    </div>
  )
}

export default function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <Spin fullscreen />
  }
  // Already signed in? Go straight to the app.
  if (user) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  return (
    <div className="oi-landing">
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '56px 24px',
        }}
      >
        <div style={{ maxWidth: 900, width: '100%', textAlign: 'center' }}>
          {/* The company logo, gently floating over a soft glow */}
          <div className="oi-fade-up" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div className="oi-logo-stage">
              <span className="oi-logo-glow" aria-hidden="true" />
              <Logo className="oi-logo-float" height={104} />
            </div>
          </div>

          <div
            className="oi-fade-up oi-delay-1"
            style={{
              color: '#2563eb',
              fontWeight: 700,
              letterSpacing: '0.18em',
              fontSize: 13,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            One Intellectt
          </div>

          <Typography.Title
            className="oi-fade-up oi-delay-1"
            style={{ color: '#0f172a', fontSize: 'clamp(30px, 5.2vw, 50px)', margin: '0 0 10px', letterSpacing: '-0.02em' }}
          >
            Candidate Onboarding &amp; Approval Portal
          </Typography.Title>

          <Typography.Paragraph
            className="oi-fade-up oi-delay-2"
            style={{ color: '#475569', fontSize: 16, maxWidth: 640, margin: '0 auto 30px', lineHeight: 1.65 }}
          >
            Move a placed candidate from recruiter submission through Sales Lead, HR, Contracts, Payroll
            and Accounts — to final approval and Date of Joining. One clean, trackable workflow, with an
            email at every stage.
          </Typography.Paragraph>

          <div
            className="oi-fade-up oi-delay-3"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 36 }}
          >
            <Feature
              icon={<AuditOutlined />}
              title="Staged approvals"
              text="Each role acts in turn, with a full audit trail of who approved what and when."
            />
            <Feature
              icon={<MailOutlined />}
              title="Email at every step"
              text="The right people are notified automatically as a candidate moves through the flow."
            />
            <Feature
              icon={<SafetyCertificateOutlined />}
              title="Role-based access"
              text="Recruiters, Sales Leads, HR, Contracts and the Super Admin each see exactly what they should."
            />
          </div>

          <Button
            className="oi-fade-up oi-delay-4"
            type="primary"
            size="large"
            onClick={() => navigate('/login')}
            style={{ height: 50, padding: '0 30px', fontSize: 16, fontWeight: 600 }}
          >
            <Space>
              Sign in to continue
              <ArrowRightOutlined />
            </Space>
          </Button>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
