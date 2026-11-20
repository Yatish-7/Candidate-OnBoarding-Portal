import { useEffect, useState } from 'react'
import { AUDIT_ACTIONS, AUDIT_ENTITIES, getAuditDetail, getAuditLog } from '../api/audit.js'
import PageHeader from '../components/PageHeader.jsx'
import { Badge, Card, DescriptionList, Drawer, Input, Pagination, Select, Spinner, Table, cn, useToast } from '../ui/index.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, formatRelative } from '../utils/format.js'
import { tagColor } from '../utils/colors.js'

const PAGE_SIZE = 20

const shortId = (id) => (String(id).length > 12 ? `${String(id).slice(0, 8)}…` : id)
const entityLabel = (value) => AUDIT_ENTITIES.find((e) => e.value === value)?.label ?? value
const actionInfo = (value) => AUDIT_ACTIONS.find((a) => a.value === value) ?? { label: value, color: 'default' }

function fieldLabel(column) {
  const text = column.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function showValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

// "YYYY-MM-DD" → epoch ms at local midnight (plus a day offset for the exclusive end)
const dayMs = (value, addDays = 0) => (value ? new Date(`${value}T00:00:00`).getTime() + addDays * 86400000 : undefined)

// Super Admin: every create / update / delete across all tables, who did it and when.
export default function AuditLog() {
  const toast = useToast()
  const [filters, setFilters] = useState({ entity: undefined, action: undefined, user: '', q: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ content: [], totalElements: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAuditLog({
      entity: filters.entity,
      action: filters.action,
      user: filters.user,
      q: filters.q,
      from: dayMs(filters.from),
      to: dayMs(filters.to, 1),
      page,
      size: PAGE_SIZE,
    })
      .then((result) => !cancelled && setData(result))
      .catch((error) => !cancelled && toast.error(getErrorMessage(error, 'Could not load the audit log')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page])

  useEffect(() => {
    if (!selected) return
    setDetail(null)
    getAuditDetail(selected.entity, selected.entityId, selected.rev)
      .then(setDetail)
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load the change details')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
    setPage(0)
  }

  const columns = [
    {
      title: 'When',
      dataIndex: 'at',
      render: (at) => (
        <div className="leading-tight">
          <div className="text-ink">{formatDateTime(at)}</div>
          <div className="text-xs text-faint">{formatRelative(at)}</div>
        </div>
      ),
    },
    { title: 'Action', dataIndex: 'action', render: (action) => <Badge color={tagColor(actionInfo(action).color)}>{actionInfo(action).label}</Badge> },
    { title: 'Table', dataIndex: 'entity', render: entityLabel },
    {
      title: 'Record',
      dataIndex: 'label',
      render: (label, entry) => (
        <span>
          <span className="font-semibold text-ink">{label ?? '—'}</span>
          <span className="ml-1.5 text-faint">#{shortId(entry.entityId)}</span>
        </span>
      ),
    },
    {
      title: 'Changed by',
      dataIndex: 'user',
      render: (user) => (user === 'anonymous' || user === 'system' ? <Badge tone="neutral">{user}</Badge> : (user ?? '—')),
    },
  ]

  const diffRows = (() => {
    if (!detail) return []
    const current = detail.current ?? {}
    const previous = detail.previous
    return Object.keys(current).map((column) => ({
      key: column,
      field: fieldLabel(column),
      before: previous ? showValue(previous[column]) : '—',
      after: showValue(current[column]),
      changed: previous ? showValue(previous[column]) !== showValue(current[column]) : false,
    }))
  })()
  const changedCount = diffRows.filter((row) => row.changed).length

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change to every table — who made it and when." />

      <Card bodyClassName="p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Select placeholder="All tables" allowClear options={AUDIT_ENTITIES} value={filters.entity} onChange={(value) => updateFilter('entity', value)} />
          <Select placeholder="All actions" allowClear options={AUDIT_ACTIONS.map(({ value, label }) => ({ value, label }))} value={filters.action} onChange={(value) => updateFilter('action', value)} />
          <Input placeholder="Changed by (email)" defaultValue={filters.user} onKeyDown={(e) => e.key === 'Enter' && updateFilter('user', e.target.value)} />
          <Input placeholder="Search record" defaultValue={filters.q} onKeyDown={(e) => e.key === 'Enter' && updateFilter('q', e.target.value)} />
          {/* The date range needs more room than one cell, so it spans two columns and the inputs may shrink */}
          <div className="flex min-w-0 items-center gap-2 sm:col-span-2">
            <Input type="date" className="min-w-0" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
            <span className="shrink-0 text-faint">–</span>
            <Input type="date" className="min-w-0" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
          </div>
        </div>

        <Table columns={columns} data={data.content} rowKey="key" loading={loading} onRowClick={(entry) => setSelected(entry)} empty="No changes recorded." />
        <Pagination current={page} pageSize={PAGE_SIZE} total={data.totalElements} label="changes" pageSizeOptions={null} onChange={(p) => setPage(p)} />
      </Card>

      <Drawer open={!!selected} onClose={() => setSelected(null)} width={600} title={selected ? `${entityLabel(selected.entity)} #${shortId(selected.entityId)}` : ''}>
        {selected && (
          <>
            <DescriptionList
              className="mb-5 sm:grid-cols-1"
              items={[
                { label: 'Action', children: <Badge color={tagColor(actionInfo(selected.action).color)}>{actionInfo(selected.action).label}</Badge> },
                { label: 'When', children: formatDateTime(selected.at) },
                { label: 'Changed by', children: selected.user ?? '—' },
                { label: 'Revision', children: `#${selected.rev}` },
              ]}
            />

            {!detail ? (
              <Spinner />
            ) : (
              <>
                <p className="mb-2 text-sm text-muted">
                  {selected.action === 0
                    ? 'Values when the record was created.'
                    : selected.action === 2
                      ? 'The record’s last values before it was deleted.'
                      : detail.previous
                        ? `${changedCount} field${changedCount === 1 ? '' : 's'} changed (highlighted).`
                        : 'No earlier version is on record, so only the new values are shown.'}
                </p>
                <div className="overflow-hidden rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                        <th className="px-3 py-2">Field</th>
                        {selected.action === 1 && <th className="px-3 py-2">Before</th>}
                        <th className="px-3 py-2">{selected.action === 1 ? 'After' : 'Value'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffRows.map((row) => (
                        <tr key={row.key} className={cn('border-t border-line', row.changed && 'bg-warning-soft font-medium')}>
                          <td className="px-3 py-2 text-muted">{row.field}</td>
                          {selected.action === 1 && <td className="px-3 py-2 text-ink">{row.before}</td>}
                          <td className="px-3 py-2 text-ink">{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
