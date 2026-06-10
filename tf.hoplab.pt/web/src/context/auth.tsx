import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, tfFrom } from '../lib/supabase'
import type { TfUser } from '@tf/types'

interface AuthCtx {
  session: Session | null
  user: User | null
  profile: TfUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: null, user: null, profile: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<TfUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Flag: só permitir que onAuthStateChange termine o loading
    // depois de getSession() ter resolvido (evita redirect prematuro
    // quando o token está a ser refrescado em background)
    let ready = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!ready) return          // ainda a aguardar getSession — ignorar
      if (s?.user) loadProfile(s.user.id)
      else { setProfile(null); setLoading(false) }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      ready = true
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await tfFrom('tf_users').select('*').eq('id', uid).single()
    setProfile(data ?? null)
    setLoading(false)
  }

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut: async () => { await supabase.auth.signOut() } }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
