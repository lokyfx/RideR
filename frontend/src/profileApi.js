export async function updateProfilePhone(phoneNumber, username) {
  const response = await fetch(
    `/api/profile/phone?username=${encodeURIComponent(username)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber }),
    },
  )
  const data = await response.json()
  if (!response.ok) {
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'A telefonszám mentése nem sikerült.',
    )
  }
  return data
}
