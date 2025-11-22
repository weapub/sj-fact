import { useEffect, useState } from 'react'
import { supabase, getUser, signIn, signOut, signUp, sendPasswordReset, updatePassword, resendEmailConfirmation } from '../data/cloud/supabase'
import Button from './Button'

export default function AuthStatus() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'recover' | 'reset'
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    getUser().then(setUser)
    if (supabase?.auth) {
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset')
          setMsg('Ingrese nueva contraseña')
        }
      })
      return () => sub.subscription.unsubscribe()
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      await signIn({ email, password })
      setEmail('')
      setPassword('')
      setMsg('Sesión iniciada')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setMsg('')
    try {
      await signOut()
      setMsg('Sesión cerrada')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      await signUp({ email, password })
      setMsg('Cuenta creada. Verifique su correo si es requerido.')
      setEmail('')
      setPassword('')
      setMode('login')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecover(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      await sendPasswordReset(email)
      setMsg('Correo de recuperación enviado. Revise su bandeja.')
      setEmail('')
      setMode('login')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden')
      }
      await updatePassword(newPassword)
      setMsg('Contraseña actualizada, puede iniciar sesión')
      setNewPassword('')
      setConfirmPassword('')
      setMode('login')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    const verified = !!user?.email_confirmed_at
    return (
      <div className="flex items-center gap-3">
<span className="text-sm text-slate-700">{user.email}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {verified ? 'Verificado' : 'Sin verificar'}
        </span>
        {!verified && (
          <Button type="button" variant="outline" size="sm"
            onClick={async () => {
              setLoading(true)
              setMsg('')
              try {
                await resendEmailConfirmation(user.email)
                setMsg('Verificación reenviada. Revise su correo.')
              } catch (err) {
                setMsg(err.message)
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            Reenviar verificación
          </Button>
        )}
        <Button onClick={handleLogout} variant="neutral" size="sm" disabled={loading}>Salir</Button>
{msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>
    )
  }

  if (mode === 'reset') {
    return (
      <form onSubmit={handleReset} className="flex items-center gap-2">
        <input type="password" placeholder="nueva contraseña" className="border rounded px-2 py-1 text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
        <input type="password" placeholder="confirmar" className="border rounded px-2 py-1 text-sm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
        <Button variant="primary" size="sm" disabled={loading}>Actualizar</Button>
{msg && <span className="text-xs text-slate-600">{msg}</span>}
      </form>
    )
  }

  if (mode === 'signup') {
    return (
      <form onSubmit={handleSignup} className="flex items-center gap-2">
        <input type="email" placeholder="email" className="border rounded px-2 py-1 text-sm" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="password" className="border rounded px-2 py-1 text-sm" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button variant="success" size="sm" disabled={loading}>Crear cuenta</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMode('login')}>Entrar</Button>
{msg && <span className="text-xs text-slate-600">{msg}</span>}
      </form>
    )
  }

  if (mode === 'recover') {
    return (
      <form onSubmit={handleRecover} className="flex items-center gap-2">
        <input type="email" placeholder="email" className="border rounded px-2 py-1 text-sm" value={email} onChange={e => setEmail(e.target.value)} required />
        <Button variant="primary" size="sm" disabled={loading}>Enviar recuperación</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMode('login')}>Entrar</Button>
{msg && <span className="text-xs text-slate-600">{msg}</span>}
      </form>
    )
  }

  return (
    <form onSubmit={handleLogin} className="flex items-center gap-2">
      <input type="email" placeholder="email" className="border rounded px-2 py-1 text-sm" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="password" className="border rounded px-2 py-1 text-sm" value={password} onChange={e => setPassword(e.target.value)} required />
      <Button variant="primary" size="sm" disabled={loading}>Entrar</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setMode('signup')}>Crear cuenta</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setMode('recover')}>Olvidé mi contraseña</Button>
{msg && <span className="text-xs text-slate-600">{msg}</span>}
    </form>
  )
}