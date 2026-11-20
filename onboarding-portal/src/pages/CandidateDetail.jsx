import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { Alert, Button, Card, CenterSpinner, Result } from '../ui/index.js'
import { useAuth } from '../context/AuthContext.js'
import { getErrorMessage } from '../utils/errors.js'
import { formatDateTime } from '../utils/format.js'
import { canComment, canEdit, isDeclined } from '../utils/permissions.js'

// Banner shown while a Super Admin override is in place
function OverrideBanner({ override }) {
  const approved = override.decision === 'APPROVED'
  return (
    <Alert
      tone={approved ? 'success' : 'error'}
      title={`${approved ? 'Approved' : 'Rejected'} by Super Admin override`}
      message={`${override.by}, ${formatDateTime(override.at)}: "${override.comment}"`}
    />
  )
}

// Banner shown when HR or Contracts declined
function DeclinedBanner({ candidate }) {
  const lastDecline = [...candidate.trail].reverse().find((entry) => entry.action === 'DECLINED')
  return (
    <Alert
      tone="warning"
      title="Declined — back to the Sales Lead to edit and resubmit"
      message={lastDecline && `${lastDecline.actorName}: "${lastDecline.comment}"`}
    />
  )
}

// One small "icon + text" fact under the candidate's name
function Fact({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
      <span className="text-faint">{icon}</span> {children}
    </span>
  )
}

export default function CandidateDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [error, setError] = useState(null)

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
        extra={<Button to="/candidates">Back to candidates</Button>}
      />
    )
  }

  if (!candidate) {
    return <CenterSpinner />
  }

  return (
    <div className="space-y-4">
      <Link to="/candidates" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftOutlined /> All candidates
      </Link>

      {/* Header: who the candidate is, their status, and what you can do */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <NameAvatar name={candidate.candidateName} size={56} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-ink">{candidate.candidateName}</h1>
                <StatusTag candidate={candidate} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <Fact icon={<IdcardOutlined />}>{candidate.role}</Fact>
                <Fact icon={<ShopOutlined />}>{candidate.clientName}</Fact>
                <Fact icon={<EnvironmentOutlined />}>{candidate.location}</Fact>
                <Fact icon={<UserOutlined />}>{candidate.recruiterName}</Fact>
                <Fact icon={<TeamOutlined />}>{candidate.teamName}</Fact>
                {candidate.salesLeadName && <Fact icon={<UserOutlined />}>Sales Lead: {candidate.salesLeadName}</Fact>}
                {candidate.salesManagerName && <Fact icon={<UserOutlined />}>Sales Manager: {candidate.salesManagerName}</Fact>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            {canEdit(user) && (
              <Button to={`/candidates/${candidate.id}/edit`} icon={<EditOutlined />}>
                Edit details
              </Button>
            )}
            <ActionButtons candidate={candidate} onChanged={load} />
          </div>
        </div>
      </Card>

      {candidate.override && <OverrideBanner override={candidate.override} />}
      {!candidate.override && isDeclined(candidate) && <DeclinedBanner candidate={candidate} />}

      <Card title="Progress">
        <StageProgress candidate={candidate} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CandidateSections candidate={candidate} />
        </div>
        <div className="space-y-4">
          <Card title="Change history">
            <ChangeHistory trail={candidate.trail} />
          </Card>
          <Card title="Approval trail">
            <ApprovalTimeline trail={candidate.trail} />
            {canComment(user) && (
              <div className="mt-4 border-t border-line pt-4">
                <CommentBox candidate={candidate} onAdded={load} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
