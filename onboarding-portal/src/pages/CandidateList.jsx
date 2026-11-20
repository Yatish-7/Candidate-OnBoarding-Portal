import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons'
import { getCandidates } from '../api/candidates.js'
import { getDashboardSummary } from '../api/dashboard.js'
import NameAvatar from '../components/NameAvatar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusTag from '../components/StatusTag.jsx'
import { Button, Card, Input, Pagination, Select, Table, Tooltip, useToast } from '../ui/index.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime, formatRelative } from '../utils/format.js'
import { STATUS_OPTIONS } from '../utils/status.js'

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

const COLUMNS = [
  {
    title: 'Candidate',
    dataIndex: 'candidateName',
    render: (name, candidate) => (
      <div className="flex items-center gap-3">
        <NameAvatar name={name} />
        <div className="leading-tight">
          <Link to={`/candidates/${candidate.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand hover:underline">
            {name}
          </Link>
          <div className="text-xs text-muted">{candidate.candidatePersonalEmail}</div>
        </div>
      </div>
    ),
  },
  { title: 'Client', dataIndex: 'clientName' },
  { title: 'Job title', dataIndex: 'role' },
  { title: 'Recruiter', dataIndex: 'recruiterName' },
  { title: 'Team', dataIndex: 'teamName' },
  { title: 'Status', key: 'status', render: (_, candidate) => <StatusTag candidate={candidate} /> },
  {
    title: 'Last updated',
    dataIndex: 'updatedAt',
    render: (value) => (
      <Tooltip title={formatDateTime(value)}>
        <span className="text-muted">{formatRelative(value)}</span>
      </Tooltip>
    ),
  },
]

// The candidate list. "embedded" = shown inside the admin dashboard, so it skips the page title.
export default function CandidateList({ embedded = false, filters = {} }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [query, setQuery] = useState({ search: '', status: '', dojToday: false, page: 0, size: 10 })
  const [joiningToday, setJoiningToday] = useState(0)
  const showJoiningToday = !embedded && ['SALES_LEAD', 'SALES_MANAGER', 'HR'].includes(role)

  useEffect(() => {
    if (!showJoiningToday) return
    getDashboardSummary()
      .then((summary) => setJoiningToday(summary.dojToday ?? 0))
      .catch(() => setJoiningToday(0))
  }, [showJoiningToday])

  const [result, setResult] = useState({ content: [], totalElements: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    getCandidates({ ...query, filters })
      .then((data) => {
        if (!ignore) setResult(data)
      })
      .catch((error) => {
        if (!ignore) toast.error(getErrorMessage(error, 'Could not load candidates'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters])

  function updateQuery(changes) {
    setLoading(true)
    setQuery((previous) => ({ ...previous, ...changes }))
  }

  const newButton = role === 'RECRUITER' && (
    <Button variant="primary" icon={<UserAddOutlined />} onClick={() => navigate('/candidates/new')}>
      New candidate
    </Button>
  )

  return (
    <>
      {!embedded && <PageHeader title="Candidates" subtitle={VISIBILITY_HINTS[role]} extra={newButton} />}

      {showJoiningToday && joiningToday > 0 && (
        <Card className="mb-4 border-brand/30 bg-brand-soft/50" bodyClassName="flex flex-wrap items-center gap-4 p-4">
          <CalendarOutlined className="text-2xl text-brand" />
          <div className="flex-1 basis-60">
            <p className="font-semibold text-ink">
              {joiningToday === 1 ? '1 candidate joins today' : `${joiningToday} candidates join today`}
            </p>
            <p className="text-sm text-muted">Today is the Date of Joining. Check and approve it if you haven&apos;t yet.</p>
          </div>
          <Button variant={query.dojToday ? 'default' : 'primary'} onClick={() => updateQuery({ dojToday: !query.dojToday, page: 0 })}>
            {query.dojToday ? 'Show all candidates' : 'Show who joins today'}
          </Button>
        </Card>
      )}

      <Card title={embedded ? 'All candidates' : null} bodyClassName="p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-sm flex-1"
            prefix={<SearchOutlined />}
            placeholder="Search name, client, role, recruiter"
            defaultValue={query.search}
            onKeyDown={(e) => e.key === 'Enter' && updateQuery({ search: e.target.value, page: 0 })}
          />
          <Select
            className="w-full sm:w-64"
            placeholder="All statuses"
            allowClear
            options={STATUS_OPTIONS}
            value={query.status || undefined}
            onChange={(status) => updateQuery({ status: status ?? '', page: 0 })}
          />
        </div>

        <Table
          columns={COLUMNS}
          data={result.content}
          loading={loading}
          onRowClick={(candidate) => navigate(`/candidates/${candidate.id}`)}
          empty="No candidates to show."
        />
        <Pagination
          current={query.page}
          pageSize={query.size}
          total={result.totalElements}
          label="candidates"
          onChange={(p, size) => updateQuery({ page: p, size })}
        />
      </Card>
    </>
  )
}
