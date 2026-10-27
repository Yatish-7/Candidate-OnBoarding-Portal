import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as AntApp, Select } from 'antd'
import { useAuth } from '../context/AuthContext.js'
import { getMockUserOptions, MOCK_PASSWORD } from '../mocks/data.js'
import { getErrorMessage } from '../utils/errors.js'
import { ROLE_LABELS } from '../utils/roles.js'

// DEV ONLY (mock mode): jump between mock users without logging out.
// It simply logs in as the chosen user, so it goes through the same flow as the login page.
export default function RoleSwitcher() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  // Re-read the user list each time the dropdown opens, so users the Super Admin
  // just added (or deactivated) show up correctly
  const [options, setOptions] = useState(getMockUserOptions)

  async function handleChange(email) {
    try {
      const newUser = await login(email, MOCK_PASSWORD)
      // Go home, because the current page might not be allowed for the new role
      navigate('/')
      message.success(`Now signed in as ${newUser.name} (${ROLE_LABELS[newUser.role]})`)
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  return (
    <Select
      value={user.email}
      options={options}
      onOpenChange={(open) => open && setOptions(getMockUserOptions())}
      onChange={handleChange}
      // Fills the space the header gives it (up to ~300px), and shrinks on phones
      style={{ flex: 1, minWidth: 0 }}
      popupMatchSelectWidth={false}
      prefix="Dev:"
    />
  )
}
