import { Navigate } from 'react-router-dom'
import {
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleFilled,
  MailOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext.js'
import PublicFooter from '../components/PublicFooter.jsx'
import Logo from '../components/Logo.jsx'
import Button from '../ui/Button.jsx'
import { FullscreenSpinner } from '../ui/Spinner.jsx'
import { homePathForRole } from '../utils/roles.js'

function Feature({ icon, title, text, className }) {
  return (
    <div
      className={`group rounded-2xl border border-line bg-white/90 p-5 text-left shadow-[var(--shadow-card)] backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-[var(--shadow-lift)] ${className ?? ''}`}
    >
      <div className="mb-3 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent text-xl text-white shadow-[var(--shadow-brand)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
        {icon}
      </div>
      <div className="mb-1.5 text-[15px] font-bold text-ink">{title}</div>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  )
}

const FLOW = ['Recruiter', 'Sales Lead', 'HR · Contracts', 'Payroll · Accounts', 'DOJ']

export default function Landing() {
  const { user, loading } = useAuth()

  if (loading) return <FullscreenSpinner />
  if (user) return <Navigate to={homePathForRole(user.role)} replace />

  return (
    <div className="oi-landing relative overflow-hidden">
      {/* decorative floating orbs */}
      <span className="oi-orb" style={{ width: 340, height: 340, top: -90, left: -70, background: 'rgba(99,102,241,0.22)' }} />
      <span className="oi-orb" style={{ width: 300, height: 300, bottom: -70, right: -50, background: 'rgba(139,92,246,0.2)', animationDelay: '1.6s' }} />

      {/* top bar */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-5xl text-center">
          {/* The company logo, centered and gently floating over a soft glow */}
          <div className="oi-fade-up mb-6 flex justify-center">
            <div className="oi-logo-stage">
              <span className="oi-logo-glow" aria-hidden="true" />
              <Logo className="oi-logo-float" height={92} />
            </div>
          </div>

          <div className="oi-fade-up oi-delay-1 mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/70 px-3.5 py-1 text-xs font-semibold text-brand backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand" /> One Intellectt
          </div>

          <h1 className="oi-fade-up oi-delay-1 mx-auto max-w-3xl text-[clamp(32px,5.4vw,54px)] font-extrabold leading-[1.08] tracking-tight text-ink">
            Candidate onboarding, <span className="oi-gradient-text">approved end to end.</span>
          </h1>

          <p className="oi-fade-up oi-delay-2 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600">
            Move a placed candidate from recruiter submission through Sales Lead, HR, Contracts, Payroll and Accounts —
            to final approval and Date of Joining. One clean, trackable workflow, with an email at every stage.
          </p>

          <div className="oi-fade-up oi-delay-3 mt-7 flex justify-center">
            <Button to="/login" variant="primary" size="lg">
              Sign in to continue
              <ArrowRightOutlined />
            </Button>
          </div>

          <div className="oi-fade-up oi-delay-3 mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
            {['Role-based access', 'Full audit trail', 'Email at every stage'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircleFilled className="text-success" />
                {t}
              </span>
            ))}
          </div>

          <div className="oi-fade-up oi-delay-4 mt-12 grid gap-4 text-left sm:grid-cols-3">
            <Feature icon={<AuditOutlined />} title="Staged approvals" text="Each role acts in turn, with a full audit trail of who approved what and when." />
            <Feature icon={<MailOutlined />} title="Email at every step" text="The right people are notified automatically as a candidate moves through the flow." />
            <Feature icon={<SafetyCertificateOutlined />} title="Role-based access" text="Recruiters, Sales Leads, HR, Contracts and the Super Admin each see exactly what they should." />
          </div>

          <div className="oi-fade-up oi-delay-4 mt-12">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-faint">The workflow</div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              {FLOW.map((step, i) => (
                <span key={step} className="flex items-center gap-2">
                  <span
                    className={
                      i === FLOW.length - 1
                        ? 'rounded-full bg-gradient-to-br from-brand to-accent px-3.5 py-1.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)]'
                        : 'rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm'
                    }
                  >
                    {step}
                  </span>
                  {i < FLOW.length - 1 && <RightOutlined className="text-xs text-faint" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
