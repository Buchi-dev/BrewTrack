import { Typography } from 'antd'

const { Paragraph, Title } = Typography

export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <Title level={1}>{title}</Title>
        {description && <Paragraph type="secondary">{description}</Paragraph>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
