import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine)

    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)

    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  return isOnline
}
