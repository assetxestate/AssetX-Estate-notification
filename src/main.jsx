import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginPage from './LoginPage.jsx'

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
  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
