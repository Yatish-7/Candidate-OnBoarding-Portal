import PublicFooter from './PublicFooter.jsx'
import Logo from './Logo.jsx'

// Shared frame for the small public auth screens (forgot / reset / change password):
// a soft brand-tinted background with floating orbs, the company logo, and the footer.
export default function AuthShell({ children }) {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(700px 380px at 20% 6%, rgba(99, 102, 241, 0.12), transparent 60%),' +
          'radial-gradient(620px 360px at 85% 92%, rgba(139, 92, 246, 0.1), transparent 60%),' +
          'transparent',
      }}
    >
      <span className="oi-orb" style={{ width: 300, height: 300, top: -90, left: -60, background: 'rgba(99,102,241,0.18)' }} />
      <span className="oi-orb" style={{ width: 260, height: 260, bottom: -70, right: -40, background: 'rgba(139,92,246,0.16)', animationDelay: '1.4s' }} />

      <div className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="oi-fade-up w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="rounded-xl bg-white/70 px-4 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur">
              <Logo height={38} />
            </div>
          </div>
          {children}
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
