import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

// Shown for any URL that doesn't match a route in App.jsx
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="Page not found"
      extra={<Button onClick={() => navigate('/candidates')}>Back to candidates</Button>}
    />
  )
}
