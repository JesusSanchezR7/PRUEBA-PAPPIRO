/**
 * Maneja promesas rechazadas no capturadas (unhandledrejection)
 * Previene que salgan como errores rojos en consola en modo offline
 */

export function setupGlobalErrorHandlers() {
  // Manejar promesas rechazadas no capturadas
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const message = error instanceof Error ? error.message : String(error);

    // 🔴 Errores esperados en offline que no queremos mostrar en rojo
    const ignorePatterns = [
      'ERR_INTERNET_DISCONNECTED',
      'failed to fetch',
      'network error',
      'no-response',
      'offline',
      'websocket',
      'realtime',
      'supabase',
    ];

    const shouldIgnore = ignorePatterns.some(pattern =>
      message.toLowerCase().includes(pattern)
    );

    if (shouldIgnore && !navigator.onLine) {
      // 🟡 En offline, marca como "handled" para evitar error rojo
      event.preventDefault();
      console.debug(`[Offline] Rechazada automáticamente: ${message.substring(0, 50)}`);
      return;
    }

    // Si está online o es un error importante, permitir que salga
    console.error('[Global] Unhandled Promise Rejection:', error);
  });

  // Manejar errores no capturados
  window.addEventListener('error', (event) => {
    const message = (event.message || '').toLowerCase();

    if (message.includes('err_internet_disconnected') && !navigator.onLine) {
      event.preventDefault();
      console.debug(`[Offline] Error de red ignorado`);
    }
  });
}
