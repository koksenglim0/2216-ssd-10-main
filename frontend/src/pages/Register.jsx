import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/sitwallet'
import AuthShell from '../components/AuthShell'
import StatusMessage from '../components/StatusMessage'
import { defaultCurrencies } from '../data/sitwalletData'

const initialForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  code: '',
  password: '',
  confirmPassword: '',
  primaryCurrency: 'SGD',
  termsAccepted: false,
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState('details')
  const [registrationId, setRegistrationId] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function runStep(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      if (step === 'details') {
        const result = await authApi.registerStart({
          fullName: form.fullName,
          email: form.email,
        })
        setRegistrationId(result.registrationId)
        setStep('mfa-setup')
        setMessage('Account staged. Add your phone number to generate the authenticator setup QR.')
      }

      if (step === 'mfa-setup') {
        const result = await authApi.registerMfaSetup({
          registrationId,
          phoneNumber: form.phoneNumber,
        })
        setQrCodeDataUrl(result.qrCodeDataUrl)
        setStep('mfa-verify')
        setMessage('Scan the QR code, then enter the 6-digit authenticator code.')
      }

      if (step === 'mfa-verify') {
        await authApi.registerMfaVerify({
          registrationId,
          code: form.code,
        })
        setStep('password')
        setMessage('MFA is verified. Create a strong password and your first wallet.')
      }

      if (step === 'password') {
        await authApi.registerPassword({
          registrationId,
          password: form.password,
          confirmPassword: form.confirmPassword,
          primaryCurrency: form.primaryCurrency,
          termsAccepted: form.termsAccepted,
        })
        navigate('/sign-in', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Register with MFA, complete password setup, and create your first wallet in one secure flow."
      footer={<span>Already have an account? <Link className="font-medium text-slate-950 underline decoration-slate-400 underline-offset-4" to="/sign-in">Sign in now</Link></span>}
    >
      <form className="grid gap-4" onSubmit={runStep}>
        <StatusMessage type="success">{message}</StatusMessage>
        <StatusMessage type="error">{error}</StatusMessage>

        {step === 'details' ? (
          <>
            <label className="grid gap-2 text-sm text-slate-600">
              Full Name
              <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="fullName" value={form.fullName} onChange={updateField} autoComplete="name" required />
            </label>
            <label className="grid gap-2 text-sm text-slate-600">
              Email Address
              <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required />
            </label>
          </>
        ) : null}

        {step === 'mfa-setup' ? (
          <label className="grid gap-2 text-sm text-slate-600">
            Mobile Number
            <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="phoneNumber" value={form.phoneNumber} onChange={updateField} placeholder="+6591234567" autoComplete="tel" required />
          </label>
        ) : null}

        {step === 'mfa-verify' ? (
          <>
            {qrCodeDataUrl ? <img className="mx-auto h-48 w-48 rounded-2xl border border-slate-200 bg-white p-2" src={qrCodeDataUrl} alt="Authenticator setup QR code" /> : null}
            <label className="grid gap-2 text-sm text-slate-600">
              Verification Code
              <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="code" inputMode="numeric" pattern="[0-9]{6}" value={form.code} onChange={updateField} autoComplete="one-time-code" required />
            </label>
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-600">
                Create Password
                <input
                  className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
                  autoComplete="new-password"
                  minLength={12}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}"
                  title="Use 12-128 characters with lowercase, uppercase, number, and symbol."
                  required
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-600">
                Confirm Password
                <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField} autoComplete="new-password" required />
              </label>
            </div>
            <p className="text-sm text-slate-500">Password must be 12-128 characters and include lowercase, uppercase, number, and symbol.</p>
            <label className="grid gap-2 text-sm text-slate-600">
              Primary Currency
              <select className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="primaryCurrency" value={form.primaryCurrency} onChange={updateField}>
                {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input className="mt-1" name="termsAccepted" type="checkbox" checked={form.termsAccepted} onChange={updateField} required />
              <span>I confirm the registration details are mine and accept the SITWallet terms.</span>
            </label>
          </>
        ) : null}

        <button disabled={submitting} className="mt-2 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Please wait...' : step === 'password' ? 'Complete Registration' : 'Continue'}
        </button>
      </form>
    </AuthShell>
  )
}
