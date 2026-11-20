import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import Result from '../ui/Result.jsx'

// Shown for any URL that doesn't match a route in App.jsx
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="The page you were looking for doesn't exist or has moved."
      extra={<Button onClick={() => navigate('/candidates')}>Back to candidates</Button>}
    />
  )
}
