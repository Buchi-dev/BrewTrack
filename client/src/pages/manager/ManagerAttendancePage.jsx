import { SearchOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const columns = [
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Employee', dataIndex: 'employee', key: 'employee' },
  { title: 'Branch', dataIndex: 'branch', key: 'branch' },
  { title: 'Clock in', dataIndex: 'clockIn', key: 'clockIn' },
  { title: 'Clock out', dataIndex: 'clockOut', key: 'clockOut' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <Tag>{status}</Tag>,
  },
]

export default function ManagerAttendancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Attendance records"
        description="Search, filter, and inspect selfie-backed attendance entries."
      />

      <Card>
        <Space wrap className="table-toolbar">
          <Input prefix={<SearchOutlined />} placeholder="Employee name or number" allowClear />
          <DatePicker />
          <Select
            placeholder="Status"
            allowClear
            options={[
              { value: 'present', label: 'Present' },
              { value: 'late', label: 'Late' },
              { value: 'completed', label: 'Completed' },
              { value: 'incomplete', label: 'Incomplete' },
            ]}
            style={{ minWidth: 160 }}
          />
          <Button type="primary">Apply filters</Button>
        </Space>
        <Table columns={columns} dataSource={[]} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  )
}
