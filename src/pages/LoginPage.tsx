import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Chrome, Loader2, AlertCircle } from 'lucide-react'
import { auth } from '@/lib/supabase'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setServerError(null)
    const { error } = await auth.signInWithGoogle()
    if (error) {
      setServerError(error.message)
      setGoogleLoading(false)
    }
    // On success, Supabase redirects to /auth/callback
  }

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    setSuccessMsg(null)

    if (mode === 'signup') {
      const { error } = await auth.signUpWithEmail(data.email, data.password)
      if (error) {
        setServerError(error.message)
      } else {
        setSuccessMsg('Check your email to confirm your account.')
      }
    } else {
      const { error } = await auth.signInWithEmail(data.email, data.password)
      if (error) {
        setServerError(
          error.message === 'Invalid login credentials'
            ? 'Invalid email or password.'
            : error.message
        )
      }
      // On success, auth store listener handles the redirect via ProtectedRoute
    }
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display tracking-wider mb-2">
          {mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {mode === 'login'
            ? 'Sign in to your trading journal'
            : 'Start tracking your trades today'}
        </p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading || isSubmitting}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Chrome className="w-4 h-4" />
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="trader@example.com"
            autoComplete="email"
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          {errors.email && (
            <p className="text-destructive text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-destructive text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.password.message}
            </p>
          )}
        </div>

        {/* Server errors */}
        {serverError && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2.5 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {serverError}
          </div>
        )}
        {successMsg && (
          <div className="bg-primary/10 border border-primary/20 rounded-md px-3 py-2.5 text-primary text-sm">
            {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || googleLoading}
          className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      {/* Toggle mode */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setServerError(null)
            setSuccessMsg(null)
          }}
          className="text-primary hover:underline font-medium"
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
