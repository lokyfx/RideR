import { useState } from 'react'

const initialFoods = [
  { id: 1, name: 'Margherita pizza', price: 12 },
  { id: 2, name: 'Caesar saláta', price: 8 },
  { id: 3, name: 'Házi limonádé', price: 4 },
]

function RestaurantDashboard() {
  const [foods, setFoods] = useState(initialFoods)
  const [order, setOrder] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  function addFood(event) {
    event.preventDefault()
    if (!name.trim() || !price) return
    setFoods((current) => [...current, { id: Date.now(), name: name.trim(), price: Number(price) }])
    setName('')
    setPrice('')
  }

  function addToOrder(food) {
    setOrder((current) => [...current, food])
  }

  const total = order.reduce((sum, food) => sum + food.price, 0)

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-mark"><span>R</span>Restaurant</div>
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

          <div className="orders-heading"><h2>Étlap</h2><span>{foods.length}</span></div>
          <div className="order-list">
            {foods.map((food) => (
              <div className="order-card" key={food.id}>
                <span className="order-icon">🍽</span>
                <span className="order-copy"><strong>{food.name}</strong><small>{food.price.toFixed(2)} €</small></span>
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
              {order.map((food, index) => <div className="order-card" key={`${food.id}-${index}`}><span className="order-copy"><strong>{food.name}</strong><small>{food.price.toFixed(2)} €</small></span></div>)}
              <div className="orders-heading" style={{ marginTop: 12 }}><h2>Összesen</h2><strong>{total.toFixed(2)} €</strong></div>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default RestaurantDashboard