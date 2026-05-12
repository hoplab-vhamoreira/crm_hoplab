// js/api.js
// Wrapper sobre supabase-js que imita a interface do antigo /api/data/<collection>
// Permite migrar o index.html antigo gradualmente, substituindo chamadas a fetch('/api/...')

import { supabase } from './supabase-client.js'

// ── CRUD genérico ──────────────────────────────────────────────────────────────

export async function getAll(collection, opts = {}) {
  let query = supabase.from(collection).select(opts.select ?? '*')

  if (opts.filters) {
    for (const [col, val] of Object.entries(opts.filters)) {
      query = query.eq(col, val)
    }
  }
  if (opts.order)   query = query.order(opts.order.col, { ascending: opts.order.asc ?? true })
  if (opts.limit)   query = query.limit(opts.limit)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getOne(collection, id) {
  const { data, error } = await supabase
    .from(collection)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function insert(collection, record) {
  const { data, error } = await supabase
    .from(collection)
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function update(collection, id, changes) {
  const { data, error } = await supabase
    .from(collection)
    .update(changes)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function remove(collection, id) {
  const { error } = await supabase
    .from(collection)
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

// ── Utilitários ───────────────────────────────────────────────────────────────

// Valores únicos de um campo (para autofill/dropdowns)
export async function distinctValues(collection, field) {
  const { data, error } = await supabase
    .from(collection)
    .select(field)

  if (error) throw error
  return [...new Set(data.map(r => r[field]).filter(Boolean))].sort()
}

// Invocar RPC (função PostgreSQL)
export async function rpc(fnName, params = {}) {
  const { data, error } = await supabase.rpc(fnName, params)
  if (error) throw error
  return data
}

// ── Aliases para compatibilidade com código antigo ────────────────────────────
// O index.html antigo usava: fetch('/api/data/' + collection)
// Ao migrar gradualmente, podes chamar:
//   import { apiGet, apiPost, apiPut, apiDelete } from './api.js'
// e ter a mesma interface sem alterar o resto do código

export const apiGet    = (col, opts) => getAll(col, opts)
export const apiPost   = (col, rec)  => insert(col, rec)
export const apiPut    = (col, id, changes) => update(col, id, changes)
export const apiDelete = (col, id)   => remove(col, id)
