// Footer bar for the public pages (landing + login).
export default function PublicFooter({ onDark = false }) {
  const color = onDark ? 'rgba(226, 232, 240, 0.72)' : '#94a3b8'
  const border = onDark ? 'rgba(255, 255, 255, 0.12)' : '#e8ecf3'
  return (
    <footer
      style={{
        textAlign: 'center',
        padding: '16px 24px',
        color,
        fontSize: 13,
        borderTop: `1px solid ${border}`,
      }}
    >
      © {new Date().getFullYear()} One Intellectt · Candidate Onboarding Portal
    </footer>
  )
}
