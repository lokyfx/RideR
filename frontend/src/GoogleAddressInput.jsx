import { useEffect, useRef } from 'react'

let placesScriptPromise

function loadPlacesScript(apiKey) {
  if (!apiKey) return Promise.resolve(false)
  if (window.google?.maps?.importLibrary) return Promise.resolve(true)
  if (placesScriptPromise) return placesScriptPromise

  placesScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=places`
    script.async = true
    script.onload = () => {
      const startedAt = Date.now()
      const waitForMaps = () => {
        if (window.google?.maps?.importLibrary) {
          resolve(true)
        } else if (Date.now() - startedAt >= 5000) {
          resolve(false)
        } else {
          window.setTimeout(waitForMaps, 50)
        }
      }
      waitForMaps()
    }
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

    loadPlacesScript(apiKey)
      .then(async (loaded) => {
        if (!loaded || !containerRef.current || cancelled) return

        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places')
        await customElements.whenDefined('gmp-place-autocomplete')
        if (cancelled) return

        autocompleteElement = new PlaceAutocompleteElement()
        autocompleteElement.placeholder = placeholderRef.current
        autocompleteElement.value = valueRef.current || ''
        autocompleteElement.includedRegionCodes = ['ro']
        autocompleteElement.style.display = 'block'
        autocompleteElement.style.width = '100%'
        autocompleteElement.style.minHeight = '46px'
        selectHandler = async ({ placePrediction }) => {
          const place = placePrediction.toPlace()
          await place.fetchFields({ fields: ['formattedAddress'] })
          const selectedAddress = place.formattedAddress?.trim()
          if (selectedAddress) {
            autocompleteElement.value = selectedAddress
            onChangeRef.current(selectedAddress)
          }
        }
        autocompleteElement.addEventListener('gmp-select', selectHandler)
        containerRef.current.replaceChildren(autocompleteElement)
      })
      .catch((error) => {
        console.warn('Google Places autocomplete unavailable; using manual input.', error)
      })

    return () => {
      cancelled = true
      if (autocompleteElement && selectHandler) {
        autocompleteElement.removeEventListener('gmp-select', selectHandler)
      }
      autocompleteElement?.remove()
    }
  }, [apiKey])

  return (
    <div className="google-address-input" aria-label="Delivery address">
      <div className="google-address-widget" ref={containerRef} />
    </div>
  )
}

export default GoogleAddressInput
