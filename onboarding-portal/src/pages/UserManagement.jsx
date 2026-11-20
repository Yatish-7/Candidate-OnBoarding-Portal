import { useEffect, useState } from 'react'
import { DeleteOutlined, EditOutlined, FilterOutlined, StopOutlined, UndoOutlined, UserAddOutlined } from '@ant-design/icons'
import { deleteUserPermanently, getTeams, getUsers, updateUser } from '../api/users.js'
import NameAvatar from '../components/NameAvatar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import UserFormModal from '../components/UserFormModal.jsx'
import { Badge, Button, Card, Input, Select, Table, Pagination, Tooltip, useConfirm, useToast } from '../ui/index.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, formatRelative } from '../utils/format.js'
import { ROLE_LABELS, ROLE_OPTIONS } from '../utils/roles.js'
import { tagColor } from '../utils/colors.js'

// A color per role tag, so roles are easy to tell apart in the table
const ROLE_COLORS = {
  RECRUITER: 'blue',
  SALES_LEAD: 'geekblue',
  SALES_MANAGER: 'green',
  HR: 'cyan',
  CONTRACTS: 'purple',
  PAYROLL: 'gold',
  ACCOUNTS: 'orange',
  ADMIN: 'volcano',
  SUPER_ADMIN: 'magenta',
}

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(undefined)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    Promise.all([getUsers(), getTeams()])
      .then(([usersData, teamsData]) => {
        setUsers(usersData)
        setTeams(teamsData)
      })
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load users')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function upsertUser(saved) {
    setUsers((previous) =>
      previous.some((u) => u.id === saved.id) ? previous.map((u) => (u.id === saved.id ? saved : u)) : [...previous, saved],
    )
  }

  async function removeUser(user) {
    const ok = await confirm({
      title: `Permanently delete ${user.name}?`,
      description: "This can't be undone. (Blocked if they've submitted candidates — deactivate instead.)",
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteUserPermanently(user.id)
      setUsers((previous) => previous.filter((u) => u.id !== user.id))
      toast.success(`${user.name} permanently deleted`)
    } catch (error) {
      toast.error(error.response?.data?.message ?? getErrorMessage(error, 'Could not delete the user'))
    }
  }

  async function toggleActive(user) {
    const ok = await confirm({
      title: user.active ? `Deactivate ${user.name}?` : `Activate ${user.name}?`,
      description: user.active ? "They won't be able to sign in." : 'They will be able to sign in again.',
      confirmText: user.active ? 'Deactivate' : 'Activate',
      danger: user.active,
    })
    if (!ok) return
    try {
      const saved = await updateUser(user.id, { ...user, active: !user.active })
      upsertUser(saved)
      toast.success(saved.active ? `${saved.name} can sign in again` : `${saved.name} deactivated`)
    } catch (error) {
      toast.error(error.response?.data?.errors?.[0]?.message ?? getErrorMessage(error, 'Could not update the user'))
    }
  }

  const term = search.trim().toLowerCase()
  const shownUsers = users.filter(
    (u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)),
  )
  const pageUsers = shownUsers.slice(page * pageSize, (page + 1) * pageSize)

  const columns = [
    {
      title: 'User',
      dataIndex: 'name',
      render: (name, user) => (
        <div className="flex items-center gap-3">
          <NameAvatar name={name} />
          <div className="leading-tight">
            <span className="font-semibold text-ink">{name}</span>
            {user.id === currentUser.id && <Badge tone="neutral" className="ml-2">You</Badge>}
            <div className="text-xs text-muted">{user.email}</div>
          </div>
        </div>
      ),
    },
    { title: 'Role', dataIndex: 'role', render: (role) => <Badge color={tagColor(ROLE_COLORS[role])}>{ROLE_LABELS[role]}</Badge> },
    { title: 'Team', dataIndex: 'teamName', render: (teamName) => teamName ?? '—' },
    { title: 'Location', dataIndex: 'location', render: (location) => location ?? '—' },
    {
      title: 'Status',
      dataIndex: 'active',
      render: (active, user) => (
        <div className="flex flex-wrap gap-1">
          {active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>}
          {active && user.mustChangePassword && <Badge tone="warning">Temporary password</Badge>}
        </div>
      ),
    },
    {
      title: 'Last sign-in',
      dataIndex: 'lastLoginAt',
      render: (at) => (at ? <Tooltip title={formatDateTime(at)}><span className="text-muted">{formatRelative(at)}</span></Tooltip> : <span className="text-muted">Never</span>),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, user) => {
        const isSelf = user.id === currentUser.id
        const canManageRow = currentUser.role === 'SUPER_ADMIN' || (currentUser.role === 'ADMIN' && user.role !== 'SUPER_ADMIN')
        if (!canManageRow) return <span className="text-muted">—</span>
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" icon={<EditOutlined />} onClick={() => setEditing(user)}>
              Edit
            </Button>
            {!isSelf && (
              <Button size="sm" variant={user.active ? 'danger-ghost' : 'default'} icon={user.active ? <StopOutlined /> : <UndoOutlined />} onClick={() => toggleActive(user)}>
                {user.active ? 'Deactivate' : 'Activate'}
              </Button>
            )}
            {!isSelf && (
              <Button size="sm" variant="danger-ghost" icon={<DeleteOutlined />} onClick={() => removeUser(user)}>
                Delete
              </Button>
            )}
          </div>
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
          <Button variant="primary" icon={<UserAddOutlined />} onClick={() => setEditing('new')}>
            Add user
          </Button>
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-sm flex-1"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
          <Select
            className="w-full sm:w-56"
            placeholder="All roles"
            allowClear
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(value) => {
              setRoleFilter(value)
              setPage(0)
            }}
          />
          <span className="hidden items-center text-faint sm:flex">
            <FilterOutlined />
          </span>
        </div>

        <Table columns={columns} data={pageUsers} loading={loading} empty="No users match." />
        <Pagination
          current={page}
          pageSize={pageSize}
          total={shownUsers.length}
          label="users"
          onChange={(p, size) => {
            setPage(p)
            setPageSize(size)
          }}
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
