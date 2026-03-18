import { supabase } from '../../lib/supabase';

// Tiempo de expiración del QR en horas
const QR_EXPIRATION_HOURS = 24;

export const qrExpirationService = {
  // Calcular si un QR ha expirado
  isQRExpired(generatedAtISO: string): boolean {
    try {
      if (!generatedAtISO) return false;
      
      const generatedTime = new Date(generatedAtISO).getTime();
      const currentTime = new Date().getTime();
      const elapsedHours = (currentTime - generatedTime) / (1000 * 60 * 60);
      
      return elapsedHours > QR_EXPIRATION_HOURS;
    } catch (error) {
      console.error('Error calculando expiración:', error);
      return false;
    }
  },

  // Obtener el tiempo restante en horas
  getTimeRemainingInHours(generatedAtISO: string): number {
    try {
      if (!generatedAtISO) return 0;
      
      const generatedTime = new Date(generatedAtISO).getTime();
      const currentTime = new Date().getTime();
      const elapsedHours = (currentTime - generatedTime) / (1000 * 60 * 60);
      const remaining = QR_EXPIRATION_HOURS - elapsedHours;
      
      return Math.max(0, remaining);
    } catch (error) {
      console.error('Error calculando tiempo restante:', error);
      return 0;
    }
  },

  // Marcar automáticamente como cancelados los QR expirados
  async cancelExpiredQRs(): Promise<number> {
    try {
      // 1. Obtener todos los QR generados hace más de 24 horas
      const hoursAgo = new Date(Date.now() - QR_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString();
      
      const { data: expiredQRs, error: selectError } = await supabase
        .from('pedido_qr')
        .select('id_pedido, generado_en')
        .lt('generado_en', hoursAgo)
        .is('validado_en', null); // Solo los que aún no han sido validados

      if (selectError) {
        console.error('Error buscando QR expirados:', selectError);
        return 0;
      }

      if (!expiredQRs || expiredQRs.length === 0) {
        console.log('✅ No hay QR expirados para cancelar');
        return 0;
      }

      console.log(`⏰ Encontrados ${expiredQRs.length} QR expirados`);

      // 2. Marcar los pedidos asociados como cancelados
      const pedidoIds = expiredQRs.map(qr => qr.id_pedido);
      
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ estatus: 'cancelado' })
        .in('id_pedido', pedidoIds)
        .in('estatus', ['pendiente', 'pagando']); // Solo actualizar si están en estado pendiente / pagando

      if (updateError) {
        console.error('Error cancelando pedidos expirados:', updateError);
        return 0;
      }

      console.log(`✅ ${expiredQRs.length} pedidos marcados como cancelados por expiración de QR`);
      return expiredQRs.length;
    } catch (error) {
      console.error('Error en cancelExpiredQRs:', error);
      return 0;
    }
  },

  // Validar un QR (chequea si es válido y no ha expirado)
  async validateQRExists(token: string): Promise<{ valid: boolean; expired: boolean; generatedAt?: string }> {
    try {
      const { data, error } = await supabase
        .from('pedido_qr')
        .select('generado_en, validado_en')
        .eq('token_qr', token)
        .single();

      if (error || !data) {
        return { valid: false, expired: false };
      }

      // Si ya fue validado, no es válido
      if (data.validado_en) {
        return { valid: false, expired: false };
      }

      // Checar si expiró
      const isExpired = this.isQRExpired(data.generado_en);

      return { 
        valid: !isExpired, 
        expired: isExpired,
        generatedAt: data.generado_en
      };
    } catch (error) {
      console.error('Error validando QR:', error);
      return { valid: false, expired: false };
    }
  },

  // Obtener información de expiración de un pedido
  async getQRExpirationInfo(orderId: number | string) {
    try {
      const { data, error } = await supabase
        .from('pedido_qr')
        .select('generado_en, validado_en')
        .eq('id_pedido', orderId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        generatedAt: data.generado_en,
        validatedAt: data.validado_en,
        isExpired: this.isQRExpired(data.generado_en),
        timeRemainingHours: this.getTimeRemainingInHours(data.generado_en),
      };
    } catch (error) {
      console.error('Error obteniendo info de expiración:', error);
      return null;
    }
  },
};
