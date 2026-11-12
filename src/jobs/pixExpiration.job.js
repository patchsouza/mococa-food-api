import { expireOldPixTransactions } from '../services/pix.service.js';

/**
 * Agenda a expiração periódica de transações Pix pendentes vencidas.
 * Retorna uma função de cleanup que cancela o timer (útil para testes/shutdown).
 */
export function schedulePixExpiration(log, { intervalMs = 60_000 } = {}) {
  const run = async () => {
    try {
      const result = await expireOldPixTransactions();
      if (result.expiredCount > 0) {
        log.info(result, 'Job de expiração Pix executado');
      }
    } catch (error) {
      log.error({ error }, 'Falha no job de expiração Pix');
    }
  };

  // Executa uma vez ao iniciar e depois em intervalo fixo
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.(); // não impede o processo de encerrar

  return () => clearInterval(timer);
}
