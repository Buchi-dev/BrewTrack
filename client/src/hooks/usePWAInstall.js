import { useCallback, useEffect, useMemo, useState } from 'react'

const INSTALL_DISMISSED_KEY = 'brewtrack.installPromptDismissedAt'
const DISMISS_DAYS = 4

function isDismissedRecently() {
  const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0)
  if (!dismissedAt) return false

  const dismissedFor = Date.now() - dismissedAt
  return dismissedFor < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

function isStandaloneMode() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  )
}

function isIOSSafari() {
  const userAgent = window.navigator.userAgent || ''
  const isIOS = /iphone|ipad|ipod/i.test(userAgent)
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent)
  return isIOS && isSafari
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode())
  const [dismissed, setDismissed] = useState(() => isDismissedRecently())

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    const handleInstalled = () => {
      localStorage.removeItem(INSTALL_DISMISSED_KEY)
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismissInstall = useCallback(() => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
    setDismissed(true)
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return null

    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)

    if (choice?.outcome === 'accepted') {
      localStorage.removeItem(INSTALL_DISMISSED_KEY)
      setIsInstalled(true)
    } else {
      dismissInstall()
    }

    return choice
  }, [deferredPrompt, dismissInstall])

  const isIOS = useMemo(() => isIOSSafari(), [])
  const canInstall = Boolean(deferredPrompt) && !isInstalled && !dismissed
  const canShowIOSInstructions = isIOS && !isInstalled && !dismissed

  return {
    canInstall,
    canShowIOSInstructions,
    dismissInstall,
    install,
    isIOS,
    isInstalled,
  }
}
