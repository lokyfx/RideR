export async function getProducts() {
  const response = await fetch('/api/restaurant/products')
  if (!response.ok) throw new Error('Products could not be loaded')
  return response.json()
}

export async function createProduct(product) {
  const response = await fetch('/api/restaurant/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  })
  if (!response.ok) throw new Error('Product could not be created')
  return response.json()
}
