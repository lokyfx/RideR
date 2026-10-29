const gpsOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
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
    onError,
    gpsOptions,
  )

  return () => navigator.geolocation.clearWatch(watchId)
}
