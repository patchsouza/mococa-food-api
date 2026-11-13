<template>
  <div class="view">
    <AppHeader
      title="Sua sacola"
      :subtitle="restaurant?.name"
      :show-back="nav.canGoBack"
      @back="nav.goBack()"
    />

    <template v-if="restaurant && cart.items.length > 0">
      <!-- Itens -->
      <section class="card" aria-label="Itens da sacola">
        <ul class="cart-list">
          <li v-for="item in cart.items" :key="item.id" class="cart-item">
            <div class="cart-item__info">
              <h4>{{ item.name }}</h4>
              <span class="cart-item__price">{{ formatCurrency(item.price * item.quantity) }}</span>
              <span v-if="item.quantity > 1" class="cart-item__unit">
                {{ item.quantity }} × {{ formatCurrency(item.price) }}
              </span>
            </div>

            <div class="stepper" role="group" :aria-label="`Quantidade de ${item.name}`">
              <button
                type="button"
                class="stepper__btn"
                :class="{ 'stepper__btn--danger': item.quantity === 1 }"
                :aria-label="item.quantity === 1 ? `Remover ${item.name}` : `Diminuir quantidade de ${item.name}`"
                @click="cart.updateQty(item.id, -1)"
              >
                <i :class="item.quantity === 1 ? 'fas fa-trash' : 'fas fa-minus'" aria-hidden="true"></i>
              </button>
              <span class="stepper__qty" aria-live="polite">{{ item.quantity }}</span>
              <button
                type="button"
                class="stepper__btn"
                :aria-label="`Aumentar quantidade de ${item.name}`"
                @click="cart.updateQty(item.id, 1)"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
            </div>
          </li>
        </ul>

        <button v-if="nav.canGoBack" type="button" class="link-btn" @click="nav.goBack()">
          <i class="fas fa-plus" aria-hidden="true"></i> Adicionar mais itens
        </button>
      </section>

      <!-- Endereço -->
      <section class="card" aria-label="Endereço de entrega">
        <h3 class="section-title"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> Entregar em</h3>
        <p class="address">
          <strong>{{ address.street }}, {{ address.number }}</strong>
          <span>{{ address.city }}/{{ address.state }}</span>
        </p>
      </section>

      <!-- Pagamento -->
      <section class="card" aria-label="Forma de pagamento">
        <h3 class="section-title"><i class="fas fa-wallet" aria-hidden="true"></i> Forma de pagamento</h3>
        <div class="pay-options" role="radiogroup" aria-label="Forma de pagamento">
          <label
            v-for="opt in paymentOptions"
            :key="opt.value"
            class="pay-option"
            :class="{ 'pay-option--active': form.payment === opt.value }"
          >
            <input
              v-model="form.payment"
              class="sr-only"
              type="radio"
              name="payment"
              :value="opt.value"
            />
            <i :class="opt.icon" class="pay-option__icon" aria-hidden="true"></i>
            <span class="pay-option__text">
              <span class="pay-option__label">{{ opt.label }}</span>
              <span class="pay-option__hint">{{ opt.hint }}</span>
            </span>
            <i class="fas fa-check-circle pay-option__check" aria-hidden="true"></i>
          </label>
        </div>
      </section>

      <!-- Resumo -->
      <section class="card summary" aria-label="Resumo do pedido">
        <div class="summary__row">
          <span>Subtotal</span>
          <span>{{ formatCurrency(cart.subtotal) }}</span>
        </div>
        <div class="summary__row">
          <span>Taxa de entrega</span>
          <span :class="{ 'summary__free': !restaurant.deliveryFee }">
            {{ restaurant.deliveryFee > 0 ? formatCurrency(restaurant.deliveryFee) : 'Grátis' }}
          </span>
        </div>
        <div class="summary__row summary__row--total">
          <span>Total</span>
          <span>{{ formatCurrency(cart.total) }}</span>
        </div>
      </section>

      <!-- Aviso de pedido mínimo -->
      <div v-if="!cart.meetsMinimum" class="alert" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{{ minMessage }}</span>
      </div>

      <!-- Barra de confirmação (sempre visível) -->
      <div class="checkout-bar">
        <div class="checkout-bar__total">
          <span>Total</span>
          <strong>{{ formatCurrency(cart.total) }}</strong>
        </div>
        <button
          type="button"
          class="btn btn-primary checkout-bar__btn"
          :disabled="!cart.meetsMinimum || submitting"
          @click="confirmOrder"
        >
          <i v-if="!submitting && form.payment === 'pix'" class="fas fa-qrcode" aria-hidden="true"></i>
          {{ submitLabel }}
        </button>
      </div>
    </template>

    <!-- Sacola vazia (não aparece enquanto o modal de Pix está aberto) -->
    <template v-else-if="!pixOrderId">
      <EmptyState icon="fas fa-shopping-bag" message="Sua sacola está vazia." />
      <div class="empty-action">
        <button type="button" class="btn btn-primary" @click="nav.reset('cliente-home')">Ver lojas</button>
      </div>
    </template>

    <!-- Modal de pagamento Pix (QR Code + copia-e-cola + polling de status) -->
    <PixCheckoutModal
      v-if="pixOrderId"
      :order-id="pixOrderId"
      @paid="onPixPaid"
      @closed="onPixClosed"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import EmptyState from '../layout/EmptyState.vue'
