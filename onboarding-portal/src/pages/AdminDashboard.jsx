import { useEffect, useState } from 'react'
import { App as AntApp, Card, Col, Row, Statistic, Typography } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LogoutOutlined,
  UserDeleteOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { getDashboardSummary } from '../api/dashboard.js'
import PageHeader from '../components/PageHeader.jsx'
import { getErrorMessage } from '../utils/errors.js'
import { STATUSES, SUMMARY_GROUPS } from '../utils/status.js'
import CandidateList from './CandidateList.jsx'

// The counters. "key" matches a field in the /api/dashboard/summary response.
// "color" is the icon color, "background" the soft square behind it.
const COUNTERS = [
  { key: 'pending', title: 'Pending', icon: <ClockCircleOutlined />, color: '#d97706', background: '#fffbeb' },
  { key: 'approved', title: 'Approved', icon: <CheckCircleOutlined />, color: '#16a34a', background: '#f0fdf4' },
  { key: 'declined', title: 'Declined / rejected', icon: <CloseCircleOutlined />, color: '#dc2626', background: '#fef2f2' },
  { key: 'joined', title: 'Joined', icon: <UserAddOutlined />, color: '#4f46e5', background: '#eef2ff' },
  { key: 'dropouts', title: 'Drop outs / Back outs', icon: <UserDeleteOutlined />, color: '#475569', background: '#f1f5f9' },
  { key: 'exited', title: 'Exited', icon: <LogoutOutlined />, color: '#c026d3', background: '#fdf4ff' },
]

// Small text under each number explaining which statuses it includes
function groupDescription(key) {
  return SUMMARY_GROUPS[key].map((status) => STATUSES[status].label).join(' · ')
}

function CounterCard({ counter, value, loading }) {
  return (
    <Card style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Statistic
          title={counter.title}
          value={value}
          loading={loading}
          styles={{ content: { fontSize: 30, fontWeight: 600 } }}
        />
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: counter.background,
            color: counter.color,
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {counter.icon}
        </div>
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {groupDescription(counter.key)}
      </Typography.Text>
    </Card>
  )
}

// Super Admin: counts at the top, then the full candidate table (the same one as the Candidates page)
export default function AdminDashboard() {
  const [summary, setSummary] = useState(null)
  const { message } = AntApp.useApp()

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((error) => message.error(getErrorMessage(error, 'Could not load the summary')))
  }, [message])

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Every candidate across all teams and stages." />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {COUNTERS.map((counter) => (
          // One card per row on phones, two on tablets, all six side by side on wide screens
          <Col key={counter.key} xs={24} sm={12} xl={{ flex: '1 1 0' }}>
            <CounterCard counter={counter} value={summary?.[counter.key] ?? 0} loading={!summary} />
          </Col>
        ))}
      </Row>

      <CandidateList embedded />
    </>
  )
}
