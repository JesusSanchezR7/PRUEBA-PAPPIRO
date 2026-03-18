import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno requeridas
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Faltan variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridas')
}

// Solo log en desarrollo
if (import.meta.env.DEV) {
  console.log('🔗 Conectando a Supabase:', supabaseUrl.substring(0, 30) + '...')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})