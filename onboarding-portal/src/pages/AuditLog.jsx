import { useEffect, useState } from 'react'
import { App as AntApp, Card, DatePicker, Descriptions, Drawer, Input, Select, Spin, Table, Tag, Typography } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import { AUDIT_ACTIONS, AUDIT_ENTITIES, getAuditDetail, getAuditLog } from '../api/audit.js'
import PageHeader from '../components/PageHeader.jsx'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, formatRelative } from '../utils/format.js'

const PAGE_SIZE = 20

// Session ids are long UUIDs; show just the start (the full id is in the drawer's fields)
const shortId = (id) => (String(id).length > 12 ? `${String(id).slice(0, 8)}…` : id)

const entityLabel = (value) => AUDIT_ENTITIES.find((e) => e.value === value)?.label ?? value
const actionInfo = (value) => AUDIT_ACTIONS.find((a) => a.value === value) ?? { label: value, color: 'default' }

// "full_name" → "Full name"
function fieldLabel(column) {
  const text = column.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function showValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

// Super Admin: every create / update / delete across all tables, who did it and when.
export default function AuditLog() {
  const { message } = AntApp.useApp()
  const [filters, setFilters] = useState({ entity: undefined, action: undefined, user: '', q: '', range: null })
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ content: [], totalElements: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // the log entry open in the drawer
  const [detail, setDetail] = useState(null)

  // Reload whenever a filter or the page changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const [start, end] = filters.range ?? []
    getAuditLog({
      entity: filters.entity,
      action: filters.action,
      user: filters.user,
      q: filters.q,
      from: start ? start.startOf('day').valueOf() : undefined,
      to: end ? end.add(1, 'day').startOf('day').valueOf() : undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((result) => !cancelled && setData(result))
      .catch((error) => !cancelled && message.error(getErrorMessage(error, 'Could not load the audit log')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, page, message])

  // Load the before/after snapshots when an entry is opened
  useEffect(() => {
    if (!selected) return
    setDetail(null)
    getAuditDetail(selected.entity, selected.entityId, selected.rev)
      .then(setDetail)
      .catch((error) => message.error(getErrorMessage(error, 'Could not load the change details')))
  }, [selected, message])

  // Changing any filter goes back to the first page
  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
    setPage(0)
  }

  const columns = [
    {
      title: 'When',
      dataIndex: 'at',
      render: (at) => (
        <div style={{ lineHeight: 1.3 }}>
          <div>{formatDateTime(at)}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatRelative(at)}</div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (action) => {
        const info = actionInfo(action)
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    { title: 'Table', dataIndex: 'entity', render: entityLabel },
    {
      title: 'Record',
      dataIndex: 'label',
      render: (label, entry) => (
        <span>
          <Typography.Text strong>{label ?? '—'}</Typography.Text>
          <span style={{ color: '#94a3b8', marginLeft: 6 }}>#{shortId(entry.entityId)}</span>
        </span>
      ),
    },
    {
      title: 'Changed by',
      dataIndex: 'user',
      render: (user) =>
        user === 'anonymous' || user === 'system' ? <Tag>{user}</Tag> : (user ?? '—'),
    },
  ]

  // Build the before/after rows for the drawer, marking fields that changed
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

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Select
            placeholder="All tables"
            prefix={<FilterOutlined style={{ color: '#94a3b8' }} />}
            allowClear
            options={AUDIT_ENTITIES}
            onChange={(value) => updateFilter('entity', value)}
            style={{ flex: '1 1 180px', maxWidth: 220 }}
          />
          <Select
            placeholder="All actions"
            allowClear
            options={AUDIT_ACTIONS.map(({ value, label }) => ({ value, label }))}
            onChange={(value) => updateFilter('action', value)}
            style={{ flex: '1 1 150px', maxWidth: 180 }}
          />
          <Input.Search
            placeholder="Changed by (email)"
            allowClear
            onSearch={(value) => updateFilter('user', value)}
            style={{ flex: '1 1 200px', maxWidth: 260 }}
          />
          <Input.Search
            placeholder="Search record"
            allowClear
            onSearch={(value) => updateFilter('q', value)}
            style={{ flex: '1 1 200px', maxWidth: 260 }}
          />
          <DatePicker.RangePicker
            format="DD MMM YYYY"
            onChange={(range) => updateFilter('range', range)}
            style={{ flex: '1 1 240px', maxWidth: 300 }}
          />
        </div>

        <Table
          rowKey="key"
          columns={columns}
          dataSource={data.content}
          loading={loading}
          scroll={{ x: 'max-content' }}
          rowClassName={() => 'clickable-row'}
          onRow={(entry) => ({ onClick: () => setSelected(entry) })}
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total: data.totalElements,
            showSizeChanger: false,
            showTotal: (total) => `${total} changes`,
            onChange: (next) => setPage(next - 1),
          }}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={600}
        title={selected ? `${entityLabel(selected.entity)} #${shortId(selected.entityId)}` : ''}
      >
        {selected && (
          <>
            <Descriptions
              size="small"
              column={1}
              style={{ marginBottom: 20 }}
              items={[
                { label: 'Action', children: <Tag color={actionInfo(selected.action).color}>{actionInfo(selected.action).label}</Tag> },
                { label: 'When', children: formatDateTime(selected.at) },
                { label: 'Changed by', children: selected.user ?? '—' },
                { label: 'Revision', children: `#${selected.rev}` },
              ]}
            />

            {!detail ? (
              <Spin />
            ) : (
              <>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {selected.action === 0
                    ? 'Values when the record was created.'
                    : selected.action === 2
                      ? 'The record’s last values before it was deleted.'
                      : detail.previous
                        ? `${changedCount} field${changedCount === 1 ? '' : 's'} changed (highlighted).`
                        : 'No earlier version is on record, so only the new values are shown.'}
                </Typography.Text>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={diffRows}
                  rowClassName={(row) => (row.changed ? 'oi-audit-changed' : '')}
                  columns={[
                    { title: 'Field', dataIndex: 'field', width: 170 },
                    ...(selected.action === 1 ? [{ title: 'Before', dataIndex: 'before' }] : []),
                    { title: selected.action === 1 ? 'After' : 'Value', dataIndex: 'after' },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
