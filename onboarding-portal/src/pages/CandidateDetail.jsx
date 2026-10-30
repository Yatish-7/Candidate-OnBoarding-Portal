import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, Col, Result, Row, Space, Spin, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { getCandidate } from '../api/candidates.js'
import ActionButtons from '../components/ActionButtons.jsx'
import ApprovalTimeline, { ChangeHistory } from '../components/ApprovalTimeline.jsx'
import CandidateSections from '../components/CandidateSections.jsx'
import CommentBox from '../components/CommentBox.jsx'
import NameAvatar from '../components/NameAvatar.jsx'
import StageProgress from '../components/StageProgress.jsx'
import StatusTag from '../components/StatusTag.jsx'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime } from '../utils/format.js'
import { canComment, canEdit, isDeclined } from '../utils/permissions.js'

// Banner shown while a Super Admin override is in place (the Super Admin can still change it;
// earlier decisions stay visible in the approval trail)
function OverrideBanner({ override }) {
  const approved = override.decision === 'APPROVED'
  return (
    <Alert
      type={approved ? 'success' : 'error'}
      showIcon
      title={`${approved ? 'Approved' : 'Rejected'} by Super Admin override`}
      description={`${override.by}, ${formatDateTime(override.at)}: "${override.comment}"`}
    />
  )
}

// Banner shown when HR or Contracts declined. Their latest decline comment explains why.
function DeclinedBanner({ candidate }) {
  const lastDecline = [...candidate.trail].reverse().find((entry) => entry.action === 'DECLINED')
  return (
    <Alert
      type="warning"
      showIcon
      title="Declined — back to the Sales Lead to edit and resubmit"
      description={lastDecline && `${lastDecline.actorName}: "${lastDecline.comment}"`}
    />
  )
}

// One small "icon + text" fact under the candidate's name
function Fact({ icon, children }) {
  return (
    <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
      {icon} {children}
    </span>
  )
}

export default function CandidateDetail() {
  const { id } = useParams() // from the URL /candidates/:id
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [error, setError] = useState(null)

  // Loads (or reloads) the candidate. useCallback keeps the same function between renders,
  // so the effect below only runs again when the id changes.
  const load = useCallback(() => {
    return getCandidate(id)
      .then((data) => {
        setCandidate(data)
        setError(null)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load the candidate')))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <Result
        status="404"
        title="Candidate not available"
        subTitle={error}
        extra={<Link to="/candidates">Back to candidates</Link>}
      />
    )
  }

  if (!candidate) {
    return <Spin size="large" style={{ display: 'block', marginTop: 80 }} />
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Link to="/candidates" style={{ color: '#64748b' }}>
        <ArrowLeftOutlined /> All candidates
      </Link>

      {/* Header: who the candidate is, their status, and what you can do */}
      <Card>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col flex="auto">
            <Space size={16} align="center">
              <NameAvatar name={candidate.candidateName} size={56} />
              <div>
                <Space wrap align="center">
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {candidate.candidateName}
                  </Typography.Title>
                  <StatusTag candidate={candidate} />
                </Space>
                <Space wrap size={[16, 4]} style={{ marginTop: 6 }}>
                  <Fact icon={<IdcardOutlined />}>{candidate.role}</Fact>
                  <Fact icon={<ShopOutlined />}>{candidate.clientName}</Fact>
                  <Fact icon={<EnvironmentOutlined />}>{candidate.location}</Fact>
                  <Fact icon={<UserOutlined />}>{candidate.recruiterName}</Fact>
                  <Fact icon={<TeamOutlined />}>{candidate.teamName}</Fact>
                  {candidate.salesLeadName && (
                    <Fact icon={<UserOutlined />}>Sales Lead: {candidate.salesLeadName}</Fact>
                  )}
                  {candidate.salesManagerName && (
                    <Fact icon={<UserOutlined />}>Sales Manager: {candidate.salesManagerName}</Fact>
                  )}
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            {/* Approve / Decline / DOJ / Override / Edit — only the ones this user may do right now */}
            <Space orientation="vertical" align="end">
              {canEdit(user) && (
                <Link to={`/candidates/${candidate.id}/edit`}>
                  <Button icon={<EditOutlined />}>Edit details</Button>
                </Link>
              )}
              <ActionButtons candidate={candidate} onChanged={load} />
            </Space>
          </Col>
        </Row>
      </Card>

      {candidate.override && <OverrideBanner override={candidate.override} />}
      {!candidate.override && isDeclined(candidate) && <DeclinedBanner candidate={candidate} />}

      <Card title="Progress">
        <StageProgress candidate={candidate} />
      </Card>

      {/* Two columns on wide screens; stacked on small screens */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <CandidateSections candidate={candidate} />
        </Col>
        <Col xs={24} xl={9}>
          <Card title="Change history" style={{ marginBottom: 16 }}>
            <ChangeHistory trail={candidate.trail} />
          </Card>
          <Card title="Approval trail">
            <ApprovalTimeline trail={candidate.trail} />
            {canComment(user) && <CommentBox candidate={candidate} onAdded={load} />}
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
