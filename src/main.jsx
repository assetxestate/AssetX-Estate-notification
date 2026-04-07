import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// import LoginPage from './LoginPage.jsx' // ปิดชั่วคราว — เปิดใช้เมื่อระบบพร้อม

function Root() {
  // TODO: เปิด login เมื่อระบบพร้อม — uncomment โค้ดด้านล่างและลบ return <App /> ออก
  // const [isLoggedIn, setIsLoggedIn] = useState(
  //   () => sessionStorage.getItem('assetx_auth') === 'true'
  // )
  // const handleLogin = () => {
  //   sessionStorage.setItem('assetx_auth', 'true')
  //   setIsLoggedIn(true)
  // }
  // if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
