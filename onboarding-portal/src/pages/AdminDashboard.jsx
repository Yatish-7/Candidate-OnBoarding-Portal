import { useEffect, useState } from 'react'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LogoutOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import { getDashboardSummary } from '../api/dashboard.js'
import PageHeader from '../components/PageHeader.jsx'
import CandidateFilters from '../components/CandidateFilters.jsx'
import CandidateList from './CandidateList.jsx'
import { Card, Stat, useToast } from '../ui/index.js'
import { getErrorMessage } from '../utils/errors.js'
import { STATUSES, SUMMARY_GROUPS } from '../utils/status.js'

// The counters. "key" matches a field in the /api/dashboard/summary response.
const COUNTERS = [
  { key: 'pending', title: 'Pending', icon: <ClockCircleOutlined />, color: '#d97706', background: '#fffbeb' },
  { key: 'approved', title: 'Approved', icon: <CheckCircleOutlined />, color: '#16a34a', background: '#f0fdf4' },
  { key: 'declined', title: 'Declined / rejected', icon: <CloseCircleOutlined />, color: '#dc2626', background: '#fef2f2' },
  { key: 'joined', title: 'Joined', icon: <UserAddOutlined />, color: '#4f46e5', background: '#eef2ff' },
  { key: 'dropouts', title: 'Drop outs / Back outs', icon: <UserDeleteOutlined />, color: '#475569', background: '#f1f5f9' },
  { key: 'exited', title: 'Exited', icon: <LogoutOutlined />, color: '#c026d3', background: '#fdf4ff' },
]

function groupDescription(key) {
  return SUMMARY_GROUPS[key].map((status) => STATUSES[status].label).join(' · ')
}

function CounterCard({ counter, value, loading }) {
  return (
    <Card className="group h-full" hover bodyClassName="p-4">
      <div className="flex items-start justify-between gap-3">
        <Stat title={counter.title} value={value} loading={loading} />
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl text-xl ring-1 ring-inset ring-black/5 transition-transform duration-300 group-hover:scale-105"
          style={{ background: counter.background, color: counter.color }}
        >
          {counter.icon}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{groupDescription(counter.key)}</p>
    </Card>
  )
}

// Super Admin: counts at the top, then the full candidate table (the same one as the Candidates page)
export default function AdminDashboard() {
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({})
  const toast = useToast()

  useEffect(() => {
    getDashboardSummary(filters)
      .then(setSummary)
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load the summary')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Every candidate across all teams and stages." />

      <CandidateFilters filters={filters} onChange={setFilters} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {COUNTERS.map((counter) => (
          <CounterCard key={counter.key} counter={counter} value={summary?.[counter.key] ?? 0} loading={!summary} />
        ))}
      </div>

      <CandidateList embedded filters={filters} />
    </>
  )
}
