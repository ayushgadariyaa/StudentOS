import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btn, btnQuiet, label } from '../lib/ui'

export default function Login() {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { email, password, name } = form
    const { data, error } = creating
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setMessage(error.message)
    else if (creating && !data.session) setMessage('Check your email to confirm your account, then sign in.')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-4xl font-bold">Student OS</h1>
      <p className="mt-2 text-ink/70">Your timetable, attendance and deadlines in one place.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {creating && (
          <div>
            <label className={label} htmlFor="name">Your name</label>
            <input id="name" required autoComplete="name" className={field} value={form.name} onChange={set('name')} />
          </div>
        )}
        <div>
          <label className={label} htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className={field} value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className={label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={creating ? 'new-password' : 'current-password'}
            className={field}
            value={form.password}
            onChange={set('password')}
          />
        </div>
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
        <button className={`${btn} w-full`} disabled={busy}>
          {creating ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button
        className={`${btnQuiet} mt-4 self-start`}
        onClick={() => {
          setCreating(!creating)
          setMessage(null)
        }}
      >
        {creating ? 'I already have an account' : 'New here? Create an account'}
      </button>
    </div>
  )
}
