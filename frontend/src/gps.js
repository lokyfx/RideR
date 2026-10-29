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
    ({ coords }) => onLocation([coords.latitude, coords.longitude]),
    (error) => onError(
      error.code === error.PERMISSION_DENIED
        ? 'Location permission denied'
        : 'Could not get your location',
    ),
    gpsOptions,
  )

  return () => navigator.geolocation.clearWatch(watchId)
}
