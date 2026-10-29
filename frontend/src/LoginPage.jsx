import { useState } from 'react'
import './LoginPage.css'

function LoginPage({ onLogin }) {
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationRole, setRegistrationRole] = useState('rider')

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const form = event.currentTarget
    const formData = new FormData(form)

    try {
      const response = await fetch(isRegistering ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
          ...(isRegistering ? { role: registrationRole } : {}),
        }),
      })

      if (response.status === 401 && !isRegistering) {
        setMessage('Hibás felhasználónév vagy jelszó.')
        return
      }

      if (response.status === 409 && isRegistering) {
        setMessage('Ez a felhasználónév már foglalt.')
        return
      }

      if (!response.ok) {
        let errorMessage = isRegistering
          ? 'A regisztráció nem sikerült. Próbáld újra később.'
          : 'A bejelentkezés nem sikerült. Próbáld újra később.'

        try {
          const error = await response.json()
          if (typeof error.detail === 'string') {
            errorMessage = error.detail
          }
        } catch {
          // Keep the generic message when the server does not return JSON.
        }

        setMessage(errorMessage)
        return
      }

      if (isRegistering) {
        form.reset()
        setIsRegistering(false)
        setRegistrationRole('rider')
        setShowPassword(false)
        setMessage('Sikeres regisztráció. Most már bejelentkezhetsz.')
      } else {
        onLogin(await response.json())
      }
    } catch {
      setMessage(
        isRegistering
          ? 'A regisztrációs szolgáltatás nem érhető el.'
          : 'A bejelentkezési szolgáltatás nem érhető el.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <header className="topbar">
        <div className="brand-mark"><span>R</span>RideR</div>
      </header>

      <section className="login-card">
        <p className="eyebrow">{isRegistering ? 'Csatlakozz hozzánk' : 'Üdv újra'}</p>
        <h1>{isRegistering ? 'Regisztráció' : 'Bejelentkezés'}</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Felhasználónév</label>
          <input id="username" name="username" autoComplete="username" required />

          <label htmlFor="password">Jelszó</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              minLength={isRegistering ? 8 : undefined}
              required
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? '◉' : '◎'}
            </button>
          </div>

          {isRegistering && (
            <div className="role-switch" role="group" aria-label="Regisztráció típusa">
              <span
                className={`role-slider ${registrationRole === 'restaurant' ? 'restaurant' : ''}`}
                aria-hidden="true"
              />
              <button
                className={registrationRole === 'rider' ? 'selected' : ''}
                type="button"
                onClick={() => setRegistrationRole('rider')}
              >
                Futár
              </button>
              <button
                className={registrationRole === 'restaurant' ? 'selected' : ''}
                type="button"
                onClick={() => setRegistrationRole('restaurant')}
              >
                Étterem
              </button>
            </div>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? (isRegistering ? 'Regisztráció…' : 'Belépés…')
              : (isRegistering ? 'Regisztráció' : 'Belépés')}
          </button>
          {message && <p className="login-message" role="status">{message}</p>}
        </form>
        <p className="register-prompt">
          {isRegistering ? 'Már van fiókod?' : 'Új vagy nálunk?'}{' '}
          <button
            className="register-link"
            type="button"
            onClick={() => {
              setIsRegistering((registering) => !registering)
              setMessage('')
              setShowPassword(false)
            }}
          >
            {isRegistering ? 'Bejelentkezés' : 'Regisztráció'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default LoginPage
