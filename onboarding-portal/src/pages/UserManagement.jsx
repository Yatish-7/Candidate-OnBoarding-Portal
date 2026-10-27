import { useEffect, useState } from 'react'
import { App as AntApp, Button, Card, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, FilterOutlined, StopOutlined, UndoOutlined, UserAddOutlined } from '@ant-design/icons'
import { deleteUserPermanently, getTeams, getUsers, updateUser } from '../api/users.js'
import NameAvatar from '../components/NameAvatar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import UserFormModal from '../components/UserFormModal.jsx'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, formatRelative } from '../utils/format.js'
import { ROLE_LABELS, ROLE_OPTIONS } from '../utils/roles.js'

// A color per role tag, so roles are easy to tell apart in the table
const ROLE_COLORS = {
  RECRUITER: 'blue',
  SALES_LEAD: 'geekblue',
  SALES_MANAGER: 'lime',
  HR: 'cyan',
  CONTRACTS: 'purple',
  PAYROLL: 'gold',
  ACCOUNTS: 'orange',
  ADMIN: 'volcano',
  SUPER_ADMIN: 'magenta',
}

// Super Admin / Admin: everyone who can use the portal. Add people, edit their name,
// role or team, deactivate/reactivate them, or permanently delete them. (An Admin can
// manage every role except Super Admin.)
export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const { message } = AntApp.useApp()
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(null)
  // null = no pop-up, 'new' = adding a user, or the user object being edited
  const [editing, setEditing] = useState(null)

  // Load users and teams once when the page opens
  useEffect(() => {
    Promise.all([getUsers(), getTeams()])
      .then(([usersData, teamsData]) => {
        setUsers(usersData)
        setTeams(teamsData)
      })
      .catch((error) => message.error(getErrorMessage(error, 'Could not load users')))
      .finally(() => setLoading(false))
  }, [message])

  // Put a saved user into the list (replace it if it's already there, otherwise add it)
  function upsertUser(saved) {
    setUsers((previous) =>
      previous.some((u) => u.id === saved.id)
        ? previous.map((u) => (u.id === saved.id ? saved : u))
        : [...previous, saved],
    )
  }

  async function removeUser(user) {
    try {
      await deleteUserPermanently(user.id)
      setUsers((previous) => previous.filter((u) => u.id !== user.id))
      message.success(`${user.name} permanently deleted`)
    } catch (error) {
      const fieldMessage = error.response?.data?.message
      message.error(fieldMessage ?? getErrorMessage(error, 'Could not delete the user'))
    }
  }

  async function toggleActive(user) {
    try {
      const saved = await updateUser(user.id, { ...user, active: !user.active })
      upsertUser(saved)
      message.success(saved.active ? `${saved.name} can sign in again` : `${saved.name} deactivated`)
    } catch (error) {
      // e.g. re-activating a second Sales Lead for the same team
      const fieldMessage = error.response?.data?.errors?.[0]?.message
      message.error(fieldMessage ?? getErrorMessage(error, 'Could not update the user'))
    }
  }

  // Search and role filter happen here in the browser (the list is small)
  const term = search.trim().toLowerCase()
  const shownUsers = users.filter(
    (u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)),
  )

  const columns = [
    {
      title: 'User',
      dataIndex: 'name',
      render: (name, user) => (
        <Space>
          <NameAvatar name={name} />
          <div style={{ lineHeight: 1.3 }}>
            <Typography.Text strong>{name}</Typography.Text>
            {user.id === currentUser.id && <Tag style={{ marginLeft: 8 }}>You</Tag>}
            <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (role) => <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>,
    },
    { title: 'Team', dataIndex: 'teamName', render: (teamName) => teamName ?? '—' },
    { title: 'Location', dataIndex: 'location', render: (location) => location ?? '—' },
    {
      title: 'Status',
      dataIndex: 'active',
      render: (active, user) => (
        <Space size={4} wrap>
          {active ? <Tag color="green">Active</Tag> : <Tag>Deactivated</Tag>}
          {active && user.mustChangePassword && <Tag color="gold">Temporary password</Tag>}
        </Space>
      ),
    },
    {
      // For access reviews: accounts nobody has used in a long time should be deactivated
      title: 'Last sign-in',
      dataIndex: 'lastLoginAt',
      render: (at) => (at ? <span title={formatDateTime(at)}>{formatRelative(at)}</span> : 'Never'),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, user) => {
        const isSelf = user.id === currentUser.id
        // An Admin manages every role except Super Admin; a Super Admin manages all.
        const canManageRow =
          currentUser.role === 'SUPER_ADMIN' ||
          (currentUser.role === 'ADMIN' && user.role !== 'SUPER_ADMIN')
        if (!canManageRow) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        return (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(user)}>
              Edit
            </Button>
            {/* Popconfirm asks "are you sure?" before doing it. You can't deactivate yourself. */}
            {!isSelf && (
              <Popconfirm
                title={user.active ? `Deactivate ${user.name}?` : `Activate ${user.name}?`}
                description={user.active ? "They won't be able to sign in." : 'They will be able to sign in again.'}
                okText={user.active ? 'Deactivate' : 'Activate'}
                okButtonProps={{ danger: user.active }}
                onConfirm={() => toggleActive(user)}
              >
                <Button
                  size="small"
                  danger={user.active}
                  icon={user.active ? <StopOutlined /> : <UndoOutlined />}
                >
                  {user.active ? 'Deactivate' : 'Activate'}
                </Button>
              </Popconfirm>
            )}
            {/* Permanent delete — Super Admin / Admin. The backend blocks it if they submitted candidates. */}
            {!isSelf && (
              <Popconfirm
                title={`Permanently delete ${user.name}?`}
                description="This can't be undone. (Blocked if they've submitted candidates — deactivate instead.)"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => removeUser(user)}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone who can sign in to the portal, their role and team."
        extra={
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setEditing('new')}>
            Add user
          </Button>
        }
      />

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Input.Search
            placeholder="Search name or email"
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 240px', maxWidth: 340 }}
          />
          <Select
            placeholder="All roles"
            prefix={<FilterOutlined style={{ color: '#94a3b8' }} />}
            allowClear
            options={ROLE_OPTIONS}
            onChange={(value) => setRoleFilter(value ?? null)}
            style={{ flex: '1 1 200px', maxWidth: 240 }}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={shownUsers}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} users` }}
        />
      </Card>

      {editing && (
        <UserFormModal
          user={editing === 'new' ? null : editing}
          teams={teams}
          currentUserId={currentUser.id}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            upsertUser(saved)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
