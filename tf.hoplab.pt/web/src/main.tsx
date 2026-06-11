import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './context/auth'
import App from './App'
import './styles/tokens.css'
import './styles/variants.css'
import { supabase } from './lib/supabase'

/**
 * Porquê HashRouter (e não BrowserRouter):
 * O alojamento (Cloudflare) só serve correctamente o ficheiro real
 * /speechcraft/app/index.html. Qualquer deep-path (ex.: /speechcraft/app/join,
 * /speechcraft/app/dashboard) cai no index.html da RAIZ (HopLab → /login).
 * Com HashRouter o browser pede sempre apenas /speechcraft/app/ e a rota fica
 * depois do '#', resolvida no cliente. Isto torna o convite, o F5 e os deep
 * links imunes ao routing do servidor.
 */

const ROOT = document.getElementById('root')!

function mount() {
  createRoot(ROOT).render(
    <StrictMode>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </StrictMode>
  )
}

/**
 * Os links de convite/recuperação do Supabase redirigem para
 * /speechcraft/app/ com o token NO HASH (#access_token=...&type=recovery).
 * Como usamos HashRouter, esse hash-token seria mal interpretado como rota.
 * O supabase-js (detectSessionInUrl) consome o token ao iniciar; aqui
 * esperamos que isso aconteça e só depois montamos a app já apontada a /join.
 */
const rawHash = window.location.hash || ''
const isAuthCallback = /access_token=|refresh_token=|type=recovery|error_code=|[#&?]error=/.test(rawHash)

if (isAuthCallback) {
  let done = false
  const proceed = () => {
    if (done) return
    done = true
    // Limpa o token do URL e encaminha para o fluxo de onboarding do utente.
    window.location.hash = '#/join'
    mount()
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session || event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
      subscription.unsubscribe()
      proceed()
    }
  })

  // Caso o token já tenha sido processado antes do listener.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) { subscription.unsubscribe(); proceed() }
  })

  // Salvaguarda: link expirado/inválido (sem sessão) — segue à mesma para /join,
  // que mostra a mensagem "Link inválido ou expirado".
  setTimeout(() => { subscription.unsubscribe(); proceed() }, 4000)
} else {
  mount()
}
