// js/supabase-client.js
// Inicialização do cliente Supabase
// A anon key é pública por design — a segurança está nas policies RLS.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL  = 'https://bocwqacwalzshjkhjzwi.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvY3dxYWN3YWx6c2hqa2hqendpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjYyNTYsImV4cCI6MjA5NDAwMjI1Nn0.0FSXkO69PG4na6XLAOSoJ-r2wNQYwyLoOSMIyDH7AvY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
