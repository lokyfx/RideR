import { useState } from 'react'
import './LoginPage.css'

function LoginPage({ onLogin }) {
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      })

      if (response.status === 401) {
        setMessage('Hibás felhasználónév vagy jelszó.')
        return
      }

      if (!response.ok) {
        setMessage('A bejelentkezés nem sikerült. Próbáld újra később.')
        return
      }

      onLogin()
    } catch {
      setMessage('A bejelentkezési szolgáltatás nem érhető el.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <header className="topbar">
        <div className="brand-mark"><span>R</span>Restaurant</div>
      </header>

      <section className="login-card">
        <p className="eyebrow">Üdv újra</p>
        <h1>Bejelentkezés</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Felhasználónév</label>
          <input id="username" name="username" autoComplete="username" required />

          <label htmlFor="password">Jelszó</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Belépés…' : 'Belépés'}
          </button>
          {message && <p className="login-message" role="status">{message}</p>}
        </form>
        <p className="register-prompt">
          Új vagy nálunk?{' '}
          <button
            className="register-link"
            type="button"
            onClick={() => setMessage('A regisztráció hamarosan elérhető.')}
          >
            Regisztráció
          </button>
        </p>
      </section>
    </main>
  )
}

export default LoginPage
