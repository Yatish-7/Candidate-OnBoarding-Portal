import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from '../ui/Select.jsx'
import { useToast } from '../ui/feedback.jsx'
import { useAuth } from '../context/AuthContext.js'
import { getMockUserOptions, MOCK_PASSWORD } from '../mocks/data.js'
import { getErrorMessage } from '../utils/errors.js'
import { ROLE_LABELS } from '../utils/roles.js'

// DEV ONLY (mock mode): jump between mock users without logging out.
// It simply logs in as the chosen user, so it goes through the same flow as the login page.
export default function RoleSwitcher() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [options] = useState(getMockUserOptions)

  async function handleChange(email) {
    try {
      const newUser = await login(email, MOCK_PASSWORD)
      // Go home, because the current page might not be allowed for the new role
      navigate('/')
      toast.success(`Now signed in as ${newUser.name} (${ROLE_LABELS[newUser.role]})`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-faint">Dev:</span>
      <Select value={user.email} options={options} onChange={handleChange} size="sm" className="min-w-0 flex-1" />
    </div>
  )
}
