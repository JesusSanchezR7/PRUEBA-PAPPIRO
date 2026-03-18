import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { offlineDetector } from '../utils/offlineDetector';

/**
 * Hook para suscribirse a cambios en tiempo real de Supabase
 * NOTA: No se suscribe si está offline para evitar errores de conexión
 * @param table Nombre de la tabla de Supabase
 * @param callback Función que se ejecuta cuando hay cambios
 * @param dependencies Dependencias opcionales para re-suscribirse
 */
export function useRealtimeSubscription(
  table: string,
  callback: () => void | Promise<void>,
  dependencies: any[] = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isDevRef = useRef(import.meta.env.DEV);
  const [isOnline, setIsOnline] = useState(() => offlineDetector.isOnline());

  // Escuchar cambios de conexión
  useEffect(() => {
    const unsubscribe = offlineDetector.subscribe(setIsOnline);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // 🔴 SI ESTÁ OFFLINE, NO SUSCRIBIRSE
    if (!isOnline) {
      if (isDevRef.current) {
        console.log(`📴 [${table}] Offline: no se suscribe a realtime`);
      }
      return;
    }

    // Crear suscripción solo si está online
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        async (payload) => {
          if (isDevRef.current) {
            console.log(`🔄 [${table}] Cambio detectado:`, payload.eventType);
          }
          await callback();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (isDevRef.current) {
            console.log(`✅ Suscrito a cambios en: ${table}`);
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Error en canal ${table}:`, status);
        }
      });

    channelRef.current = channel;

    // Cleanup: desuscribirse cuando el componente se desmonte o pase online->offline
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        if (isDevRef.current) {
          console.log(`❌ Desuscrito de: ${table}`);
        }
      }
    };
  }, [table, isOnline, ...dependencies]);
}
