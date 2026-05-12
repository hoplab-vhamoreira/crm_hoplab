// js/supabase-client.js
// Inicialização do cliente Supabase
// A anon key é pública por design — a segurança está nas policies RLS.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL  = 'https://bocwqacwalzshjkhjzwi.supabase.co'
const SUPABASE_ANON = 'SUPABASE_ANON_KEY_AQUI' // ← substituir antes do primeiro deploy

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
