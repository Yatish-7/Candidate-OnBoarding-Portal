import { useState } from 'react'
import { createUser, updateUser } from '../api/users.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field from '../ui/Field.jsx'
import Select from '../ui/Select.jsx'
import { Input, PasswordInput } from '../ui/Input.jsx'
import { useToast } from '../ui/feedback.jsx'
import { useAuth } from '../context/AuthContext.js'
import { fieldErrorMap, getErrorMessage } from '../utils/errors.js'
import { RECRUITER_LOCATION_OPTIONS } from '../utils/options.js'
import { ROLE_OPTIONS, TEAM_ROLES } from '../utils/roles.js'
import { isAllowedEmail } from '../utils/emailDomains.js'
import { PASSWORD_HINT, validatePassword } from '../utils/passwordRules.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Pop-up to add a user (user = null) or edit one.
export default function UserFormModal({ user, teams, currentUserId, onCancel, onSaved }) {
  const [values, setValues] = useState(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'RECRUITER',
    location: user?.location ?? undefined,
    teamId: user?.teamId ?? undefined,
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const isEditingSelf = user?.id === currentUserId

  // An Admin manages every role except Super Admin, so hide that option for them.
  const roleOptions = currentUser.role === 'ADMIN' ? ROLE_OPTIONS.filter((o) => o.value !== 'SUPER_ADMIN') : ROLE_OPTIONS
  const needsTeam = TEAM_ROLES.includes(values.role)

  function set(name, value) {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  function validate() {
    const e = {}
    if (!values.name.trim()) e.name = 'Enter the full name'
    if (!values.email.trim()) e.email = 'Enter the work email'
    else if (!EMAIL_RE.test(values.email)) e.email = 'Enter a valid email'
    else if (!isAllowedEmail(values.email)) e.email = 'Please use your correct company email id (for example name@intellectt.com)'
    if (!values.role) e.role = 'Choose a role'
    if (!user) {
      const pw = validatePassword(values.password, 'Set a password for this user')
      if (pw) e.password = pw
    }
    return e
  }

  async function handleOk() {
    const found = validate()
    setErrors(found)
    if (Object.values(found).some(Boolean)) return

    const data = {
      name: values.name,
      email: values.email,
      role: values.role,
      teamId: needsTeam ? values.teamId ?? null : null,
      location: values.role === 'RECRUITER' ? values.location ?? null : null,
      active: user?.active ?? true,
    }
    if (!user) data.password = values.password

    setSaving(true)
    try {
      const saved = user ? await updateUser(user.id, data) : await createUser(data)
      toast.success(user ? 'User updated' : `${saved.name} added`)
      onSaved(saved)
    } catch (error) {
      const map = fieldErrorMap(error)
      if (map) setErrors(map)
      else toast.error(getErrorMessage(error, 'Could not save the user'))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={user ? `Edit ${user.name}` : 'Add user'}
      footer={
        <>
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleOk}>
            {user ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" required error={errors.name}>
          <Input placeholder="Priya Shah" value={values.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Work email" required error={errors.email} hint={!user && !errors.email ? 'They sign in with this email.' : undefined}>
          <Input placeholder="name@intellectt.com" value={values.email} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        {!user && (
          <Field
            label="Temporary password"
            required
            error={errors.password}
            hint={!errors.password ? 'Share it privately. They must replace it with their own at first sign-in.' : undefined}
          >
            <PasswordInput placeholder={PASSWORD_HINT} autoComplete="new-password" value={values.password} invalid={!!errors.password} onChange={(e) => set('password', e.target.value)} />
          </Field>
        )}
        <Field label="Role" required error={errors.role} hint={isEditingSelf ? "You can't change your own role." : undefined}>
          <Select options={roleOptions} value={values.role} disabled={isEditingSelf} onChange={(val) => set('role', val)} />
        </Field>
        {values.role === 'RECRUITER' && (
          <Field label="Location" hint="Shown automatically on every candidate this recruiter submits.">
            <Select allowClear placeholder="Choose their office" options={RECRUITER_LOCATION_OPTIONS} value={values.location} onChange={(val) => set('location', val)} />
          </Field>
        )}
        {needsTeam && (
          <Field
            label="Team (optional)"
            hint={
              values.role === 'SALES_LEAD'
                ? 'Optional — you can assign the team later from the Teams page (each team has one Sales Lead).'
                : 'Optional — you can add them to a team later from the Teams page.'
            }
          >
            <Select
              allowClear
              placeholder="Choose a team (optional)"
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
              value={values.teamId}
              onChange={(val) => set('teamId', val)}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}
