import { useEffect, useState } from 'react'
import { DeleteOutlined, DownOutlined, EditOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
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
import { Button, Card, CenterSpinner, Field, Input, Modal, Select, cn, useConfirm, useToast } from '../ui/index.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'

export default function TeamManagement() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(null) // null | 'new' | team
  const [teamForm, setTeamForm] = useState({ name: '', salesLeadId: undefined, salesManagerId: undefined })
  const [nameError, setNameError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(new Set())
  const [toAdd, setToAdd] = useState({})

  function load() {
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
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load teams')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recruiters = users.filter((u) => u.role === 'RECRUITER' && u.active)
  const leadOptions = users.filter((u) => u.role === 'SALES_LEAD' && u.active).map((l) => ({ value: l.id, label: `${l.name} (${l.email})` }))
  const managerOptions = users.filter((u) => u.role === 'SALES_MANAGER' && u.active).map((m) => ({ value: m.id, label: `${m.name} (${m.email})` }))

  async function run(promise, okMessage, failMessage) {
    try {
      await promise
      toast.success(okMessage)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error, failMessage))
    }
  }

  async function addSelected(team) {
    const ids = toAdd[team.id] || []
    if (!ids.length) return
    try {
      for (const userId of ids) await addMember(team.id, userId)
      setToAdd((current) => ({ ...current, [team.id]: [] }))
      toast.success(ids.length === 1 ? 'Recruiter added' : `${ids.length} recruiters added`)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add the recruiter(s)'))
    }
  }

  function openForm(team) {
    setNameError(null)
    setFormOpen(team ?? 'new')
    setTeamForm(
      team ? { name: team.name, salesLeadId: team.salesLead?.id, salesManagerId: team.salesManager?.id } : { name: '', salesLeadId: undefined, salesManagerId: undefined },
    )
  }

  async function handleOk() {
    if (!teamForm.name.trim()) return setNameError('Enter a team name')
    const isNew = formOpen === 'new'
    setSaving(true)
    try {
      const payload = { name: teamForm.name, salesLeadId: teamForm.salesLeadId, salesManagerId: teamForm.salesManagerId }
      if (isNew) await createTeam(payload)
      else await updateTeam(formOpen.id, payload)
      toast.success(isNew ? 'Team created' : 'Team updated')
      setFormOpen(null)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save the team'))
    } finally {
      setSaving(false)
    }
  }

  async function removeTeam(team) {
    const ok = await confirm({
      title: `Delete "${team.name}"?`,
      description: 'Its recruiters and candidates are unassigned (not deleted).',
      confirmText: 'Delete',
      danger: true,
    })
    if (ok) run(deleteTeam(team.id), `Team "${team.name}" deleted`, 'Could not delete the team')
  }

  async function removeRecruiter(team, r) {
    const ok = await confirm({ title: `Remove ${r.name} from ${team.name}?`, confirmText: 'Remove', danger: true })
    if (ok) run(removeMember(team.id, r.id), 'Recruiter removed', 'Could not remove the recruiter')
  }

  const visibleTeams = isAdmin
    ? teams
    : teams.filter((t) => t.salesLead?.id === user.id || t.salesManager?.id === user.id || t.id === user.teamId)

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function TeamCard({ team }) {
    const isOpen = expanded.has(team.id)
    const teamRecruiters = team.members.filter((m) => m.role === 'RECRUITER')
    const addable = recruiters.filter((r) => !r.teamId)
    const picked = toAdd[team.id] || []

    return (
      <Card bodyClassName="p-0">
        <div className="flex items-center justify-between gap-3 p-4">
          <button type="button" onClick={() => toggle(team.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="text-faint">{isOpen ? <DownOutlined /> : <RightOutlined />}</span>
            <div className="min-w-0">
              <div className="font-semibold text-ink">{team.name}</div>
              <div className="truncate text-xs text-muted">
                Lead: {team.salesLead?.name ?? '— none —'} · Manager: {team.salesManager?.name ?? '— none —'} · {teamRecruiters.length} recruiter
                {teamRecruiters.length === 1 ? '' : 's'}
              </div>
            </div>
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" icon={<EditOutlined />} onClick={() => openForm(team)}>
                Rename
              </Button>
              <Button size="sm" variant="danger-ghost" icon={<DeleteOutlined />} onClick={() => removeTeam(team)}>
                Delete
              </Button>
            </div>
          )}
        </div>

        {isOpen && (
          <div className="space-y-5 border-t border-line p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Sales Lead</p>
              {isAdmin ? (
                <>
                  <p className="mb-2 mt-0.5 text-xs text-muted">The Sales Lead approves this team&apos;s candidates.</p>
                  <Select
                    className="max-w-xl"
                    placeholder="Choose a Sales Lead"
                    allowClear
                    value={team.salesLead?.id}
                    options={leadOptions}
                    onChange={(userId) =>
                      userId
                        ? run(assignSalesLead(team.id, userId), 'Sales Lead updated', 'Could not set the lead')
                        : undefined
                    }
                  />
                </>
              ) : (
                <p className="mt-0.5 text-sm text-ink">{team.salesLead ? team.salesLead.name : '— none —'}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Sales Manager</p>
              {isAdmin ? (
                <>
                  <p className="mb-2 mt-0.5 text-xs text-muted">Oversees this team (and others) and can approve its candidates, just like the Sales Lead. Either one is enough.</p>
                  <Select
                    className="max-w-xl"
                    placeholder="Choose a Sales Manager"
                    allowClear
                    value={team.salesManager?.id}
                    options={managerOptions}
                    onChange={(userId) =>
                      userId
                        ? run(assignSalesManager(team.id, userId), 'Sales Manager updated', 'Could not set the manager')
                        : run(removeSalesManager(team.id), 'Sales Manager removed', 'Could not remove the manager')
                    }
                  />
                </>
              ) : (
                <p className="mt-0.5 text-sm text-ink">{team.salesManager ? team.salesManager.name : '— none —'}</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Recruiters ({teamRecruiters.length})</p>
              {teamRecruiters.length === 0 ? (
                <p className="text-sm text-muted">No recruiters in this team yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {teamRecruiters.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{r.name}</div>
                        <div className="truncate text-xs text-muted">{r.email}</div>
                      </div>
                      <Button size="sm" variant="danger-ghost" icon={<DeleteOutlined />} onClick={() => removeRecruiter(team, r)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-ink">Add recruiters</p>
                {addable.length === 0 ? (
                  <p className="text-sm text-muted">
                    No unassigned recruiters available. A recruiter already in a team must be removed first (or create new recruiters on the Users page).
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {addable.map((r) => {
                        const on = picked.includes(r.id)
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() =>
                              setToAdd((cur) => ({ ...cur, [team.id]: on ? picked.filter((x) => x !== r.id) : [...picked, r.id] }))
                            }
                            className={cn(
                              'rounded-full border px-3 py-1 text-sm transition-colors',
                              on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand',
                            )}
                          >
                            {r.name}
                          </button>
                        )
                      })}
                    </div>
                    <Button variant="primary" icon={<PlusOutlined />} className="mt-3" disabled={!picked.length} onClick={() => addSelected(team)}>
                      Add {picked.length || ''} {picked.length === 1 ? 'recruiter' : 'recruiters'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Teams' : user.role === 'SALES_MANAGER' ? 'My Teams' : 'My Team'}
        subtitle={isAdmin ? 'Create teams, assign a Sales Lead and Sales Manager, and manage recruiters.' : 'Add or remove the recruiters in your team(s).'}
        extra={
          isAdmin ? (
            <Button variant="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
              Create team
            </Button>
          ) : null
        }
      />

      {loading ? (
        <CenterSpinner />
      ) : visibleTeams.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-muted">No teams to show.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      <Modal
        open={!!formOpen}
        onClose={() => setFormOpen(null)}
        title={formOpen === 'new' ? 'Create team' : 'Rename team'}
        footer={
          <>
            <Button variant="default" onClick={() => setFormOpen(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleOk}>
              {formOpen === 'new' ? 'Create' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Team name" required error={nameError}>
            <Input
              value={teamForm.name}
              invalid={!!nameError}
              onChange={(e) => {
                setTeamForm((f) => ({ ...f, name: e.target.value }))
                setNameError(null)
              }}
            />
          </Field>
          <Field label="Sales Lead (optional)">
            <Select allowClear placeholder="Choose a Sales Lead" options={leadOptions} value={teamForm.salesLeadId} onChange={(val) => setTeamForm((f) => ({ ...f, salesLeadId: val }))} />
          </Field>
          <Field label="Sales Manager (optional)" hint="A Sales Manager can oversee several teams. To take one away, use the team's row.">
            <Select allowClear placeholder="Choose a Sales Manager" options={managerOptions} value={teamForm.salesManagerId} onChange={(val) => setTeamForm((f) => ({ ...f, salesManagerId: val }))} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
