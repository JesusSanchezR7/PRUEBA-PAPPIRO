/**
 * Detecta si la app está online u offline
 * Escucha eventos de conexión para actualizar estado en tiempo real
 */

export const offlineDetector = {
  /**
   * Verifica si hay conexión actual
   */
  isOnline(): boolean {
    return navigator.onLine;
  },

  /**
   * Se suscribe a cambios de conexión
   * @param callback Función que se ejecuta cuando cambia el estado
   * @returns Función para desuscribirse
   */
  subscribe(callback: (isOnline: boolean) => void): () => void {
    const handleOnline = () => {
      console.log('🟢 [Conexión] Volvimos online');
      callback(true);
    };

    const handleOffline = () => {
      console.log('🔴 [Conexión] Estamos offline');
      callback(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
};
