<template>
  <div v-if="transaction" class="modal-overlay" @click.self="attemptClose">
    <div class="modal card" style="max-width: 420px; margin: 0 auto;">
      <h3 style="margin-bottom: 4px;">Pagamento via Pix</h3>
      <p style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 16px;">
        Escaneie o QR Code ou copie o código "copia e cola".
        {{ transaction.beneficiary?.name ? `Beneficiário: ${transaction.beneficiary.name}.` : '' }}
      </p>

      <!-- Status -->
      <div class="status-banner" :class="`status-${status}`">
        <span v-if="status === 'pending'">⏳ Aguardando pagamento…</span>
        <span v-else-if="status === 'paid'">✅ Pagamento confirmado!</span>
        <span v-else-if="status === 'expired'">⌛ O código expirou.</span>
        <span v-else-if="status === 'cancelled'">❌ Transação cancelada.</span>
      </div>

      <!-- QR Code -->
      <div v-if="status === 'pending' && transaction.qrCodeBase64" style="text-align: center; margin: 12px 0;">
        <img :src="transaction.qrCodeBase64" alt="QR Code Pix" style="width: 220px; height: 220px;" />
      </div>

      <!-- Copia e cola -->
      <div v-if="status === 'pending'" style="margin-bottom: 12px;">
        <textarea
          readonly
          rows="3"
          style="width: 100%; font-size: 0.7rem; font-family: monospace;"
          :value="transaction.pixCode"
          @focus="$event.target.select()"
        ></textarea>
        <button class="btn btn-sm btn-secondary" style="margin-top: 6px;" @click="copyCode">
          {{ copied ? 'Copiado!' : 'Copiar código' }}
        </button>
      </div>

      <!-- Valor + expiração -->
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 12px;">
        <strong>{{ formatCurrency(transaction.amount) }}</strong>
        <span v-if="status === 'pending' && remainingSeconds !== null" style="color: var(--text-light);">
          Expira em {{ countdownLabel }}
        </span>
      </div>

      <div style="display: flex; gap: 8px;">
        <button
          v-if="status === 'pending'"
          class="btn btn-secondary"
          :disabled="cancelling"
          @click="cancelPayment"
        >
          {{ cancelling ? 'Cancelando…' : 'Cancelar pagamento' }}
        </button>
        <button class="btn btn-primary" @click="attemptClose">
          {{ status === 'paid' ? 'Acompanhar pedido' : 'Fechar' }}
        </button>
      </div>

      <p v-if="error" style="color: var(--primary); font-size: 0.8rem; margin-top: 8px;">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { pixApi } from '../../utils/api'
import { formatCurrency } from '../../utils/formatters'

const props = defineProps({
  orderId: { type: String, required: true }
})
const emit = defineEmits(['paid', 'closed'])

const POLL_INTERVAL_MS = 4000

const transaction = ref(null)
const status = computed(() => transaction.value?.status || 'pending')
const cancelling = ref(false)
const copied = ref(false)
const error = ref('')

let pollTimer = null
let countdownTimer = null
const remainingSeconds = ref(null)

async function loadTransaction() {
  error.value = ''
  try {
    transaction.value = await pixApi.createForOrder(props.orderId)
  } catch (e) {
    // 401/403/500 — backend real ainda não plugado no frontend mockado
    error.value = e.status === 401
      ? 'Faça login real para pagar com Pix.'
      : `Não foi possível gerar o Pix: ${e.message}`
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!transaction.value || status.value !== 'pending') return
    try {
      const fresh = await pixApi.getByOrder(props.orderId)
      transaction.value = { ...transaction.value, ...fresh }
      if (fresh.status === 'paid') {
        stopPolling()
        emit('paid', fresh)
      } else if (['expired', 'cancelled'].includes(fresh.status)) {
        stopPolling()
      }
    } catch {
      /* falha transitória de rede — tenta no próximo tick */
    }
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startCountdown() {
  stopCountdown()
  const tick = () => {
    if (!transaction.value?.expiresAt) return
    const ms = new Date(transaction.value.expiresAt).getTime() - Date.now()
    remainingSeconds.value = Math.max(0, Math.floor(ms / 1000))
    if (remainingSeconds.value === 0) stopCountdown()
  }
  tick()
  countdownTimer = setInterval(tick, 1000)
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
}

const countdownLabel = computed(() => {
  const s = remainingSeconds.value
  if (s === null) return ''
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

async function copyCode() {
  try {
    await navigator.clipboard.writeText(transaction.value.pixCode)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    error.value = 'Não foi possível copiar automaticamente. Selecione o texto manualmente.'
  }
}

async function cancelPayment() {
  cancelling.value = true
  try {
    const cancelled = await pixApi.cancel(transaction.value.transactionId, 'Cancelado pelo cliente')
    transaction.value = { ...transaction.value, ...cancelled, status: 'cancelled' }
    stopPolling()
  } catch (e) {
    error.value = `Falha ao cancelar: ${e.message}`
  } finally {
    cancelling.value = false
  }
}

function attemptClose() {
  if (status.value === 'pending' && transaction.value) {
    // deixa a transação viva: o webhook confirma depois do fechamento
  }
  emit('closed', transaction.value)
}

onMounted(async () => {
  await loadTransaction()
  if (transaction.value?.status === 'pending') {
    startPolling()
    startCountdown()
  }
})

onBeforeUnmount(() => {
  stopPolling()
  stopCountdown()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal {
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
.status-banner {
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.9rem;
  font-weight: 600;
}
.status-pending { background: #fff8e1; color: #8a6d00; }
.status-paid { background: #e6f6e6; color: #1b7a1b; }
.status-expired, .status-cancelled { background: #fdecea; color: #a33; }
</style>