import PixCheckoutModal from './PixCheckoutModal.vue'
import { useCartStore } from '../../stores/cart'
import { useOrdersStore } from '../../stores/orders'
import { useNavigationStore } from '../../stores/navigation'
import { formatCurrency } from '../../utils/formatters'

const cart = useCartStore()
const orders = useOrdersStore()
const nav = useNavigationStore()

const restaurant = computed(() => cart.selectedRestaurant)
const address = reactive({ street: 'Rua das Flores', number: '123', city: 'Mococa', state: 'SP' })
const form = reactive({ payment: 'pix' })

const submitting = ref(false)
const pixOrderId = ref(null)

const paymentOptions = [
  { value: 'pix', label: 'Pix', hint: 'Aprovação na hora', icon: 'fas fa-qrcode' },
  { value: 'cash', label: 'Dinheiro', hint: 'Pague na entrega', icon: 'fas fa-money-bill-wave' },
  { value: 'credit_card', label: 'Cartão', hint: 'Pague na entrega', icon: 'fas fa-credit-card' }
]

const remainingToMin = computed(() =>
  Math.max(0, (restaurant.value?.minOrderValue ?? 0) - cart.subtotal)
)

const minMessage = computed(() =>
  remainingToMin.value > 0
    ? `Faltam ${formatCurrency(remainingToMin.value)} para o pedido mínimo de ${formatCurrency(restaurant.value.minOrderValue)}.`
    : `Valor mínimo do pedido é ${formatCurrency(restaurant.value?.minOrderValue ?? 0)}.`
)

const submitLabel = computed(() => {
  if (submitting.value) return 'Enviando…'
  return form.payment === 'pix' ? 'Pagar com Pix' : 'Confirmar pedido'
})

function confirmOrder() {
  if (submitting.value || !cart.meetsMinimum) return
  submitting.value = true
  try {
    const order = orders.create({
      restaurantId: restaurant.value.id,
      items: [...cart.items],
      total: cart.total,
      deliveryFee: restaurant.value.deliveryFee,
      paymentMethod: form.payment,
      deliveryAddress: { ...address }
    })
    cart.clear()

    if (form.payment === 'pix') {
      // Abre o modal de Pix — a transação real é criada via POST /orders/:id/pix
      pixOrderId.value = order?.id ?? null
    } else {
      nav.reset('cliente-home')
      alert('Pedido enviado para a loja!')
    }
  } finally {
    submitting.value = false
  }
}

