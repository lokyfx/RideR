import { useState } from 'react'
import RiderDashboard from './RiderDashboard.jsx'
import RestaurantDashboard from './RestaurantDashboard.jsx'
import LoginPage from './LoginPage.jsx'
import './App.css'

function App() {
  const [view, setView] = useState('restaurant')

  return (
    <>
      <nav className="view-switcher">
        <button type="button" onClick={() => setView('rider')}>Futár</button>
        <button type="button" onClick={() => setView('restaurant')}>Étterem</button>
        <button type="button" onClick={() => setView('login')}>Belépés</button>
      </nav>
      {view === 'login'
        ? <LoginPage onLogin={() => setView('restaurant')} />
        : view === 'rider'
          ? <RiderDashboard />
          : <RestaurantDashboard />}
    </>
  )
}

export default App
