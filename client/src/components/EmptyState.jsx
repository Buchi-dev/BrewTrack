import { InboxOutlined } from '@ant-design/icons'
import { Empty } from 'antd'

export default function EmptyState({ title = 'No records yet', description }) {
  return (
    <Empty
      image={<InboxOutlined className="empty-icon" />}
      description={
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
      }
    />
  )
}
