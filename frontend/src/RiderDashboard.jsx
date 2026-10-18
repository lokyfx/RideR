import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const riderIcon = L.divIcon({
  className: 'rider-pin',
  html: '<span>●</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const orderIcon = L.divIcon({
  className: 'order-pin',
  html: '<span>⌁</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

function RecenterButton({ center }) {
  const map = useMap()

  return (
    <button
      className="map-control"
      type="button"
      onClick={() => map.flyTo(center, 14)}
      aria-label="Center map"
    >
      ◎
    </button>
  )
}

function UpdateMapCenter({ center }) {
  const map = useMap()

  useEffect(() => {
    map.flyTo(center, 14)
  }, [center, map])

  return null
}

function RiderDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationError, setLocationError] = useState(() => (
    typeof navigator !== 'undefined' && navigator.geolocation
      ? 'Locating you...'
      : 'Location is not supported by this browser'
  ))

  useEffect(() => {
    fetch('/api/dashboard')
      .then((response) => {
        if (!response.ok) throw new Error('Dashboard could not be loaded')
        return response.json()
      })
      .then((data) => {
        setDashboard(data)
        setSelectedOrder(data.rider.selected_order)
      })
      .catch(() => setError('The backend is not available. Start the Python API and try again.'))
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation([coords.latitude, coords.longitude])
        setLocationError('')
      },
      (geolocationError) => {
        const message = geolocationError.code === geolocationError.PERMISSION_DENIED
          ? 'Location permission denied'
          : 'Could not get your location'
        setLocationError(message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }, [])

  async function toggleOnline() {
    const online = !dashboard.rider.online
    const response = await fetch('/api/rider/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online }),
    })

    if (!response.ok) return
    setDashboard((current) => ({ ...current, rider: { ...current.rider, online } }))
  }

  async function testBackendConnection() {
    setConnectionStatus('Testing...')

    try {
      const response = await fetch('/api/health')
      if (!response.ok) throw new Error('Health check failed')
      const data = await response.json()
      setConnectionStatus(data.message)
    } catch {
      setConnectionStatus('Backend is not available')
    }
  }

  async function selectOrder(orderId) {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/select`, {
      method: 'PATCH',
    })

    if (!response.ok) return
    const data = await response.json()
    setSelectedOrder(data.selected_order)
  }

  if (error) return <main className="dashboard-message">{error}</main>
  if (!dashboard) return <main className="dashboard-message">Loading dashboard...</main>

  const { rider, orders } = dashboard
  const mapCenter = currentLocation ?? [0, 0]
  const locationLabel = currentLocation
    ? `${currentLocation[0].toFixed(5)}, ${currentLocation[1].toFixed(5)}`
    : locationError

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-mark"><span>R</span>Riderboard</div>
        <div className="topbar-meta">
          <span className={`status-dot ${rider.online ? 'is-online' : ''}`} />
          {rider.online ? 'On duty' : 'Offline'}
          <span className="avatar">{rider.initials}</span>
        </div>
      </header>

      <section className="dashboard-content">
        <aside className="sidebar">
          <p className="eyebrow">{rider.date}</p>
          <h1>Good morning,<br /><span>{rider.name}.</span></h1>
          <button className={`duty-toggle ${rider.online ? 'active' : ''}`} type="button" onClick={toggleOnline}>
            <span className="toggle-track"><span /></span>
            {rider.online ? 'You are online' : 'Go online'}
          </button>
          <div className="connection-test">
            <button type="button" onClick={testBackendConnection}>Test backend connection</button>
            {connectionStatus && <span>{connectionStatus}</span>}
          </div>

          <div className="stats-grid">
            <div><strong>{rider.stats.deliveries}</strong><span>Deliveries</span></div>
            <div><strong>€{rider.stats.earned.toFixed(2)}</strong><span>Earned today</span></div>
            <div><strong>{rider.stats.rating}</strong><span>Rating</span></div>
            <div><strong>{rider.stats.average_time}</strong><span>Avg. time</span></div>
          </div>

          <div className="orders-heading"><h2>Active orders</h2><span>{orders.length}</span></div>
          <div className="order-list">
            {orders.map((order) => (
              <button
                className={`order-card ${selectedOrder === order.id ? 'selected' : ''}`}
                type="button"
                key={order.id}
                onClick={() => selectOrder(order.id)}
              >
                <span className="order-icon">{order.status === 'Ready' ? '↗' : order.status === 'Delivering' ? '→' : '✓'}</span>
                <span className="order-copy"><strong>{order.id} · {order.restaurant}</strong><small>{order.customer} · {order.address}</small></span>
                <span className={`order-status ${order.status.toLowerCase().replace(' ', '-')}`}>{order.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="map-panel">
          <div className="map-label"><span className="live-pulse" /> Current location <span>{locationLabel}</span></div>
          <MapContainer center={mapCenter} zoom={currentLocation ? 14 : 2} scrollWheelZoom className="map">
            <UpdateMapCenter center={mapCenter} />
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {currentLocation && <Marker position={currentLocation} icon={riderIcon}><Popup>You are here</Popup></Marker>}
            {orders.map((order) => <Marker key={order.id} position={order.position} icon={orderIcon}><Popup>{order.id} · {order.restaurant}</Popup></Marker>)}
            <RecenterButton center={mapCenter} />
          </MapContainer>
          {locationError && <div className="map-location-error">{locationError}</div>}
          <div className="map-legend"><span><i className="legend-rider" /> You</span><span><i className="legend-order" /> Order</span></div>
        </section>
      </section>
    </main>
  )
}

export default RiderDashboard
