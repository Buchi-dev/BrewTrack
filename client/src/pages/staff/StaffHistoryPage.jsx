import { Card, Table, Tag } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const columns = [
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Clock in', dataIndex: 'clockIn', key: 'clockIn' },
  { title: 'Clock out', dataIndex: 'clockOut', key: 'clockOut' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <Tag>{status}</Tag>,
  },
]

export default function StaffHistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="History"
        title="My attendance history"
        description="Staff can only review their own records. Database policies will enforce that boundary."
      />
      <Card>
        <Table columns={columns} dataSource={[]} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  )
}
