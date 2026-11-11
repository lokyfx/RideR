import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { watchGps } from './gps.js'

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

function googleMapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

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

function RiderDashboard({ username, onLogout }) {
  const [dashboard, setDashboard] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [error, setError] = useState('')
  const [orderActionError, setOrderActionError] = useState('')
  const [pendingOrderId, setPendingOrderId] = useState(null)
  const [activeOfferId, setActiveOfferId] = useState(null)
  const [acceptProgress, setAcceptProgress] = useState(0)
  const knownOfferIdsRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationError, setLocationError] = useState(() => (
    typeof navigator !== 'undefined' && navigator.geolocation
      ? 'Locating you...'
      : 'Location is not supported by this browser'
  ))
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const refreshDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboard?username=${encodeURIComponent(username)}`)
      if (!response.ok) throw new Error('Dashboard could not be loaded')
      const data = await response.json()
      const offers = data.orders.filter((order) => order.is_offer)
      if (knownOfferIdsRef.current) {
        const newOffer = offers.find((order) => !knownOfferIdsRef.current.has(order.id))
        if (newOffer) {
          setActiveOfferId(newOffer.id)
          setAcceptProgress(0)
        }
      }
      knownOfferIdsRef.current = new Set(offers.map((order) => order.id))
      setDashboard(data)
      setSelectedOrder((current) => (
        data.orders.some((order) => order.id === current)
          ? current
          : data.orders[0]?.id ?? null
      ))
      setError('')
    } catch {
      setError('The backend is not available. Start the Python API and try again.')
    }
  }, [username])

  useEffect(() => {
    const initialRefreshId = window.setTimeout(refreshDashboard, 0)
    const intervalId = window.setInterval(refreshDashboard, 3000)
    return () => {
      window.clearTimeout(initialRefreshId)
      window.clearInterval(intervalId)
    }
  }, [refreshDashboard])

  useEffect(() => {
    return watchGps(
      (location) => {
        setCurrentLocation([location.latitude, location.longitude])
        setLocationError('')
        fetch(`/api/rider/location?username=${encodeURIComponent(username)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        }).catch(() => {})
      },
      setLocationError,
    )
  }, [username])

  async function toggleOnline() {
    const online = !dashboard.rider.online
    try {
      const response = await fetch(`/api/rider/status?username=${encodeURIComponent(username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Rider status could not be updated.')
      setDashboard((current) => ({ ...current, rider: { ...current.rider, online: data.online } }))
      setOrderActionError('')
    } catch (requestError) {
      setOrderActionError(requestError.message || 'Rider status could not be updated.')
    }
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

  async function respondToOrder(order, action) {
    if (pendingOrderId) return
    setPendingOrderId(order.id)
    setOrderActionError('')

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.id.slice(1))}/${action}?username=${encodeURIComponent(username)}`,
        { method: 'POST' },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'The order action could not be completed.')
      if (order.id === activeOfferId) {
        setActiveOfferId(null)
        setAcceptProgress(0)
      }
      await refreshDashboard()
    } catch (requestError) {
      setOrderActionError(requestError.message || 'The order action could not be completed.')
    } finally {
      setPendingOrderId(null)
    }
  }

  const offerOrder = dashboard?.orders.find((order) => order.id === activeOfferId)

  if (error) return <main className="dashboard-message">{error}</main>
  if (!dashboard) return <main className="dashboard-message">Loading dashboard...</main>

  const { rider, orders } = dashboard
  const mapCenter = currentLocation ?? [0, 0]
  const locationLabel = currentLocation
    ? `${currentLocation[0].toFixed(5)}, ${currentLocation[1].toFixed(5)}`
    : locationError

  return (
    <main className="dashboard-shell">
      {offerOrder && (
        <div className="rider-offer-popup" role="dialog" aria-live="assertive" aria-label="New order offer">
          <p className="eyebrow">New order offer</p>
          <h2>{offerOrder.id} · {offerOrder.restaurant}</h2>
          <p>{offerOrder.customer} · {offerOrder.address || 'No address provided'}</p>
          {offerOrder.car_required && <small className="rider-order-car">Car requested</small>}
          <label className="accept-slider">
            <span>Slide to accept</span>
            <input
              type="range"
              min="0"
              max="100"
              value={acceptProgress}
              disabled={pendingOrderId === offerOrder.id}
              onChange={(event) => {
                const progress = Number(event.target.value)
                setAcceptProgress(progress)
                if (progress === 100) respondToOrder(offerOrder, 'accept')
              }}
            />
          </label>
          <button
            className="decline-offer-button"
            type="button"
            disabled={pendingOrderId === offerOrder.id}
            onClick={() => respondToOrder(offerOrder, 'decline')}
          >
            Decline
          </button>
        </div>
      )}
      <header className="topbar">
        <div className="brand-mark"><span>R</span>RideR</div>
        <div className="topbar-meta">
          <span className={`status-dot ${rider.online ? 'is-online' : ''}`} />
          {rider.online ? 'On duty' : 'Offline'}
          <div className="profile-select">
            <button
              className="avatar"
              type="button"
              onClick={() => setShowProfileMenu((open) => !open)}
            >
              {rider.initials}
            </button>
            {showProfileMenu && (
              <div className="profile-menu">
                <button type="button" onClick={onLogout}>Log out</button>
              </div>
            )}
          </div>
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

          <div className="orders-heading"><h2>Orders &amp; offers</h2><span>{orders.length}</span></div>
          {orderActionError && <p className="login-message" role="alert">{orderActionError}</p>}
          <div className="order-list">
            {orders.length === 0
              ? <p className="rider-empty-orders">No active orders or offers.</p>
              : orders.map((order) => (
              <div
                className={`order-card rider-order-card ${selectedOrder === order.id ? 'selected' : ''}`}
                key={order.id}
              >
                <div
                  className="rider-order-details"
                  onClick={() => setSelectedOrder(order.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedOrder(order.id)
                  }}
                >
                  <span className="order-icon">{order.is_offer ? '↗' : order.status === 'Delivering' ? '→' : '✓'}</span>
                  <span className="order-copy">
                    <span className="rider-order-title">
                      <strong>{order.id} · {order.restaurant}</strong>
                      {order.address && (
                        <a
                          className="rider-map-link"
                          href={googleMapsUrl(order.address)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Cím megnyitása Google Mapsben"
                          title="Megnyitás Google Mapsben"
                        >
                          ⌖
                        </a>
                      )}
                    </span>
                    <small>{order.customer} · {order.address || 'No address provided'}</small>
                    {order.car_required && <small className="rider-order-car"></small>}
                  </span>
                  <span className="order-status">{order.is_offer ? 'New offer' : order.status}</span>
                </div>
                {order.phone && (
                  <a
                    className="rider-customer-phone"
                    href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}
                  >
                    Telefon: {order.phone}
                  </a>
                )}
                {order.is_offer && (
                  <div className="rider-order-actions">
                    <button
                      className="accept-order-button"
                      type="button"
                      disabled={pendingOrderId === order.id}
                      onClick={() => respondToOrder(order, 'accept')}
                    >
                      {pendingOrderId === order.id ? 'Sending...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={pendingOrderId === order.id}
                      onClick={() => respondToOrder(order, 'decline')}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {!order.is_offer && order.status === 'Accepted' && (
                  <div className="rider-order-actions">
                    <button
                      className="accept-order-button"
                      type="button"
                      disabled={pendingOrderId === order.id}
                      onClick={() => respondToOrder(order, 'deliver')}
                    >
                      {pendingOrderId === order.id ? 'Updating...' : 'Delivered'}
                    </button>
                  </div>
                )}
                {!order.is_offer && order.status === 'Delivered' && (
                  <div className="rider-order-actions">
                    <button
                      type="button"
                      aria-label={`Dismiss delivered order ${order.id}`}
                      title="Remove from dashboard"
                      disabled={pendingOrderId === order.id}
                      onClick={() => respondToOrder(order, 'dismiss')}
                    >
                      {pendingOrderId === order.id ? 'Updating...' : '×'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <section className="map-panel">
          <div className="map-label"><span className="live-pulse" /> Current location <span>{locationLabel}</span></div>
          <MapContainer center={mapCenter} zoom={currentLocation ? 14 : 2} scrollWheelZoom className="map">
            <UpdateMapCenter center={mapCenter} />
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {currentLocation && <Marker position={currentLocation} icon={riderIcon}><Popup>You are here</Popup></Marker>}
            {orders.filter((order) => order.position).map((order) => <Marker key={order.id} position={order.position} icon={orderIcon}><Popup>{order.id} · {order.restaurant}</Popup></Marker>)}
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
