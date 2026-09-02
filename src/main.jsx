import React, { Suspense, lazy, useState } from 'react'
import ReactDOM from 'react-dom/client'

const App = lazy(() => import('./App.jsx'))
const LoginPage = lazy(() => import('./LoginPage.jsx'))
const AssessPage = lazy(() => import('./AssessPage.jsx'))

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
      sessionStorage.getItem('assetx_auth') === 'true' ||
      localStorage.getItem('assetx_auth_remember') === 'true'
  )
  const handleLogin = (remember) => {
    if (remember) localStorage.setItem('assetx_auth_remember', 'true')
    else sessionStorage.setItem('assetx_auth', 'true')
    setIsLoggedIn(true)
  }

  // หน้าประเมินออนไลน์สาธารณะ — bypass login โดยตั้งใจ ไม่ผ่าน auth gate เลย
  if (window.location.pathname === '/assess') return <AssessPage />

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<PageLoading />}>
      <Root />
    </Suspense>
  </React.StrictMode>
)
