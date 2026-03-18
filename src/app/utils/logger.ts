/**
 * Hook para logging seguro que solo muestra logs en desarrollo
 * Evita exponer información sensible en producción
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  
  error: (...args: any[]) => {
    if (isDev) console.error(...args);
  },
  
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
  
  // Siempre muestra errores críticos pero sanitizados
  critical: (message: string, error?: any) => {
    console.error(`🔴 ${message}`);
    if (isDev && error) {
      console.error('Detalles:', error);
    }
  }
};
