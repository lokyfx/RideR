import { useEffect, useRef } from 'react'

let placesScriptPromise

function loadPlacesScript(apiKey) {
  if (!apiKey) return Promise.resolve(false)
  if (window.google?.maps?.importLibrary) return Promise.resolve(true)
  if (placesScriptPromise) return placesScriptPromise

  placesScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places`
    script.async = true
    script.onload = () => resolve(Boolean(window.google?.maps?.importLibrary))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return placesScriptPromise
}

function GoogleAddressInput({ value, onChange, placeholder }) {
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const placeholderRef = useRef(placeholder)
  const valueRef = useRef(value)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    onChangeRef.current = onChange
    placeholderRef.current = placeholder
    valueRef.current = value
  }, [onChange, placeholder, value])

  useEffect(() => {
    let autocompleteElement
    let selectHandler
    let cancelled = false

    loadPlacesScript(apiKey).then(async (loaded) => {
      if (!loaded || !containerRef.current || cancelled) return

      const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places')
      if (cancelled) return

      autocompleteElement = new PlaceAutocompleteElement()
      autocompleteElement.placeholder = placeholderRef.current
      autocompleteElement.value = valueRef.current
      selectHandler = async ({ placePrediction }) => {
        const place = placePrediction.toPlace()
        await place.fetchFields({ fields: ['formattedAddress'] })
        if (place.formattedAddress) onChangeRef.current(place.formattedAddress)
      }
      autocompleteElement.addEventListener('gmp-select', selectHandler)
      containerRef.current.replaceChildren(autocompleteElement)
    })

    return () => {
      cancelled = true
      if (autocompleteElement && selectHandler) {
        autocompleteElement.removeEventListener('gmp-select', selectHandler)
      }
      autocompleteElement?.remove()
    }
  }, [apiKey])

  if (!apiKey) {
    return (
      <input
        type="text"
        autoComplete="street-address"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div ref={containerRef} className="google-address-input" aria-label="Delivery address" />
  )
}

export default GoogleAddressInput
