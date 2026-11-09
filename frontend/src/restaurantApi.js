function endpoint(path, username) {
  return `${path}?username=${encodeURIComponent(username)}`
}

export async function getProducts(username) {
  const response = await fetch(endpoint('/api/restaurant/products', username))
  if (!response.ok) throw new Error('Products could not be loaded')
  return response.json()
}

export async function getRestaurantName(username) {
  const response = await fetch(endpoint('/api/restaurant/name', username))
  if (!response.ok) throw new Error('Restaurant name could not be loaded')
  return response.json()
}

export async function getCategories(username) {
  const response = await fetch(endpoint('/api/restaurant/categories', username))
  if (!response.ok) throw new Error('Categories could not be loaded')
  return response.json()
}

export async function getRestaurantOrders(username) {
  const response = await fetch(endpoint('/api/restaurant/orders', username))
  if (!response.ok) throw new Error('Orders could not be loaded')
  return response.json()
}

export async function dismissRestaurantOrder(orderId, username) {
  const response = await fetch(endpoint(`/api/restaurant/orders/${orderId}/dismiss`, username), {
    method: 'POST',
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.detail || 'Order could not be dismissed')
  }
  return data
}

export async function createProduct(product, username) {
  const response = await fetch(endpoint('/api/restaurant/products', username), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  })
  if (!response.ok) throw new Error('Product could not be created')
  return response.json()
}

export async function createOrder(order, username) {
  const response = await fetch(endpoint('/api/restaurant/orders', username), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.detail || 'Order could not be sent')
  }
  return data
}
