import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Input, Select, Space, Table, Tag } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const columns = [
  { title: 'Employee', dataIndex: 'employee', key: 'employee' },
  { title: 'Employee No.', dataIndex: 'employeeNumber', key: 'employeeNumber' },
  { title: 'Branch', dataIndex: 'branch', key: 'branch' },
  { title: 'Role', dataIndex: 'role', key: 'role' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <Tag>{status}</Tag>,
  },
]

export default function ManagerEmployeesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Employees"
        description="Manage staff accounts, branch assignments, and account status."
        actions={
          <Button type="primary" icon={<PlusOutlined />}>
            Add employee
          </Button>
        }
      />

      <Card>
        <Space wrap className="table-toolbar">
          <Input prefix={<SearchOutlined />} placeholder="Search employees" allowClear />
          <Select
            placeholder="Status"
            allowClear
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            style={{ minWidth: 160 }}
          />
        </Space>
        <Table columns={columns} dataSource={[]} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  )
}
