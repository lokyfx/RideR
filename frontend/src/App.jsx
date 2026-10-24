import { useState } from 'react'
import RiderDashboard from './RiderDashboard.jsx'
import RestaurantDashboard from './RestaurantDashboard.jsx'
import LoginPage from './LoginPage.jsx'
import './App.css'

function App() {
  const [view, setView] = useState('restaurant')
  const [user, setUser] = useState(null)

  return (
    <>
      <nav className="view-switcher">
        <button type="button" onClick={() => setView('rider')}>Futár</button>
        <button type="button" onClick={() => setView('restaurant')}>Étterem</button>
        <button type="button" onClick={() => setView('login')}>Belépés</button>
      </nav>
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
