import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Save, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { db } from '@/lib/supabase'

const profileSchema = z.object({
  display_name: z.string().min(1).max(50),
  account_size: z.coerce.number().nonnegative().optional(),
  default_risk_percent: z.coerce.number().nonnegative().max(100).optional(),
  broker: z.string().optional(),
  timezone: z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

const inputClass = 'w-full bg-input border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary font-mono'

export function SettingsPage() {
  const { profile, fetchProfile, user } = useAuthStore()
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile?.display_name ?? '',
      account_size: profile?.account_size ?? undefined,
      default_risk_percent: profile?.default_risk_percent ?? undefined,
      broker: profile?.broker ?? '',
      timezone: profile?.timezone ?? 'America/New_York',
    },
  })

  const onSubmit = async (data: ProfileForm) => {
    if (!user?.id) return
    await db.profiles().update({ ...data, updated_at: new Date().toISOString() }).eq('id', user.id)
    await fetchProfile(user.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl animate-in">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-display tracking-wider">SETTINGS</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Profile</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">Display Name</label>
              <input {...register('display_name')} className={inputClass} />
              {errors.display_name && <p className="text-destructive text-xs">{errors.display_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">Broker</label>
              <input {...register('broker')} placeholder="IBKR, TD Ameritrade..." className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">Account Size ($)</label>
              <input {...register('account_size')} type="number" step="100" placeholder="25000" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">Default Risk %</label>
              <input {...register('default_risk_percent')} type="number" step="0.1" placeholder="1.5" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">Timezone</label>
              <select {...register('timezone')} className={inputClass + ' cursor-pointer'}>
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
