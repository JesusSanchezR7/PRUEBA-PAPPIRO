import { supabase } from '../../lib/supabase';
import { Order, MobileUser, CartItem } from '../types';
import { qrExpirationService } from './qrExpirationService';
import { logger } from '../utils/logger';
import { getOfflineData, saveOfflineData } from './offlineDb';
import { queueOrderCancelOffline, queueOrderStatusUpdateOffline } from './offlineSyncService';

const OFFLINE_ORDERS_CACHE_KEY = 'orders_cache';

const shouldUseOfflineQueue = (error: unknown): boolean => {
  if (!navigator.onLine) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('fetch') || message.includes('network') || message.includes('failed');
};

export const orderService = {
  // Obtener todos los pedidos con relaciones
  async getAllOrders(): Promise<Order[]> {
    try {
      logger.log('🔍 orderService.getAllOrders() - Iniciando query...');
      
      // ⏰ Primero, cancelar automáticamente los QR expirados
      try {
        const cancelledCount = await qrExpirationService.cancelExpiredQRs();
        if (cancelledCount > 0) {
          logger.log(`⚠️ Se cancelaron ${cancelledCount} pedidos por expiración`);
        }
      } catch (e) {
        logger.warn('Advertencia al procesar expiración:', e);
      }
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*, productos(*)), usuarios(*)')
        .order('creado_en', { ascending: false });

      if (ordersError) {
        logger.error('❌ Error obteniendo pedidos:', ordersError);
        return [];
      }

      if (!ordersData || ordersData.length === 0) {
        logger.warn('⚠️ No hay pedidos en la BD');
        return [];
      }

      logger.log(`📊 Total pedidos recibidos: ${ordersData.length}`);

      // Obtener tokens QR y fecha de validación para cada pedido
      const pedidoIds = ordersData.map(p => p.id_pedido);
      const { data: qrData } = await supabase
        .from('pedido_qr')
        .select('id_pedido, token_qr, validado_en, generado_en')
        .in('id_pedido', pedidoIds);

      const qrMap: Record<number, { token?: string; validatedAt?: string | null; generatedAt?: string | null }> = {};
      (qrData || []).forEach(qr => {
        qrMap[qr.id_pedido] = {
          token: qr.token_qr || '',
          validatedAt: qr.validado_en || null,
          generatedAt: qr.generado_en || null,
        };
      });

      // Mapear datos a la estructura esperada
      const mappedOrders: Order[] = ordersData.map((order: any) => {
        // Mapear usuario
        const user: MobileUser = {
          id: order.usuarios?.id?.toString() || '',
          name: order.usuarios?.nombre || 'Cliente Desconocido',
          email: order.usuarios?.email || '',
          role: (order.usuarios?.rol?.toLowerCase().includes('profesor') ? 'teacher' : 'student') as 'student' | 'teacher',
          educationLevel: (order.usuarios?.nivel_educativo?.toLowerCase() || 'primaria') as any,
          phone: order.usuarios?.telefono,
          createdAt: order.usuarios?.creado_en || new Date().toISOString(),
          status: (order.usuarios?.estatus?.toLowerCase().includes('suspendido') ? 'suspended' : 'active') as 'active' | 'suspended',
        };

        // Mapear items del carrito
        const items: CartItem[] = (order.pedido_items || []).map((item: any) => ({
          productId: item.id_producto?.toString() || '',
          quantity: item.cantidad || 1,
          product: {
            id: item.productos?.id_producto?.toString() || '',
            name: item.productos?.nombre_producto || 'Producto Desconocido',
            category: 'cuadernos' as any, // Mapear según categoria real si existe
            price: parseFloat(item.precio_unitario || item.productos?.precio_unidad || 0),
            stock: item.productos?.stock_actual || 0,
            description: item.productos?.descripcion || '',
            imageUrl: item.productos?.imagen_url || '',
            educationLevels: item.productos?.niveles_educativos 
              ? (typeof item.productos.niveles_educativos === 'string' 
                  ? JSON.parse(item.productos.niveles_educativos) 
                  : item.productos.niveles_educativos)
              : [],
            status: item.productos?.estatus?.toLowerCase().includes('activo') ? 'active' : 'inactive' as 'active' | 'inactive',
          },
        }));

        // Mapear estado del pedido (normalizar a minúsculas según BD)
        const estLower = (order.estatus || '').toString().toLowerCase();
        const statusMapLower: Record<string, Order['status']> = {
          'pendiente': 'pending',
          'pagando': 'processing',
          'pagado': 'pending',
          'entregado': 'picked-up',
          'cancelado': 'cancelled',
        };

        const qrGeneratedAt = qrMap[order.id_pedido]?.generatedAt || null;
        const qrValidatedAt = qrMap[order.id_pedido]?.validatedAt || null;
        let qrExpired = false;
        let qrTimeRemainingHours: number | undefined = undefined;
        if (qrGeneratedAt && !qrValidatedAt) {
          qrExpired = qrExpirationService.isQRExpired(qrGeneratedAt);
          qrTimeRemainingHours = qrExpirationService.getTimeRemainingInHours(qrGeneratedAt);
        }

        return {
          id: order.id_pedido?.toString() || '',
          userId: order.id_usuario?.toString() || '',
          user,
          items,
          total: parseFloat(order.total || 0),
          status: (statusMapLower[estLower] || 'pending') as Order['status'],
          qrCode: (qrMap[order.id_pedido]?.token) || `AUTO-${order.id_pedido}`,
          createdAt: order.creado_en || new Date().toISOString(),
          paymentMethod: 'card' as const, // Mapear según datos reales si existe
          paymentStatus: order.pagado_en ? 'completed' : 'pending' as Order['paymentStatus'],
          pickupCode: `PICKUP-${order.id_pedido}`,
          validated: !!qrMap[order.id_pedido]?.validatedAt,
          validatedAt: qrValidatedAt,
          qrGeneratedAt,
          qrExpired,
          qrTimeRemainingHours,
        };
      });

      logger.log('✅ Pedidos mapeados correctamente:', mappedOrders.length);
      await saveOfflineData(OFFLINE_ORDERS_CACHE_KEY, mappedOrders);
      return mappedOrders;
    } catch (error) {
      logger.error('❌ Error en getAllOrders:', error);
      const cachedOrders = await getOfflineData<Order[]>(OFFLINE_ORDERS_CACHE_KEY);
      if (cachedOrders && cachedOrders.length > 0) {
        logger.warn('📦 Usando pedidos desde cache offline');
        return cachedOrders;
      }
      return [];
    }
  },

  // Obtener un pedido específico
  async getOrderById(orderId: string | number): Promise<Order | null> {
    try {
      const id = typeof orderId === 'string' ? parseInt(orderId) : orderId;
      
      const { data: orderData, error } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*, productos(*)), usuarios(*)')
        .eq('id_pedido', id)
        .single();

      if (error || !orderData) {
        logger.error('❌ Error obteniendo pedido:', error);
        return null;
      }

      // Obtener QR
      const { data: qrData } = await supabase
        .from('pedido_qr')
        .select('token_qr')
        .eq('id_pedido', id)
        .single();

      return {
        id: orderData.id_pedido?.toString() || '',
        userId: orderData.id_usuario?.toString() || '',
        user: {
          id: orderData.usuarios?.id?.toString() || '',
          name: orderData.usuarios?.nombre || 'Cliente Desconocido',
          email: orderData.usuarios?.email || '',
          role: (orderData.usuarios?.rol?.toLowerCase().includes('profesor') ? 'teacher' : 'student') as 'student' | 'teacher',
          educationLevel: (orderData.usuarios?.nivel_educativo?.toLowerCase() || 'primaria') as any,
          phone: orderData.usuarios?.telefono,
          createdAt: orderData.usuarios?.creado_en || new Date().toISOString(),
          status: (orderData.usuarios?.estatus?.toLowerCase().includes('suspendido') ? 'suspended' : 'active') as 'active' | 'suspended',
        },
        items: (orderData.pedido_items || []).map((item: any) => ({
          productId: item.id_producto?.toString() || '',
          quantity: item.cantidad || 1,
          product: {
            id: item.productos?.id_producto?.toString() || '',
            name: item.productos?.nombre_producto || 'Producto Desconocido',
            category: 'cuadernos' as any,
            price: parseFloat(item.precio_unitario || item.productos?.precio_unidad || 0),
            stock: item.productos?.stock_actual || 0,
            description: item.productos?.descripcion || '',
            imageUrl: item.productos?.imagen_url || '',
            educationLevels: item.productos?.niveles_educativos 
              ? (typeof item.productos.niveles_educativos === 'string' 
                  ? JSON.parse(item.productos.niveles_educativos) 
                  : item.productos.niveles_educativos)
              : [],
            status: item.productos?.estatus?.toLowerCase().includes('activo') ? 'active' : 'inactive' as 'active' | 'inactive',
          },
        })),
        total: parseFloat(orderData.total || 0),
        status: (String(orderData.estatus).toLowerCase() === 'entregado' ? 'picked-up' : String(orderData.estatus).toLowerCase() === 'cancelado' ? 'cancelled' : 'pending') as Order['status'],
        qrCode: qrData?.token_qr || `AUTO-${orderData.id_pedido}`,
        createdAt: orderData.creado_en || new Date().toISOString(),
        paymentMethod: 'card',
        paymentStatus: orderData.pagado_en ? 'completed' : 'pending',
        pickupCode: `PICKUP-${orderData.id_pedido}`,
      };
    } catch (error) {
      logger.error('❌ Error en getOrderById:', error);
      return null;
    }
  },

  // Actualizar estado del pedido
  async updateOrderStatus(orderId: string | number, newStatus: Order['status']): Promise<boolean> {
    try {
      const id = typeof orderId === 'string' ? parseInt(orderId) : orderId;
      
      // Mapear estado de UI a BD (usar valores en minúsculas que ya existen en BD)
      const statusMap: Record<Order['status'], string> = {
        'pending': 'pendiente',
        'processing': 'pagando',
        'ready': 'pagado',
        'picked-up': 'entregado',
        'cancelled': 'cancelado',
      };

      if (!navigator.onLine) {
        await queueOrderStatusUpdateOffline(id, statusMap[newStatus]);
        logger.warn(`📦 Cambio de estado encolado offline para pedido ${id}`);
        return true;
      }

      const { error } = await supabase
        .from('pedidos')
        .update({ estatus: statusMap[newStatus] })
        .eq('id_pedido', id);

      if (error) {
        if (shouldUseOfflineQueue(error)) {
          await queueOrderStatusUpdateOffline(id, statusMap[newStatus]);
          logger.warn(`📦 Cambio de estado encolado por error de red para pedido ${id}`);
          return true;
        }
        logger.error('❌ Error actualizando estado:', error);
        return false;
      }

      logger.log(`✅ Pedido ${id} actualizado a: ${newStatus}`);
      return true;
    } catch (error) {
      logger.error('❌ Error en updateOrderStatus:', error);
      return false;
    }
  },

  // Cancelar pedido
  async cancelOrder(orderId: string | number): Promise<boolean> {
    try {
      const id = typeof orderId === 'string' ? parseInt(orderId) : orderId;

      if (!navigator.onLine) {
        await queueOrderCancelOffline(id);
        logger.warn(`📦 Cancelación encolada offline para pedido ${id}`);
        return true;
      }
      
      const { error } = await supabase
        .from('pedidos')
        .update({ estatus: 'cancelado' })
        .eq('id_pedido', id);

      if (error) {
        if (shouldUseOfflineQueue(error)) {
          await queueOrderCancelOffline(id);
          logger.warn(`📦 Cancelación encolada por error de red para pedido ${id}`);
          return true;
        }
        logger.error('❌ Error cancelando pedido:', error);
        return false;
      }

      logger.log(`✅ Pedido ${id} cancelado`);
      return true;
    } catch (error) {
      logger.error('❌ Error en cancelOrder:', error);
      return false;
    }
  },

  // Obtener estadísticas de pedidos
  async getOrderStats() {
    try {
      const orders = await this.getAllOrders();
      
      return {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        ready: orders.filter(o => o.status === 'ready').length,
        pickedUp: orders.filter(o => o.status === 'picked-up').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      };
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas:', error);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        ready: 0,
        pickedUp: 0,
        cancelled: 0,
      };
    }
  },
};
