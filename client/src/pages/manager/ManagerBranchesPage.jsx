import { PlusOutlined } from '@ant-design/icons'
import { Button, Card, Table, Tag } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const columns = [
  { title: 'Branch', dataIndex: 'name', key: 'name' },
  { title: 'Code', dataIndex: 'code', key: 'code' },
  { title: 'Timezone', dataIndex: 'timezone', key: 'timezone' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <Tag>{status}</Tag>,
  },
]

export default function ManagerBranchesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Branches"
        description="Maintain branch records and optional location verification settings."
        actions={
          <Button type="primary" icon={<PlusOutlined />}>
            Add branch
          </Button>
        }
      />
      <Card>
        <Table columns={columns} dataSource={[]} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  )
}
