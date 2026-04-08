import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginPage from './LoginPage.jsx'

function Root() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => sessionStorage.getItem('assetx_auth') === 'true'
  )
  const handleLogin = () => {
    sessionStorage.setItem('assetx_auth', 'true')
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
