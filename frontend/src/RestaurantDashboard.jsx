import { useEffect, useState } from 'react'
import { createOrder, createProduct, getCategories, getProducts, getRestaurantName } from './restaurantApi.js'
import './restaurant-dashboard.css';

function RestaurantDashboard({ username, onLogout }) {
  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [restaurantName, setRestaurantName] = useState('Restaurant')
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

  function addToOrder(food) {
    setOrderSubmissionError('')
    setOrderSubmissionStatus('')
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
      setOrder([])
      setDeliveryAddress('')
      setCustomerPhone('')
      setCarRequired(false)
      setOrderSubmissionStatus(`A rendelés elküldve a futároknak (#${createdOrder.order_id}).`)
    } catch (requestError) {
      setOrderSubmissionError(requestError.message || 'A rendelés elküldése nem sikerült.')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const total = order.reduce((sum, food) => sum + Number(food.price) * (food.quantity || 1), 0)

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
          <h1>Mai <span>ételek.</span></h1>

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
            <h2 style={{ fontSize: 28, marginBottom: 24 }}>Rendelés #{order.length ? '001' : '---'}</h2>
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