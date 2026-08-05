import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginPage from './LoginPage.jsx'
import AssessPage from './AssessPage.jsx'

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
    <Root />
  </React.StrictMode>
)
