import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Select, Space, Typography } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
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

// The Super Admin's filter bar: date (any of four dates, a quick range or custom dates), recruiter, team and
// intake fields. "filters" is what the parent sends to the backend; every change calls onChange with a new object.
export default function CandidateFilters({ filters, onChange }) {
  const [recruiters, setRecruiters] = useState([])
  const [teams, setTeams] = useState([])
  const [preset, setPreset] = useState(undefined)

  useEffect(() => {
    // The pickers are a nicety: if a list can't load, the other filters still work
    getUsersByRole('RECRUITER').then((users) => setRecruiters(users.map((u) => ({ id: u.id, name: u.name })))).catch(() => {})
    getTeams().then(setTeams).catch(() => {})
  }, [])

  function set(changes) {
    onChange({ ...filters, ...changes })
  }

  function setRange(from, to) {
    set({ from: from ? from.format('YYYY-MM-DD') : undefined, to: to ? to.format('YYYY-MM-DD') : undefined })
  }

  function choosePreset(key) {
    setPreset(key)
    const range = presetRange(key)
    if (range) setRange(range[0], range[1])
    else setRange(null, null)
  }

  const hasFilter = Object.values(filters).some((v) => v !== undefined && v !== '')
  const select = (key, placeholder, options, width = 170) => (
    <Select
      allowClear
      showSearch={{ optionFilterProp: 'label' }}
      placeholder={placeholder}
      options={options}
      value={filters[key]}
      onChange={(value) => set({ [key]: value })}
      style={{ width }}
    />
  )

  return (
    <Card size="small" style={{ marginBottom: 16 }} title="Filters">
      <Space wrap size={[12, 12]}>
        <Select
          options={DATE_FIELD_OPTIONS}
          value={filters.dateField ?? 'submitted'}
          onChange={(dateField) => set({ dateField })}
          style={{ width: 160 }}
        />
        <Select
          allowClear
          placeholder="Quick range"
          options={PRESET_OPTIONS}
          value={preset}
          onChange={(key) => choosePreset(key)}
          style={{ width: 140 }}
        />
        <DatePicker.RangePicker
          value={[filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null]}
          onChange={(range) => {
            setPreset(undefined)
            setRange(range?.[0], range?.[1])
          }}
        />
        {select('recruiterId', 'Recruiter', asOptions(recruiters), 190)}
        {select('teamId', 'Team', asOptions(teams))}
        {select('employmentType', 'Employment type', EMPLOYMENT_TYPE_OPTIONS)}
        {select('internalEntity', 'Placement entity', INTERNAL_ENTITY_OPTIONS, 200)}
        {select('payrollCompany', 'Payroll company', PAYROLL_COMPANY_OPTIONS, 200)}
        {select('clientState', 'Client state', US_STATE_OPTIONS, 180)}
        {select('recruiterLocation', 'Recruiter location', RECRUITER_LOCATION_OPTIONS)}
        <Button
          icon={<ClearOutlined />}
          disabled={!hasFilter}
          onClick={() => {
            setPreset(undefined)
            onChange({})
          }}
        >
          Clear
        </Button>
      </Space>
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          The counters and the table below follow these filters. Weeks run Monday to Sunday.
        </Typography.Text>
      </div>
    </Card>
  )
}
