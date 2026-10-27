import { useNavigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import { createCandidate } from '../api/candidates.js'
import CandidateForm from '../components/CandidateForm.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.js'
import { NEW_CANDIDATE_VALUES } from '../utils/candidateForm.js'

// Recruiter submits a new candidate (Stage 1)
export default function CandidateNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()

  async function handleSubmit(values) {
    // The location is copied from the recruiter's profile, so it has to be set first
    if (!user.location) {
      throw new Error('Your location is not set yet. Ask an admin to set it on the Users page.')
    }
    const created = await createCandidate(values)
    message.success('Candidate submitted — your Sales Lead has been notified.')
    navigate(`/candidates/${created.id}`)
  }

  return (
    <>
      <PageHeader title="New candidate" subtitle="Fill in the intake details. Your Sales Lead is notified when you submit." />
      <CandidateForm
        initialValues={NEW_CANDIDATE_VALUES}
        recruiterName={user.name}
        recruiterLocation={user.location}
        teamName={user.teamName}
        salesLeadName={user.salesLeadName}
        salesManagerName={user.salesManagerName}
        submitText="Submit candidate"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/candidates')}
        showSampleButton
      />
    </>
  )
}
