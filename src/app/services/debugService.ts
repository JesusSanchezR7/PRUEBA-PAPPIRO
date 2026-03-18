import { supabase } from '../../lib/supabase';

// Función de prueba para verificar la conexión a Supabase
export const debugSupabase = {
  async testConnection() {
    try {
      const { data, error, status } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact' })
        .limit(1);

      console.log('🔍 Prueba de conexión:', { status, error, recordCount: data?.length || 0 });
      return { success: !error, data, error };
    } catch (err) {
      console.error('Error en testConnection:', err);
      return { success: false, error: err };
    }
  },
};
