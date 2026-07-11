<template>
  <div class="tracker">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h3 style="font-size:1rem;">Pedido em andamento #{{ order.id.slice(-4) }}</h3>
        <p style="font-size:0.8rem; opacity:0.9;">{{ paymentLabel(order.paymentMethod) }} · {{ formatCurrency(order.total) }}</p>
      </div>
      <button class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:white;" @click="$emit('cancel')">
        Cancelar
      </button>
    </div>
    <div class="tracker-steps">
      <div class="step" :class="{ active: reached('accepted') }">
        <div class="step-icon"><i class="fas fa-check"></i></div>
        <span>Confirmado</span>
      </div>
      <div class="step" :class="{ active: reached('preparing') }">
        <div class="step-icon"><i class="fas fa-utensils"></i></div>
        <span>Preparando</span>
      </div>
      <div class="step" :class="{ active: reached('ready') }">
        <div class="step-icon"><i class="fas fa-box"></i></div>
        <span>Pronto</span>
      </div>
      <div class="step" :class="{ active: reached('delivering') }">
        <div class="step-icon"><i class="fas fa-motorcycle"></i></div>
        <span>A caminho</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { paymentLabel, formatCurrency } from '../../utils/formatters'

const props = defineProps({
  order: { type: Object, required: true }
})

defineEmits(['cancel'])

const STAGE_ORDER = ['accepted', 'preparing', 'ready', 'delivering', 'completed']

function reached(stage) {
  return STAGE_ORDER.slice(STAGE_ORDER.indexOf(stage)).includes(props.order.status)
}
</script>
