import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="screen-center">
      <Result
        status="403"
        title="Access restricted"
        subTitle="Your account does not have permission to open this area."
        extra={
          <Link to="/">
            <Button type="primary">Go to my workspace</Button>
          </Link>
        }
      />
    </div>
  )
}
