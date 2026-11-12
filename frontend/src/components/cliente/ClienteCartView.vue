<template>
  <div class="view">
    <AppHeader title="Sua sacola" :show-back="nav.canGoBack" @back="nav.goBack()" />

    <div class="card">
      <div
        v-for="item in cart.items"
        :key="item.id"
        style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border);"
      >
        <div>
          <h4 style="font-size:0.95rem;">{{ item.name }}</h4>
          <span style="color:var(--text-light); font-size:0.85rem;">{{ formatCurrency(item.price * item.quantity) }}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-sm btn-secondary" @click="cart.updateQty(item.id, -1)">-</button>
          <span style="font-weight:600;">{{ item.quantity }}</span>
          <button class="btn btn-sm btn-secondary" @click="cart.updateQty(item.id, 1)">+</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px;">Entregar em</h3>
      <p style="font-size:0.9rem; color:var(--text-light);">
        {{ address.street }}, {{ address.number }} - {{ address.city }}/{{ address.state }}
      </p>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px;">Forma de pagamento</h3>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm" :class="form.payment === 'pix' ? 'btn-primary' : 'btn-secondary'" @click="form.payment = 'pix'">Pix</button>
        <button class="btn btn-sm" :class="form.payment === 'cash' ? 'btn-primary' : 'btn-secondary'" @click="form.payment = 'cash'">Dinheiro</button>
        <button class="btn btn-sm" :class="form.payment === 'credit_card' ? 'btn-primary' : 'btn-secondary'" @click="form.payment = 'credit_card'">Cartão</button>
      </div>
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>Subtotal</span><span>{{ formatCurrency(cart.subtotal) }}</span></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>Taxa de entrega</span><span>{{ formatCurrency(restaurant.deliveryFee) }}</span></div>
      <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; border-top:1px solid var(--border); padding-top:8px;">
        <span>Total</span><span>{{ formatCurrency(cart.total) }}</span>
      </div>
    </div>

    <div style="padding: 0 16px;">
      <p v-if="!cart.meetsMinimum" style="color:var(--primary); font-size:0.85rem; margin-bottom:12px; text-align:center;">
        Valor mínimo do pedido é {{ formatCurrency(restaurant.minOrderValue) }}
      </p>
      <button class="btn btn-primary" :disabled="!cart.meetsMinimum || submitting" @click="confirmOrder">
        {{ submitting ? 'Enviando…' : 'Confirmar pedido' }}
      </button>
    </div>

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

function confirmOrder() {
  submitting.value = true
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
    submitting.value = false
  } else {
    submitting.value = false
    nav.reset('cliente-home')
    alert('Pedido enviado para a loja!')
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
