import React, { Suspense, lazy, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

const App = lazy(() => import('./App.jsx'))
const LoginPage = lazy(() => import('./LoginPage.jsx'))
const AssessPage = lazy(() => import('./AssessPage.jsx'))
const AUTH_STORAGE_VERSION = 'assetx-auth-2026-09-11'

function PageLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050814', color: '#94A3B8' }}>
      กำลังโหลด...
    </div>
  )
}

function Root() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionAttempt, setSessionAttempt] = useState(0)
  useEffect(() => {
    if (window.location.pathname === '/assess') return
    let cancelled = false
    setCheckingSession(true)
    setSessionError('')
    fetch('/api/login', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok && response.status !== 401) throw new Error(data.error || 'ตรวจเซสชันไม่สำเร็จ')
        if (!cancelled) setIsLoggedIn(response.ok && data.authenticated === true)
      })
      .catch((error) => { if (!cancelled) setSessionError(error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้') })
      .finally(() => { if (!cancelled) setCheckingSession(false) })
    return () => { cancelled = true }
  }, [sessionAttempt])
  const handleLogin = (remember) => {
    localStorage.setItem('assetx_auth_version', AUTH_STORAGE_VERSION)
    if (remember) localStorage.setItem('assetx_auth_remember', 'true')
    else {
      localStorage.removeItem('assetx_auth_remember')
      sessionStorage.setItem('assetx_auth', 'true')
    }
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    sessionStorage.removeItem('assetx_auth')
    localStorage.removeItem('assetx_auth_remember')
    localStorage.removeItem('assetx_auth_version')
    setIsLoggedIn(false)
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
  }

  // หน้าประเมินออนไลน์สาธารณะ — bypass login โดยตั้งใจ ไม่ผ่าน auth gate เลย
  if (window.location.pathname === '/assess') return <AssessPage />
  if (checkingSession) return <PageLoading />
  if (sessionError) return <main><p role="alert">{sessionError}</p><button onClick={() => setSessionAttempt((value) => value + 1)}>ลองใหม่</button></main>

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />

  const initialView = window.location.pathname === '/marketing'
    ? 'marketing'
    : window.location.pathname === '/cases'
      ? 'cases'
      : 'main'

  return <App initialView={initialView} onLogout={handleLogout} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<PageLoading />}>
      <Root />
    </Suspense>
  </React.StrictMode>
)
