import React, { Suspense, lazy, useState } from 'react'
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
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      localStorage.getItem('assetx_auth_version') === AUTH_STORAGE_VERSION &&
      (
        sessionStorage.getItem('assetx_auth') === 'true' ||
        localStorage.getItem('assetx_auth_remember') === 'true'
      )
  )
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

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />

  return <App onLogout={handleLogout} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<PageLoading />}>
      <Root />
    </Suspense>
  </React.StrictMode>
)
