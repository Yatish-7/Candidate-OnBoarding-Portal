import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, Typography } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { getMe } from '../api/auth.js'
import { useAuth } from '../context/AuthContext.js'
import { getIdleTimeoutMs, getLastActivity, markActivity, setSignedOutReason } from '../utils/session.js'

// What counts as "the user is still here"
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']
// Show the "still there?" warning this long before signing out
const WARNING_SECONDS = 60
// Sign out a minute before the server would, so "Stay signed in" always still works
const SAFETY_MARGIN_MS = 60 * 1000
// Both shrink for very short timeouts (e.g. when testing with 2-3 minutes)
const scaled = (ms, idleMs) => Math.min(ms, idleMs / 5)
// While the user is active, tell the server at most this often (keeps its session alive)
const PING_INTERVAL_MS = 30 * 1000

// Signs the user out after a period of inactivity, with a countdown warning first.
// Mounted once inside the signed-in layout. Activity in any tab counts (it's shared
// through localStorage), so working in one tab keeps the others signed in.
export default function SessionTimeout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(null) // null = no warning showing
  const warningOpen = useRef(false)
  const lastPing = useRef(Date.now())

  // Record activity (throttled) and keep the server-side session alive
  useEffect(() => {
    let lastWrite = 0
    function onActivity() {
      if (warningOpen.current) return // during the warning, only the button counts
      const now = Date.now()
      if (now - lastWrite > 5000) {
        markActivity(now)
        lastWrite = now
      }
      if (now - lastPing.current > PING_INTERVAL_MS) {
        lastPing.current = now
        getMe().catch(() => {}) // a 401 here is handled by the API client
      }
    }
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    return () => ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity))
  }, [])

  // Every second: how long until sign-out?
  useEffect(() => {
    const timer = setInterval(() => {
      const idleMs = getIdleTimeoutMs()
      const signOutAt = getLastActivity() + idleMs - scaled(SAFETY_MARGIN_MS, idleMs)
      const left = Math.ceil((signOutAt - Date.now()) / 1000)
      if (left <= 0) {
        clearInterval(timer)
        signOutForInactivity()
      } else if (left <= scaled(WARNING_SECONDS * 1000, idleMs) / 1000) {
        warningOpen.current = true
        setSecondsLeft(left)
      } else {
        warningOpen.current = false // activity in another tab pushed the deadline back
        setSecondsLeft(null)
      }
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOutForInactivity() {
    setSignedOutReason('You were signed out after a period of inactivity.')
    await logout('IDLE_TIMEOUT')
    navigate('/login', { replace: true })
  }

  function staySignedIn() {
    markActivity()
    lastPing.current = Date.now()
    getMe().catch(() => {})
    warningOpen.current = false
    setSecondsLeft(null)
  }

  async function signOutNow() {
    await logout()
    navigate('/login', { replace: true })
  }

  const minutes = Math.floor((secondsLeft ?? 0) / 60)
  const seconds = String((secondsLeft ?? 0) % 60).padStart(2, '0')

  return (
    <Modal
      open={secondsLeft !== null}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      title={
        <span>
          <ClockCircleOutlined style={{ color: '#d97706', marginRight: 8 }} />
          Are you still there?
        </span>
      }
      footer={[
        <Button key="out" onClick={signOutNow}>
          Sign out
        </Button>,
        <Button key="stay" type="primary" onClick={staySignedIn}>
          Stay signed in
        </Button>,
      ]}
    >
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        For your security you&apos;ll be signed out in{' '}
        <b>
          {minutes}:{seconds}
        </b>{' '}
        because there&apos;s been no activity.
      </Typography.Paragraph>
    </Modal>
  )
}
