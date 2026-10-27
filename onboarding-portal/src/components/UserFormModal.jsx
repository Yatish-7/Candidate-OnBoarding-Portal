import { useState } from 'react'
import { App as AntApp, Form, Input, Modal, Select } from 'antd'
import { createUser, updateUser } from '../api/users.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage, showFieldErrors } from '../utils/errors.js'
import { RECRUITER_LOCATION_OPTIONS } from '../utils/options.js'
import { ROLE_OPTIONS, TEAM_ROLES } from '../utils/roles.js'
import { companyEmailRule } from '../utils/emailDomains.js'
import { PASSWORD_HINT, passwordRules } from '../utils/passwordRules.js'

// Pop-up to add a user (user = null) or edit one.
//   teams         → [{ id, name }] for the team dropdown
//   currentUserId → the logged-in admin, who can't change their own role
//   onSaved(user) → called with the saved user from the backend
export default function UserFormModal({ user, teams, currentUserId, onCancel, onSaved }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = AntApp.useApp()
  const { user: currentUser } = useAuth()
  const isEditingSelf = user?.id === currentUserId

  // An Admin manages every role except Super Admin, so hide that option for them.
  const roleOptions =
    currentUser.role === 'ADMIN'
      ? ROLE_OPTIONS.filter((option) => option.value !== 'SUPER_ADMIN')
      : ROLE_OPTIONS

  // Show the team field only for roles that belong to a team (Recruiter, Sales Lead)
  const role = Form.useWatch('role', form)
  const needsTeam = TEAM_ROLES.includes(role)

  async function handleOk() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // antd shows the problems under the fields
    }

    const data = {
      name: values.name,
      email: values.email,
      role: values.role,
      teamId: needsTeam ? values.teamId : null,
      location: role === 'RECRUITER' ? (values.location ?? null) : null,
      active: user?.active ?? true,
    }
    // Only new users get a password here (a temporary one: they must change it at first sign-in).
    if (!user) {
      data.password = values.password
    }

    setSaving(true)
    try {
      const saved = user ? await updateUser(user.id, data) : await createUser(data)
      message.success(user ? 'User updated' : `${saved.name} added`)
      onSaved(saved)
    } catch (error) {
      // Errors about a field (e.g. "email already exists") go under that field
      if (!showFieldErrors(form, error)) {
        message.error(getErrorMessage(error, 'Could not save the user'))
      }
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={user ? `Edit ${user.name}` : 'Add user'}
      okText={user ? 'Save changes' : 'Add user'}
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onCancel}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={user ?? { role: 'RECRUITER' }}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label="Full name"
          rules={[{ required: true, whitespace: true, message: 'Enter the full name' }]}
        >
          <Input placeholder="Priya Shah" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Work email"
          rules={[
            { required: true, message: 'Enter the work email' },
            { type: 'email', message: 'Enter a valid email' },
            companyEmailRule,
          ]}
          extra={user ? null : 'They sign in with this email.'}
        >
          <Input placeholder="name@intellectt.com" />
        </Form.Item>

        {/* Password is set by the admin at creation (the backend has no change-password flow yet) */}
        {!user && (
          <Form.Item
            name="password"
            label="Temporary password"
            rules={passwordRules('Set a password for this user')}
            extra="Share it with them privately. They must replace it with their own at first sign-in."
          >
            <Input.Password placeholder={PASSWORD_HINT} autoComplete="new-password" />
          </Form.Item>
        )}

        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: true, message: 'Choose a role' }]}
          extra={isEditingSelf ? "You can't change your own role." : null}
        >
          <Select options={roleOptions} disabled={isEditingSelf} />
        </Form.Item>

        {role === 'RECRUITER' && (
          <Form.Item
            name="location"
            label="Location"
            extra="Shown automatically on every candidate this recruiter submits."
          >
            <Select allowClear placeholder="Choose their office" options={RECRUITER_LOCATION_OPTIONS} />
          </Form.Item>
        )}

        {needsTeam && (
          <Form.Item
            name="teamId"
            label="Team (optional)"
            extra={
              role === 'SALES_LEAD'
                ? 'Optional — you can assign the team later from the Teams page (each team has one Sales Lead).'
                : 'Optional — you can add them to a team later from the Teams page.'
            }
          >
            <Select
              allowClear
              placeholder="Choose a team (optional)"
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
