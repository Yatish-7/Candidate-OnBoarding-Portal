import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { App as AntApp, Button, Card, Input, Select, Space, Table, Tooltip, Typography } from 'antd'
import { FilterOutlined, UserAddOutlined } from '@ant-design/icons'
import { getCandidates } from '../api/candidates.js'
import NameAvatar from '../components/NameAvatar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusTag from '../components/StatusTag.jsx'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, formatRelative } from '../utils/format.js'
import { STATUS_OPTIONS } from '../utils/status.js'

// A short line under the title explaining which rows this role gets
const VISIBILITY_HINTS = {
  RECRUITER: 'Candidates you submitted.',
  SALES_LEAD: 'Candidates from recruiters in your team.',
  SALES_MANAGER: 'Candidates from recruiters in the teams you manage.',
  HR: 'Candidates that have reached HR.',
  CONTRACTS: 'Candidates that have reached Contracts.',
  PAYROLL: 'Candidates approved by both HR and Contracts.',
  ACCOUNTS: 'Candidates approved by both HR and Contracts.',
  SUPER_ADMIN: 'All candidates.',
}

// The table's columns. "dataIndex" is the field to show; "render" customizes how it looks.
const COLUMNS = [
  {
    title: 'Candidate',
    dataIndex: 'candidateName',
    render: (name, candidate) => (
      <Space>
        <NameAvatar name={name} />
        <div style={{ lineHeight: 1.3 }}>
          {/* stopPropagation: clicking the link shouldn't ALSO trigger the row click */}
          <Link to={`/candidates/${candidate.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 500 }}>
            {name}
          </Link>
          <div style={{ fontSize: 12, color: '#64748b' }}>{candidate.candidatePersonalEmail}</div>
        </div>
      </Space>
    ),
  },
  { title: 'Client', dataIndex: 'clientName' },
  { title: 'Job title', dataIndex: 'role' },
  { title: 'Recruiter', dataIndex: 'recruiterName' },
  { title: 'Team', dataIndex: 'teamName' },
  {
    title: 'Status',
    key: 'status',
    render: (_, candidate) => <StatusTag candidate={candidate} />,
  },
  {
    title: 'Last updated',
    dataIndex: 'updatedAt',
    // Shows "2 days ago"; hovering shows the exact date and time
    render: (value) => (
      <Tooltip title={formatDateTime(value)}>
        <Typography.Text type="secondary">{formatRelative(value)}</Typography.Text>
      </Tooltip>
    ),
  },
]

// The candidate list. "embedded" = shown inside another page (the admin dashboard),
// so it skips the big page title.
export default function CandidateList({ embedded = false }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()

  // What we ask the backend for. page is 0-based, like Spring.
  const [query, setQuery] = useState({ search: '', status: '', page: 0, size: 10 })
  // What the backend sent back
  const [result, setResult] = useState({ content: [], totalElements: 0 })
  const [loading, setLoading] = useState(true)

  // Fetch the list again whenever the query changes
  useEffect(() => {
    // If the query changes again before this request finishes, ignore this (now outdated) answer
    let ignore = false

    getCandidates(query)
      .then((data) => {
        if (!ignore) setResult(data)
      })
      .catch((error) => {
        if (!ignore) message.error(getErrorMessage(error, 'Could not load candidates'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [query, message])

  // Change part of the query, e.g. updateQuery({ status: 'JOINED' })
  function updateQuery(changes) {
    setLoading(true)
    setQuery((previous) => ({ ...previous, ...changes }))
  }

  const newButton = role === 'RECRUITER' && (
    <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate('/candidates/new')}>
      New candidate
    </Button>
  )

  return (
    <>
      {!embedded && <PageHeader title="Candidates" subtitle={VISIBILITY_HINTS[role]} extra={newButton} />}

      <Card title={embedded ? 'All candidates' : null}>
        {/* Filters: side by side on wide screens, stacked full-width on phones */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {/* Searches when you press Enter or click the search icon; a new search goes back to page 1 */}
          <Input.Search
            placeholder="Search name, client, role, recruiter"
            allowClear
            onSearch={(search) => updateQuery({ search, page: 0 })}
            style={{ flex: '1 1 260px', maxWidth: 380 }}
          />
          <Select
            placeholder="All statuses"
            prefix={<FilterOutlined style={{ color: '#94a3b8' }} />}
            allowClear
            options={STATUS_OPTIONS}
            // allowClear sets the value to undefined; we send '' meaning "no filter"
            onChange={(status) => updateQuery({ status: status ?? '', page: 0 })}
            style={{ flex: '1 1 220px', maxWidth: 300 }}
          />
        </div>

        <Table
          rowKey="id"
          columns={COLUMNS}
          dataSource={result.content}
          loading={loading}
          // The whole row opens the candidate
          rowClassName="clickable-row"
          onRow={(candidate) => ({ onClick: () => navigate(`/candidates/${candidate.id}`) })}
          // Scroll sideways on small screens instead of squashing the columns
          scroll={{ x: 'max-content' }}
          pagination={{
            current: query.page + 1, // antd counts pages from 1, Spring from 0
            pageSize: query.size,
            total: result.totalElements,
            showSizeChanger: true,
            showTotal: (total) => `${total} candidates`,
          }}
          onChange={(pagination) =>
            updateQuery({ page: pagination.current - 1, size: pagination.pageSize })
          }
        />
      </Card>
    </>
  )
}
