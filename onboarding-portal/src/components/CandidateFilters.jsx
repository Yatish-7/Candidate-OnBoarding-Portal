import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { ClearOutlined } from '@ant-design/icons'
import Button from '../ui/Button.jsx'
import Card from '../ui/Card.jsx'
import Select from '../ui/Select.jsx'
import { Input } from '../ui/Input.jsx'
import { getTeams, getUsersByRole } from '../api/users.js'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  INTERNAL_ENTITY_OPTIONS,
  PAYROLL_COMPANY_OPTIONS,
  RECRUITER_LOCATION_OPTIONS,
  US_STATE_OPTIONS,
} from '../utils/options.js'

// Which date the range applies to (sent as "dateField")
const DATE_FIELD_OPTIONS = [
  { value: 'submitted', label: 'Submitted on' },
  { value: 'updated', label: 'Last updated on' },
  { value: 'doj', label: 'Date of joining' },
  { value: 'projectEnd', label: 'Project end date' },
]

// Quick ranges. Weeks run Monday to Sunday.
function presetRange(key) {
  const today = dayjs()
  const monday = today.subtract((today.day() + 6) % 7, 'day')
  switch (key) {
    case 'today':
      return [today, today]
    case 'thisWeek':
      return [monday, monday.add(6, 'day')]
    case 'lastWeek':
      return [monday.subtract(7, 'day'), monday.subtract(1, 'day')]
    case 'thisMonth':
      return [today.startOf('month'), today.endOf('month')]
    case 'lastMonth':
      return [today.subtract(1, 'month').startOf('month'), today.subtract(1, 'month').endOf('month')]
    case 'last30':
      return [today.subtract(29, 'day'), today]
    default:
      return null
  }
}

const PRESET_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'last30', label: 'Last 30 days' },
]

const asOptions = (items) => items.map((item) => ({ value: item.id, label: item.name }))

// The Super Admin's filter bar: date (any of four dates, a quick range or custom dates), recruiter,
// team and intake fields. "filters" is what the parent sends to the backend; every change calls
// onChange with a new object.
export default function CandidateFilters({ filters, onChange }) {
  const [recruiters, setRecruiters] = useState([])
  const [teams, setTeams] = useState([])
  const [preset, setPreset] = useState(undefined)

  useEffect(() => {
    getUsersByRole('RECRUITER').then((users) => setRecruiters(users.map((u) => ({ id: u.id, name: u.name })))).catch(() => {})
    getTeams().then(setTeams).catch(() => {})
  }, [])

  function set(changes) {
    onChange({ ...filters, ...changes })
  }

  function choosePreset(key) {
    setPreset(key)
    const range = presetRange(key)
    if (range) set({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') })
    else set({ from: undefined, to: undefined })
  }

  const hasFilter = Object.values(filters).some((v) => v !== undefined && v !== '')

  const pick = (k, placeholder, options) => (
    <Select allowClear placeholder={placeholder} options={options} value={filters[k]} onChange={(value) => set({ [k]: value })} />
  )

  return (
    <Card title="Filters" className="mb-5" bodyClassName="p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Select options={DATE_FIELD_OPTIONS} value={filters.dateField ?? 'submitted'} onChange={(dateField) => set({ dateField })} />
        <Select allowClear placeholder="Quick range" options={PRESET_OPTIONS} value={preset} onChange={choosePreset} />
        <Input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => {
            setPreset(undefined)
            set({ from: e.target.value || undefined })
          }}
        />
        <Input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => {
            setPreset(undefined)
            set({ to: e.target.value || undefined })
          }}
        />
        {pick('recruiterId', 'Recruiter', asOptions(recruiters))}
        {pick('teamId', 'Team', asOptions(teams))}
        {pick('employmentType', 'Employment type', EMPLOYMENT_TYPE_OPTIONS)}
        {pick('internalEntity', 'Placement entity', INTERNAL_ENTITY_OPTIONS)}
        {pick('payrollCompany', 'Payroll company', PAYROLL_COMPANY_OPTIONS)}
        {pick('clientState', 'Client state', US_STATE_OPTIONS)}
        {pick('recruiterLocation', 'Recruiter location', RECRUITER_LOCATION_OPTIONS)}
        <Button
          variant="default"
          icon={<ClearOutlined />}
          disabled={!hasFilter}
          onClick={() => {
            setPreset(undefined)
            onChange({})
          }}
        >
          Clear
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">The counters and the table below follow these filters. Weeks run Monday to Sunday.</p>
    </Card>
  )
}
