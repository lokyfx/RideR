import { useEffect, useState } from 'react'
import { createProduct, getProducts, getRestaurantName } from './restaurantApi.js'

function RestaurantDashboard() {
  const [foods, setFoods] = useState([])
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [order, setOrder] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([getProducts(), getRestaurantName()])
      .then(([products, restaurant]) => {
        setFoods(products)
        setRestaurantName(restaurant.name)
      })
      .catch(() => setError('Az ételek nem tölthetők be.'))
      .finally(() => setIsLoading(false))
  }, [])

  async function addFood(event) {
    event.preventDefault()
    if (!name.trim() || !price) return

    try {
      const food = await createProduct({ name: name.trim(), price: Number(price) })
      setFoods((current) => [...current, food])
      setName('')
      setPrice('')
    } catch {
      setError('Az étel mentése nem sikerült.')
    }
  }

  function addToOrder(food) {
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

  const total = order.reduce((sum, food) => sum + Number(food.price) * (food.quantity || 1), 0)

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-mark"><span>R</span>{restaurantName}</div>
        <div className="topbar-meta"><span className="status-dot is-online" /> Nyitva <span className="avatar">RE</span></div>
      </header>

      <section className="dashboard-content">
        <aside className="sidebar">
          <p className="eyebrow">Étlap kezelése</p>
          <h1>Mai <span>ételek.</span></h1>

          <form onSubmit={addFood} style={{ display: 'grid', gap: 8, marginBottom: 28 }}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Étel neve" />
            <input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0" step="0.01" placeholder="Ár (€)" />
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
          <h2 style={{ fontSize: 28, marginBottom: 24 }}>Rendelés #{order.length ? '001' : '---'}</h2>
          {order.length === 0 ? <p style={{ color: 'var(--muted)' }}>Válassz ételt az étlapról.</p> : (
            <div className="order-list">
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
    </main>
  )
}

export default RestaurantDashboard