function onPixPaid(transaction) {
  pixOrderId.value = null
  nav.reset('cliente-home')
  alert(`Pagamento Pix confirmado (${transaction.transactionId})! O restaurante já foi notificado.`)
}

function onPixClosed(transaction) {
  pixOrderId.value = null
  nav.reset('cliente-home')
  if (!transaction || transaction.status === 'pending') {
    alert('O pedido ficou aguardando o pagamento Pix. Pague pelo app do banco antes que o código expire.')
  }
}
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 1rem;
}
.section-title i {
  color: var(--primary, #ea1d2c);
}

/* Itens */
.cart-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cart-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border, #e5e5e5);
}
.cart-item:first-child {
  padding-top: 0;
}
.cart-item:last-child {
  border-bottom: 0;
}
.cart-item__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cart-item__info h4 {
  margin: 0;
  font-size: 0.95rem;
}
.cart-item__price {
  font-size: 0.9rem;
  font-weight: 600;
}
.cart-item__unit {
  font-size: 0.78rem;
  color: var(--text-light, #888);
}

.stepper {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 999px;
}
.stepper__btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--primary, #ea1d2c);
  font-size: 0.8rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.stepper__btn:active {
  background: var(--bg-soft, #f3f3f3);
}
.stepper__btn--danger {
  color: var(--danger, #d92d20);
}
.stepper__qty {
  min-width: 22px;
  text-align: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.link-btn {
  margin-top: 4px;
  padding: 8px 0 0;
  border: 0;
  background: transparent;
  color: var(--primary, #ea1d2c);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.link-btn i {
  margin-right: 4px;
  font-size: 0.75rem;
}

/* Endereço */
.address {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.9rem;
  color: var(--text-light, #888);
}
.address strong {
  color: inherit;
  font-weight: 600;
}

/* Pagamento */
.pay-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pay-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1.5px solid var(--border, #e5e5e5);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.pay-option--active {
  border-color: var(--primary, #ea1d2c);
  background: color-mix(in srgb, var(--primary, #ea1d2c) 7%, transparent);
}
.pay-option:has(input:focus-visible) {
  outline: 2px solid var(--primary, #ea1d2c);
  outline-offset: 2px;
}
.pay-option__icon {
  width: 22px;
  text-align: center;
  font-size: 1.1rem;
  color: var(--text-light, #888);
}
.pay-option--active .pay-option__icon {
  color: var(--primary, #ea1d2c);
}
.pay-option__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.pay-option__label {
  font-weight: 600;
  font-size: 0.95rem;
}
.pay-option__hint {
  font-size: 0.8rem;
  color: var(--text-light, #888);
}
.pay-option__check {
  color: var(--primary, #ea1d2c);
  opacity: 0;
  transition: opacity 0.15s;
}
.pay-option--active .pay-option__check {
  opacity: 1;
}

/* Resumo */
.summary__row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.95rem;
}
.summary__free {
  color: var(--success, #1a9e4a);
  font-weight: 600;
}
.summary__row--total {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--border, #e5e5e5);
  font-size: 1.1rem;
  font-weight: 700;
}

/* Aviso de mínimo */
.alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 16px 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary, #ea1d2c) 10%, transparent);
  color: var(--primary, #ea1d2c);
  font-size: 0.85rem;
  line-height: 1.35;
}
.alert i {
  margin-top: 2px;
}

/* Barra de confirmação */
.checkout-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--card-bg, #fff);
  border-top: 1px solid var(--border, #e5e5e5);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
}
.checkout-bar__total {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  font-size: 0.78rem;
  color: var(--text-light, #888);
}
.checkout-bar__total strong {
  font-size: 1.1rem;
  color: var(--text, inherit);
}
.checkout-bar__btn {
  flex: 1;
  width: auto;
}
.checkout-bar__btn i {
  margin-right: 6px;
}

.empty-action {
  padding: 0 16px;
}

@media (prefers-reduced-motion: reduce) {
  .pay-option,
  .pay-option__check {
    transition: none;
  }
}
</style>