import { supabase } from '../../lib/supabase';
import {
  enqueuePendingAction,
  getPendingActions,
  incrementPendingActionAttempts,
  removePendingAction,
  PendingAction,
} from './offlineDb';
import { logger } from '../utils/logger';

interface PendingOrderPayload {
  orderId: number;
  status?: string;
}

const MAX_ATTEMPTS = 5;

async function processOrderAction(action: PendingAction<PendingOrderPayload>): Promise<boolean> {
  const payload = action.payload;

  if (!payload || !payload.orderId) {
    return true;
  }

  if (action.action === 'cancel-order') {
    const { error } = await supabase
      .from('pedidos')
      .update({ estatus: 'cancelado' })
      .eq('id_pedido', payload.orderId);

    return !error;
  }

  if (action.action === 'update-status' && payload.status) {
    const { error } = await supabase
      .from('pedidos')
      .update({ estatus: payload.status })
      .eq('id_pedido', payload.orderId);

    return !error;
  }

  return true;
}

export async function queueOrderStatusUpdateOffline(orderId: number, status: string): Promise<void> {
  await enqueuePendingAction({
    entity: 'order',
    action: 'update-status',
    payload: { orderId, status },
  });
}

export async function queueOrderCancelOffline(orderId: number): Promise<void> {
  await enqueuePendingAction({
    entity: 'order',
    action: 'cancel-order',
    payload: { orderId },
  });
}

export async function syncPendingActions(): Promise<number> {
  if (!navigator.onLine) {
    return 0;
  }

  const actions = await getPendingActions();
  if (actions.length === 0) {
    return 0;
  }

  const sortedActions = [...actions].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let syncedCount = 0;

  for (const action of sortedActions) {
    if (typeof action.id !== 'number') {
      continue;
    }

    try {
      const ok = await processOrderAction(action as PendingAction<PendingOrderPayload>);
      if (ok) {
        await removePendingAction(action.id);
        syncedCount += 1;
      } else {
        await incrementPendingActionAttempts(action.id);
        if ((action.attempts || 0) + 1 >= MAX_ATTEMPTS) {
          await removePendingAction(action.id);
          logger.warn('Se descartó acción offline por exceder intentos', action);
        }
      }
    } catch (error) {
      await incrementPendingActionAttempts(action.id);
      logger.warn('Error sincronizando acción offline', error);
    }
  }

  return syncedCount;
}
