import { useEffect, useState } from 'react'
import { createOrder, createProduct, dismissRestaurantOrder, getCategories, getProducts, getRestaurantName, getRestaurantOrders } from './restaurantApi.js'
import { findRider } from './restaurantApi.js'
import './restaurant-dashboard.css';

function RestaurantDashboard({ username, onLogout }) {
  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [restaurantOrders, setRestaurantOrders] = useState([])
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [restaurantOrdersError, setRestaurantOrdersError] = useState('')
  const [restaurantOrderActionError, setRestaurantOrderActionError] = useState('')
  const [showDeliveredOrders, setShowDeliveredOrders] = useState(false)
  const [pendingDismissOrderId, setPendingDismissOrderId] = useState(null)
  const [order, setOrder] = useState([])
  const [carRequired, setCarRequired] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState('')
  const [orderSubmissionError, setOrderSubmissionError] = useState('')
  const [orderSubmissionStatus, setOrderSubmissionStatus] = useState('')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState('Nyitva')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    Promise.all([
      getProducts(username),
      getRestaurantName(username),
      getCategories(username),
    ])
      .then(([products, restaurant, categoryList]) => {
        setFoods(products)
        setRestaurantName(restaurant.name)
        setCategories(categoryList)
      })
      .catch(() => setError('Az ételek nem tölthetők be.'))
      .finally(() => setIsLoading(false))
  }, [username])

  useEffect(() => {
    let isMounted = true

    async function refreshRestaurantOrders() {
      try {
        const orders = await getRestaurantOrders(username)
        if (isMounted) {
          setRestaurantOrders(orders)
          setRestaurantOrdersError('')
        }
      } catch {
        if (isMounted) setRestaurantOrdersError('A rendelések nem tölthetők be.')
      }
    }

    refreshRestaurantOrders()
    const intervalId = window.setInterval(refreshRestaurantOrders, 3000)
    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [username])

  async function addFood(event) {
    event.preventDefault()
    if (!name.trim() || !price) return

    try {
      const food = await createProduct({
        name: name.trim(),
        price: Number(price),
        category_id: Number(categoryId),
        stock: Number(stock),
      }, username)
      setFoods((current) => [...current, food])
      setName('')
      setPrice('')
      setCategoryId('')
      setStock('')
    } catch {
      setError('Az étel mentése nem sikerült.')
    }
  }

  async function dismissDeliveredOrder(orderId) {
    if (pendingDismissOrderId !== null) return
    setPendingDismissOrderId(orderId)
    setRestaurantOrderActionError('')

    try {
      await dismissRestaurantOrder(orderId, username)
      setRestaurantOrders((current) => current.filter((item) => item.order_id !== orderId))
    } catch (requestError) {
      setRestaurantOrderActionError(requestError.message || 'A rendelés elrejtése nem sikerült.')
    } finally {
      setPendingDismissOrderId(null)
    }
  }

  function addToOrder(food) {
    setOrderSubmissionError('')
    setOrderSubmissionStatus('')
    setCurrentOrderId(null)
    setOrder((current) => {
      const existingFood = current.find((item) => item.id === food.id)

      if (existingFood) {
        return current.map((item) => (
          item.id === food.id ? { ...item, quantity: (item.quantity || 0) + 1 } : item
        ))
      }

      return [...current, { ...food, quantity: 1 }]
    })
  }

  function updateQuantity(foodId, change) {
    setOrder((current) => current
      .map((item) => item.id === foodId
        ? { ...item, quantity: (item.quantity || 1) + change }
        : item)
      .filter((item) => item.quantity > 0))
  }

  async function sendOrderToRiders() {
    if (isSubmittingOrder) return
    if (!deliveryAddress.trim()) {
      setOrderSubmissionError('A futár keresése előtt add meg a szállítási címet.')
      setOrderSubmissionStatus('')
      return
    }
    if (!customerPhone.trim()) {
      setOrderSubmissionError('A futár keresése előtt adj meg telefonszámot.')
      setOrderSubmissionStatus('')
      return
    }
    const trimmedPhone = customerPhone.trim()
    const phoneDigitCount = trimmedPhone.replace(/\D/g, '').length
    if (!/^\+?[\d\s().-]+$/.test(trimmedPhone) || phoneDigitCount < 7 || phoneDigitCount > 15) {
      setOrderSubmissionError('Érvényes, 7–15 számjegyből álló telefonszámot adj meg.')
      setOrderSubmissionStatus('')
      return
    }

    setIsSubmittingOrder(true)
    setOrderSubmissionError('')
    setOrderSubmissionStatus('')

    try {
      const createdOrder = await createOrder({
        delivery_address: deliveryAddress.trim(),
        customer_phone: trimmedPhone,
        car_required: carRequired,
        items: order.map((food) => ({
          product_id: food.id,
          quantity: food.quantity,
        })),
      }, username)
      setCurrentOrderId(createdOrder.order_id)
      setRestaurantOrders((current) => [
        {
          order_id: createdOrder.order_id,
          status: createdOrder.status,
          delivery_address: deliveryAddress.trim(),
          rider_name: null,
        },
        ...current.filter((restaurantOrder) => restaurantOrder.order_id !== createdOrder.order_id),
      ])
      setOrder([])
      setDeliveryAddress('')
      setCustomerPhone('')
      setCarRequired(false)
      await findRider(createdOrder.order_id, username)
      setOrderSubmissionStatus(`Futár ajánlat elküldve a rendeléshez (#${createdOrder.order_id}).`)
    } catch (requestError) {
      setOrderSubmissionError(requestError.message || 'A rendelés elküldése nem sikerült.')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const total = order.reduce((sum, food) => sum + Number(food.price) * (food.quantity || 1), 0)
  const activeOrders = restaurantOrders.filter((restaurantOrder) => restaurantOrder.status !== 'delivered')
  const deliveredOrders = restaurantOrders.filter((restaurantOrder) => restaurantOrder.status === 'delivered')

  function renderRestaurantOrder(restaurantOrder) {
    return (
      <article className="restaurant-order-card" key={restaurantOrder.order_id}>
        <div className="restaurant-order-heading">
          <strong>Rendelés #{restaurantOrder.order_id}</strong>
          <span className={`restaurant-order-status status-${restaurantOrder.status}`}>
            {restaurantOrder.status === 'waiting'
              ? 'Várakozás a futár elfogadására'
              : restaurantOrder.status === 'accepted'
                ? 'Futár elfogadta'
                : restaurantOrder.status === 'delivering'
                  ? 'Futár úton van'
                  : 'Kézbesítve'}
          </span>
          {restaurantOrder.status === 'delivered' && (
            <button
              className="restaurant-order-dismiss"
              type="button"
              aria-label={`Rendelés #${restaurantOrder.order_id} eltüntetése`}
              title="Eltüntetés az előzményekből"
              disabled={pendingDismissOrderId === restaurantOrder.order_id}
              onClick={() => dismissDeliveredOrder(restaurantOrder.order_id)}
            >
              {pendingDismissOrderId === restaurantOrder.order_id ? '…' : '×'}
            </button>
          )}
        </div>
        <small>{restaurantOrder.delivery_address}</small>
        {restaurantOrder.rider_name && (
          <small>Futár: {restaurantOrder.rider_name}</small>
        )}
      </article>
    )
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-mark"><span>{restaurantName?.charAt(0).toUpperCase()}</span>{restaurantName}</div>
        <div className="topbar-meta">
          <div className="status-select">
            <button
              className="status-button"
              type="button"
              onClick={() => setShowStatusMenu((open) => !open)}
            >
              <span className={`status-dot ${status === 'Nyitva' ? 'is-online' : ''}`} />
              {status}
              <span className="status-chevron">⌄</span>
            </button>
            {showStatusMenu && (
              <div className="status-menu">
                {['Nyitva', 'Zárva', 'Ideiglenesen zárva'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setStatus(option)
                      setShowStatusMenu(false)
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="profile-select">
            <button
              className="avatar"
              type="button"
              onClick={() => setShowProfileMenu((open) => !open)}
            >
              RE
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
          <p className="eyebrow">Étlap kezelése</p>

          <form className="restaurant-form" onSubmit={addFood} style={{ display: 'grid', gap: 8, marginBottom: 19 }}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Étel neve" />
            <input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0" step="0.01" placeholder="Ár (€)" />
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              <option value="">Kategória kiválasztása</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input value={stock} onChange={(event) => setStock(event.target.value)} type="number" min="0" step="1" placeholder="Készlet" required />
            <button className="duty-toggle active" type="submit">+ Étel hozzáadása</button>
          </form>
          {error && <p className="login-message" role="status">{error}</p>}

          <div className="orders-heading"><h2>Étlap</h2><span>{foods.length}</span></div>
          <div className="order-list">
            {isLoading ? <p>Étlap betöltése...</p> : foods.map((food) => (
              <div className="order-card" key={food.id}>
                <span className="order-icon">🍽</span>
                <span className="order-copy"><strong>{food.name}</strong><small>{Number(food.price).toFixed(2)} €</small></span>
                <button type="button" onClick={() => addToOrder(food)}>+</button>
              </div>
            ))}
          </div>
        </aside>

        <section className="map-panel" style={{ padding: '54px 5vw', background: 'var(--paper)' }}>
          <p className="eyebrow">Aktuális rendelés</p>
          <div className="order-heading-row">
            <h2 style={{ fontSize: 28, marginBottom: 24 }}>
              {order.length > 0
                ? 'Új rendelés'
                : currentOrderId !== null
                  ? `Rendelés #${currentOrderId}`
                  : '---'}
            </h2>
            {order.length > 0 && (
              <label className={`car-required-toggle ${carRequired ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={carRequired}
                  onChange={(event) => setCarRequired(event.target.checked)}
                />
                <span>Autó szükséges</span>
              </label>
            )}
          </div>
          {order.length === 0 ? <p style={{ color: 'var(--muted)' }}>Válassz ételt az étlapról.</p> : (
            <div className="order-list">
              <label className="delivery-address-field">
                <span>Szállítási cím</span>
                <input
                  type="text"
                  autoComplete="street-address"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Add meg a szállítási címet"
                />
              </label>
              <label className="delivery-address-field">
                <span>Telefonszám</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Adj meg egy telefonszámot"
                  required
                />
              </label>
              {order.map((food) => (
                <div className="order-card" key={food.id}>
                  <span className="order-copy"><strong>{food.name}</strong><small>{Number(food.price).toFixed(2)} €</small></span>
                  <span className="quantity-control">
                    <button className="quantity-button" type="button" onClick={() => updateQuantity(food.id, -1)} aria-label={`${food.name} mennyiségének csökkentése`}>−</button>
                    <span className="quantity-value">{food.quantity}</span>
                    <button className="quantity-button" type="button" onClick={() => updateQuantity(food.id, 1)} aria-label={`${food.name} mennyiségének növelése`}>+</button>
                  </span>
                </div>
              ))}
              <div className="orders-heading" style={{ marginTop: 12 }}><h2>Összesen</h2><strong>{total.toFixed(2)} €</strong></div>
            </div>
          )}
        </section>
      </section>
      <section className="restaurant-orders-panel" aria-live="polite">
        {restaurantOrderActionError && (
          <p className="login-message" role="alert">{restaurantOrderActionError}</p>
        )}
        {restaurantOrdersError
          ? <p className="login-message" role="alert">{restaurantOrdersError}</p>
          : (
            <>
              <section className="restaurant-active-orders" aria-labelledby="active-orders-heading">
                <div className="orders-heading">
                  <h2 id="active-orders-heading">Aktív rendelések</h2>
                  <span>{activeOrders.length}</span>
                </div>
                {activeOrders.length === 0
                  ? <p className="restaurant-orders-empty">Jelenleg nincs aktív rendelés.</p>
                  : (
                    <div className="restaurant-orders-list">
                      {activeOrders.map(renderRestaurantOrder)}
                    </div>
                  )}
              </section>

              <section
                className="restaurant-order-history"
                aria-labelledby="restaurant-order-history-heading"
              >
                <div className="restaurant-order-history-header">
                  <div className="restaurant-order-history-heading">
                    <h3 id="restaurant-order-history-heading">Rendelési előzmények</h3>
                    <span>{deliveredOrders.length}</span>
                  </div>
                  <button
                    className="restaurant-order-history-toggle"
                    type="button"
                    aria-expanded={showDeliveredOrders}
                    aria-controls="restaurant-order-history-list"
                    onClick={() => setShowDeliveredOrders((showing) => !showing)}
                  >
                    {showDeliveredOrders ? 'Előzmények elrejtése' : 'Előzmények megtekintése'}
                  </button>
                </div>
                <div
                  className="restaurant-order-history-content"
                  id="restaurant-order-history-list"
                  hidden={!showDeliveredOrders}
                >
                  {deliveredOrders.length === 0
                    ? <p className="restaurant-orders-empty">Még nincs kézbesített rendelés.</p>
                    : (
                      <div className="restaurant-order-history-list">
                        {deliveredOrders.map(renderRestaurantOrder)}
                      </div>
                    )}
                </div>
              </section>
            </>
          )}
      </section>
      {order.length > 0 && (
        <>
          {orderSubmissionError && <p className="order-submission-message error" role="alert">{orderSubmissionError}</p>}
          <button
            className="find-rider-button"
            type="button"
            onClick={sendOrderToRiders}
            disabled={isSubmittingOrder}
          >
            {isSubmittingOrder ? 'Küldés...' : 'Find Rider'}
          </button>
        </>
      )}
      {order.length === 0 && orderSubmissionStatus && (
        <p className="order-submission-message success" role="status">{orderSubmissionStatus}</p>
      )}
    </main>
  )
}

export default RestaurantDashboard