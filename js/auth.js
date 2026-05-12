// js/auth.js
// Gestão de autenticação — login, logout, sessão, protecção de rotas

import { supabase } from './supabase-client.js'

// ── Proteger páginas que exigem autenticação ─────────────────────────────────
// Coloca no topo de qualquer página protegida:
//   import { requireAuth } from './auth.js'
//   const { user, profile } = await requireAuth()

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.href = '/login.html'
    return null
  }

  const profile = await getProfile(session.user.id)
  return { user: session.user, profile }
}

// ── Obter perfil (role, nome, etc.) ──────────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Erro ao carregar perfil:', error)
    return null
  }
  return data
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = '/login.html'
}

// ── Helper: role do utilizador actual ────────────────────────────────────────
export async function getCurrentRole() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const profile = await getProfile(session.user.id)
  return profile?.role ?? null
}

// ── Helper: verificar se tem permissão ───────────────────────────────────────
export function hasRole(profile, ...roles) {
  return profile && roles.includes(profile.role)
}

// ── Escutar mudanças de sessão ────────────────────────────────────────────────
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}
