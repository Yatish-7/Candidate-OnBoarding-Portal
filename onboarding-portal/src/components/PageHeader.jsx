import { Typography } from 'antd'

// The title row at the top of a page: big title, a short line under it, and buttons on the right
export default function PageHeader({ title, subtitle, extra }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}
    >
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {extra}
    </div>
  )
}
