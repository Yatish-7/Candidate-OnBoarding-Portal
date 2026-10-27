import { useEffect, useState } from 'react'
import { App as AntApp, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  addMember,
  assignSalesLead,
  assignSalesManager,
  createTeam,
  deleteTeam,
  listTeams,
  removeMember,
  removeSalesManager,
  updateTeam,
} from '../api/teams.js'
import { getUsersByRole } from '../api/users.js'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'

// Super Admin and Admin manage all teams (create / rename / delete / set lead / members).
// A Sales Lead sees only their own team and a Sales Manager only the teams under them;
// both can add/remove those teams' recruiters.
export default function TeamManagement() {
  const { message } = AntApp.useApp()
  const { user } = useAuth()
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  // null = no pop-up, 'new' = creating a team, or the team being renamed
  const [formOpen, setFormOpen] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  // Which team rows are expanded (kept across reloads so the row stays open after an action)
  const [expandedKeys, setExpandedKeys] = useState([])
  // Recruiters picked (but not yet added) per team: { [teamId]: [userId, ...] }
  const [toAdd, setToAdd] = useState({})

  function load() {
    // Only the admins may list Sales Managers (to put one over a team)
    return Promise.all([
      listTeams(),
      getUsersByRole('RECRUITER'),
      getUsersByRole('SALES_LEAD'),
      isAdmin ? getUsersByRole('SALES_MANAGER') : Promise.resolve([]),
    ])
      .then(([teamsData, recruiterUsers, leadUsers, managerUsers]) => {
        setTeams(teamsData)
        setUsers([...recruiterUsers, ...leadUsers, ...managerUsers])
      })
      .catch((error) => message.error(getErrorMessage(error, 'Could not load teams')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fill the modal's fields whenever it opens (new = blank, otherwise the team's values)
  useEffect(() => {
    if (!formOpen) return
    if (formOpen === 'new') {
      form.setFieldsValue({ name: '', salesLeadId: undefined, salesManagerId: undefined })
    } else {
      form.setFieldsValue({
        name: formOpen.name,
        salesLeadId: formOpen.salesLead?.id,
        salesManagerId: formOpen.salesManager?.id,
      })
    }
  }, [formOpen, form])

  const salesLeads = users.filter((u) => u.role === 'SALES_LEAD' && u.active)
  const recruiters = users.filter((u) => u.role === 'RECRUITER' && u.active)
  const leadOptions = salesLeads.map((l) => ({ value: l.id, label: `${l.name} (${l.email})` }))
  const managerOptions = users
    .filter((u) => u.role === 'SALES_MANAGER' && u.active)
    .map((m) => ({ value: m.id, label: `${m.name} (${m.email})` }))

  // Wrap an action so it shows a success/error message and reloads the list.
  async function run(promise, okMessage, failMessage) {
    try {
      await promise
      message.success(okMessage)
      await load()
    } catch (error) {
      message.error(getErrorMessage(error, failMessage))
    }
  }

  // Add every recruiter picked for this team, then clear the picker.
  async function addSelected(team) {
    const ids = toAdd[team.id] || []
    if (!ids.length) return
    try {
      for (const userId of ids) {
        await addMember(team.id, userId)
      }
      setToAdd((current) => ({ ...current, [team.id]: [] }))
      message.success(ids.length === 1 ? 'Recruiter added' : `${ids.length} recruiters added`)
      await load()
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not add the recruiter(s)'))
    }
  }

  function openForm(team) {
    setFormOpen(team ?? 'new')
  }

  function closeForm() {
    setFormOpen(null)
    form.resetFields()
  }

  // Validate, save, then close — all in one flow so the dialog always closes on success.
  async function handleOk() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // validation errors are shown under the fields
    }
    const isNew = formOpen === 'new'
    setSaving(true)
    try {
      if (isNew) {
        await createTeam({
          name: values.name,
          salesLeadId: values.salesLeadId,
          salesManagerId: values.salesManagerId,
        })
      } else {
        await updateTeam(formOpen.id, {
          name: values.name,
          salesLeadId: values.salesLeadId,
          salesManagerId: values.salesManagerId,
        })
      }
      message.success(isNew ? 'Team created' : 'Team updated')
      closeForm()
      await load()
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not save the team'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'Team',
      dataIndex: 'name',
      render: (name) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Sales Lead',
      dataIndex: 'salesLead',
      render: (lead) => (lead ? lead.name : <Typography.Text type="secondary">— none —</Typography.Text>),
    },
    {
      title: 'Sales Manager',
      dataIndex: 'salesManager',
      render: (manager) => (manager ? manager.name : <Typography.Text type="secondary">— none —</Typography.Text>),
    },
    {
      title: 'Recruiters',
      key: 'count',
      render: (_, team) => team.members.filter((m) => m.role === 'RECRUITER').length,
    },
    // Create / rename / delete are Super Admin only.
    ...(isAdmin
      ? [
          {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, team) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openForm(team)}>
                  Rename
                </Button>
                <Popconfirm
                  title={`Delete "${team.name}"?`}
                  description="Its recruiters and candidates are unassigned (not deleted)."
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => run(deleteTeam(team.id), `Team "${team.name}" deleted`, 'Could not delete the team')}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  // A Sales Lead only sees their own team, a Sales Manager the teams under them; admins see all.
  const visibleTeams = isAdmin
    ? teams
    : teams.filter(
        (t) => t.salesLead?.id === user.id || t.salesManager?.id === user.id || t.id === user.teamId,
      )

  // Each expanded row manages that team's lead and recruiters.
  function expandedRow(team) {
    const teamRecruiters = team.members.filter((m) => m.role === 'RECRUITER')
    // A recruiter can only be added if they have no team yet (one team per recruiter).
    const addable = recruiters.filter((r) => !r.teamId)
    return (
      <Space orientation="vertical" size="large" style={{ width: '100%', padding: '4px 8px 12px' }}>
        {isAdmin ? (
          <div>
            <Typography.Text strong>Sales Lead</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', margin: '2px 0 8px' }}>
              The Sales Lead approves this team's candidates.
            </Typography.Text>
            <Select
              style={{ width: '100%', maxWidth: 520 }}
              placeholder="Choose a Sales Lead"
              value={team.salesLead?.id ?? undefined}
              options={leadOptions}
              onChange={(userId) => run(assignSalesLead(team.id, userId), 'Sales Lead updated', 'Could not set the lead')}
            />
          </div>
        ) : (
          <div>
            <Typography.Text strong>Sales Lead: </Typography.Text>
            <Typography.Text>{team.salesLead ? team.salesLead.name : '— none —'}</Typography.Text>
          </div>
        )}

        {isAdmin ? (
          <div>
            <Typography.Text strong>Sales Manager</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', margin: '2px 0 8px' }}>
              Oversees this team (and others) and can approve its candidates, just like the Sales Lead.
              Either one is enough.
            </Typography.Text>
            <Select
              allowClear
              style={{ width: '100%', maxWidth: 520 }}
              placeholder="Choose a Sales Manager"
              value={team.salesManager?.id ?? undefined}
              options={managerOptions}
              onChange={(userId) =>
                userId
                  ? run(assignSalesManager(team.id, userId), 'Sales Manager updated', 'Could not set the manager')
                  : run(removeSalesManager(team.id), 'Sales Manager removed', 'Could not remove the manager')
              }
            />
          </div>
        ) : (
          <div>
            <Typography.Text strong>Sales Manager: </Typography.Text>
            <Typography.Text>{team.salesManager ? team.salesManager.name : '— none —'}</Typography.Text>
          </div>
        )}

        <div>
          <Typography.Text strong>{`Recruiters (${teamRecruiters.length})`}</Typography.Text>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            style={{ marginTop: 8 }}
            locale={{ emptyText: 'No recruiters in this team yet' }}
            dataSource={teamRecruiters}
            columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Email', dataIndex: 'email' },
              {
                title: '',
                align: 'right',
                width: 110,
                render: (_, r) => (
                  <Popconfirm
                    title={`Remove ${r.name} from ${team.name}?`}
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => run(removeMember(team.id, r.id), 'Recruiter removed', 'Could not remove the recruiter')}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      Remove
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />

          {/* Pick one or more recruiters, then press Add — the row stays open so you can keep adding. */}
          <div style={{ marginTop: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
              Add recruiters
            </Typography.Text>
            {addable.length === 0 ? (
              <Typography.Text type="secondary">
                No unassigned recruiters available. A recruiter already in a team must be removed
                from it first (or create new recruiters on the Users page).
              </Typography.Text>
            ) : (
              <Space.Compact style={{ width: '100%', maxWidth: 520 }}>
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  style={{ flex: 1 }}
                  placeholder="Select one or more recruiters…"
                  value={toAdd[team.id] || []}
                  onChange={(value) => setToAdd((current) => ({ ...current, [team.id]: value }))}
                  options={addable.map((r) => ({ value: r.id, label: `${r.name} (${r.email})` }))}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!(toAdd[team.id] || []).length}
                  onClick={() => addSelected(team)}
                >
                  Add
                </Button>
              </Space.Compact>
            )}
          </div>
        </div>
      </Space>
    )
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Teams' : user.role === 'SALES_MANAGER' ? 'My Teams' : 'My Team'}
        subtitle={
          isAdmin
            ? 'Create teams, assign a Sales Lead and Sales Manager, and manage recruiters.'
            : 'Add or remove the recruiters in your team(s).'
        }
        extra={
          isAdmin ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
              Create team
            </Button>
          ) : null
        }
      />

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={visibleTeams}
          loading={loading}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
            expandedRowRender: expandedRow,
          }}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} teams` }}
        />
      </Card>

      <Modal
        open={!!formOpen}
        title={formOpen === 'new' ? 'Create team' : 'Rename team'}
        okText={formOpen === 'new' ? 'Create' : 'Save'}
        confirmLoading={saving}
        onOk={handleOk}
        onCancel={closeForm}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Team name"
            rules={[{ required: true, whitespace: true, message: 'Enter a team name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="salesLeadId" label="Sales Lead (optional)">
            <Select allowClear placeholder="Choose a Sales Lead" options={leadOptions} />
          </Form.Item>
          <Form.Item
            name="salesManagerId"
            label="Sales Manager (optional)"
            extra="A Sales Manager can oversee several teams. To take one away, use the team's row."
          >
            <Select allowClear placeholder="Choose a Sales Manager" options={managerOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
