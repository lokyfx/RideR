import { useState } from 'react'
import RiderDashboard from './RiderDashboard.jsx'
import RestaurantDashboard from './RestaurantDashboard.jsx'
import LoginPage from './LoginPage.jsx'
import './App.css'

function App() {
  const [view, setView] = useState('login')
  const [user, setUser] = useState(null)

  return (
    <>
      {view === 'login'
        ? <LoginPage onLogin={(loggedInUser) => {
          setUser(loggedInUser)
          setView(loggedInUser.role === 'restaurant' ? 'restaurant' : 'rider')
        }} />
        : view === 'rider'
          ? <RiderDashboard />
          : <RestaurantDashboard username={user?.username} />}
    </>
  )
}

export default App
