import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCandidate, updateCandidate } from '../api/candidates.js'
import CandidateForm from '../components/CandidateForm.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { Alert, Button, CenterSpinner, Result, useToast } from '../ui/index.js'
import { useAuth } from '../context/AuthContext.js'
import { toFormValues } from '../utils/candidateForm.js'
import { getErrorMessage } from '../utils/errors.js'
import { canEdit } from '../utils/permissions.js'

// HR edits a candidate's details at any time. Saving emails everyone in the loop and
// adds the list of changes to the approval trail.
export default function CandidateEdit() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [candidate, setCandidate] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCandidate(id)
      .then(setCandidate)
      .catch((err) => setError(getErrorMessage(err, 'Could not load the candidate')))
  }, [id])

  if (error) {
    return <Result status="404" title="Candidate not available" subTitle={error} />
  }
  if (!candidate) {
    return <CenterSpinner />
  }
  if (!canEdit(user, candidate)) {
    return (
      <Result
        status="403"
        title="Only HR can edit a candidate's details"
        extra={<Button to={`/candidates/${id}`}>Back to the candidate</Button>}
      />
    )
  }

  async function handleSubmit(values) {
    // The form only holds the fields it shows; keep the rest (recruiter name, team …) as they are
    await updateCandidate(id, { ...candidate, ...values })
    toast.success('Changes saved — everyone in the loop has been emailed.')
    navigate(`/candidates/${id}`)
  }

  return (
    <>
      <PageHeader title={`Edit ${candidate.candidateName}`} subtitle={`${candidate.role} at ${candidate.clientName}`} />
      <Alert
        tone="info"
        className="mb-4"
        title="Saving emails everyone in the loop"
        message="HR, Contracts, Payroll, Accounts, the Super Admin, the Sales Lead / Manager and the recruiter get the list of changes. Approvals are not reset. Leave the SSN empty to keep the stored one."
      />
      <CandidateForm
        initialValues={{ ...toFormValues(candidate), ssn: '' }}
        recruiterName={candidate.recruiterName}
        recruiterLocation={candidate.recruiterLocation}
        teamName={candidate.teamName}
        salesLeadName={candidate.salesLeadName}
        salesManagerName={candidate.salesManagerName}
        submitText="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/candidates/${id}`)}
      />
    </>
  )
}
