import { Order } from '../models/Order.js';
import { enqueueDeliveryOffer } from '../services/delivery.service.js';
import { env } from '../config/env.js';

/** Reoffers orders still waiting for a courier, including after an API restart. */
export function scheduleDeliveryOfferRetry(log, { intervalMs = env.deliveryOfferRetryIntervalMs } = {}) {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;

    try {
      const orders = await Order.find({ status: 'awaiting_courier' }).populate('restaurant');
      const results = await Promise.allSettled(orders.map((order) => enqueueDeliveryOffer(order)));
      const failed = results.filter((result) => result.status === 'rejected');
      const offersSent = results.reduce(
        (total, result) => total + (result.status === 'fulfilled' ? result.value.offered : 0),
        0
      );

      if (orders.length > 0) {
        log.info({ pendingOrders: orders.length, offersSent }, 'Busca periódica de motoboys executada');
      }
      if (failed.length > 0) {
        log.error({ errors: failed.map((result) => result.reason.message) }, 'Falha ao reenviar algumas corridas');
      }
    } catch (error) {
      log.error({ error }, 'Falha na busca periódica de motoboys');
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();

  return () => clearInterval(timer);
}