const gpsOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
}

function getLocationErrorMessage(error) {
  switch (error.code) {
    case 1:
      return 'Location access was denied. Allow location access in your browser to show your position.'
    case 2:
      return 'Your location is currently unavailable.'
    case 3:
      return 'The location request timed out. Please try again.'
    default:
      return 'Unable to determine your location.'
  }
}

export function watchGps(onLocation, onError) {
  if (!navigator.geolocation) {
    onError('Location is not supported by this browser')
    return () => {}
  }

  const watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      if (coords.accuracy > 100) {
        onError(`Low GPS accuracy: ${Math.round(coords.accuracy)}m`)
        return
      }

      onLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      })
    },
    (error) => onError(getLocationErrorMessage(error)),
    gpsOptions,
  )

  return () => navigator.geolocation.clearWatch(watchId)
}
