import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="screen-center">
      <Result
        status="404"
        title="Page not found"
        subTitle="This area does not exist in the attendance workspace."
        extra={
          <Link to="/">
            <Button type="primary">Go home</Button>
          </Link>
        }
      />
    </div>
  )
}
