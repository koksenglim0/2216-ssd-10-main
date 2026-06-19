import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/sitwallet'
import { useAuth } from '../auth/useAuth'
import StatusMessage from '../components/StatusMessage'

export default function SignIn() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '', code: '' })
  const [challengeId, setChallengeId] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const destination = location.state?.from?.pathname || '/dashboard'

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submitPassword(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await authApi.login({
        email: form.email,
        password: form.password,
      })
      setChallengeId(result.loginChallengeId)
    } catch (err) {
      setError(err.message || 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitMfa(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const session = await authApi.loginVerify({
        loginChallengeId: challengeId,
        code: form.code,
      })
      auth.completeLogin(session)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to verify MFA code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[36%_64%]">
      <section className="flex min-h-[40vh] flex-col justify-between bg-[#05234d] px-6 py-6 text-white sm:px-8 sm:py-8 lg:min-h-screen lg:px-10 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-sm font-semibold text-[#05234d]">SW</div>
          <span className="font-display text-2xl font-semibold tracking-tight text-white">SITWallet</span>
        </div>

        <div className="max-w-md pb-8 pt-10 lg:pt-16">
          <h1 className="font-display text-4xl font-medium leading-tight text-white sm:text-5xl lg:text-[3.1rem]">
            Secure your financial future with SITWallet.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[#b7c5db] sm:text-base">
            Sign in with your password and authenticator code to access your multi-currency wallet.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-5 pb-2 text-center text-[10px] uppercase tracking-[0.24em] text-[#b7c5db] sm:max-w-xs">
          {['MFA', 'CSRF', 'Audit'].map((label) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 font-semibold">
              {label}
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-[60vh] items-center justify-center px-5 py-10 sm:px-8 lg:min-h-screen lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#0a2a55] text-sm font-semibold text-white">SW</div>
            <h2 className="mt-3 font-display text-3xl font-semibold text-[#0a2a55]">SITWallet</h2>
            <p className="mt-1 text-sm text-slate-500">Secure Multi-Currency Access</p>
          </div>

          <StatusMessage type="error">{error}</StatusMessage>

          {!challengeId ? (
            <form className="mt-5 grid gap-5" onSubmit={submitPassword}>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email Address</span>
                <input
                  className="rounded-lg border border-[#d7dbe3] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm outline-none focus:border-[#0a2a55]"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Password</span>
                <input
                  className="rounded-lg border border-[#d7dbe3] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm outline-none focus:border-[#0a2a55]"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <button disabled={submitting} className="mt-1 inline-flex items-center justify-center rounded-lg bg-[#072b55] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-[#072b55]/20 transition hover:bg-[#0a3567] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Checking...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form className="mt-5 grid gap-5" onSubmit={submitMfa}>
              <StatusMessage>Enter the 6-digit code from your authenticator app.</StatusMessage>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">MFA Code</span>
                <input
                  className="rounded-lg border border-[#d7dbe3] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm outline-none focus:border-[#0a2a55]"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={form.code}
                  onChange={updateField}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  required
                />
              </label>
              <button disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#072b55] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-[#072b55]/20 transition hover:bg-[#0a3567] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Verifying...' : 'Verify and sign in'}
              </button>
              <button type="button" onClick={() => setChallengeId('')} className="text-sm font-semibold text-[#26456f] hover:underline">
                Use a different account
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Do not have an account?{' '}
            <Link className="font-semibold text-[#26456f] hover:underline" to="/register">
              Register now
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
