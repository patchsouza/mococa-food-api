
<template>
  <div class="orders-manager">

    <!-- Cabeçalho da seção -->
    <div class="orders-heading">
      <div>
        <h3>Pedidos recebidos</h3>
        <p>Acompanhe e gerencie os pedidos da sua loja.</p>
      </div>

      <div class="orders-counter">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M6 3h12l2 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7l2-4Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <path
            d="M4 7h16M9 11h6"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>

        <strong>{{ orders.storeOrders.length }}</strong>
        <span>
          {{ orders.storeOrders.length === 1 ? 'pedido' : 'pedidos' }}
        </span>
      </div>
    </div>

    <!-- Estado vazio -->
    <div v-if="orders.storeOrders.length === 0" class="empty-orders">
      <EmptyState
        icon="fas fa-receipt"
        message="Nenhum pedido ativo por enquanto."
      />
    </div>

    <!-- Lista de pedidos -->
    <div v-else class="orders-list">

      <article
        v-for="o in orders.storeOrders"
        :key="o.id"
        class="order-card"
        :class="{
          'order-ready': o.status === 'ready',
          'order-rejected': o.status === 'rejected'
        }"
      >

        <!-- Cabeçalho do pedido -->
        <div class="order-header">

          <div class="order-number">
            <span class="order-number-label">PEDIDO</span>
            <h3>#{{ String(o.id).slice(-4) }}</h3>
          </div>

          <span
            class="status-badge"
            :class="`status-${o.status}`"
          >
            <span class="status-indicator"></span>
            {{ statusLabel(o.status) }}
          </span>

        </div>

        <div class="order-divider"></div>

        <!-- Dados do cliente -->
        <div class="customer-section">

          <div class="customer-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="8"
                r="4"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <path
                d="M4 21a8 8 0 0 1 16 0"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
          </div>

          <div class="customer-information">
            <span class="information-label">CLIENTE</span>
            <strong>{{ o.customerName }}</strong>
          </div>

        </div>

        <!-- Endereço e pagamento -->
        <div class="order-metadata">

          <div class="metadata-item">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
              <circle
                cx="12"
                cy="10"
                r="2.5"
                stroke="currentColor"
                stroke-width="1.8"
              />
            </svg>

            <div>
              <span class="information-label">ENDEREÇO DE ENTREGA</span>
              <p>{{ formatAddress(o.deliveryAddress) }}</p>
            </div>
          </div>

          <div class="metadata-item">
            <svg viewBox="0 0 24 24" fill="none">
              <rect
                x="2"
                y="5"
                width="20"
                height="14"
                rx="2"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <path
                d="M2 10h20"
                stroke="currentColor"
                stroke-width="1.8"
              />
            </svg>

            <div>
              <span class="information-label">FORMA DE PAGAMENTO</span>
              <p>{{ paymentLabel(o.paymentMethod) }}</p>
            </div>
          </div>

        </div>

        <!-- Itens do pedido -->
        <div class="order-items-section">

          <div class="items-heading">
            <h4>Itens do pedido</h4>
            <span>{{ o.items.length }} {{ o.items.length === 1 ? 'item' : 'itens' }}</span>
          </div>

          <div class="order-items">
            <div
              v-for="i in o.items"
              :key="i.id"
              class="order-item"
            >
              <div class="item-description">
                <span class="item-quantity">{{ i.quantity }}x</span>
                <span class="item-name">{{ i.name }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Total -->
        <div class="order-total">
          <div>
            <span class="total-label">Valor total do pedido</span>
            <span class="total-caption">Valor registrado</span>
          </div>

          <strong>{{ formatCurrency(o.total) }}</strong>
        </div>

        <!-- Ações -->
        <div class="order-footer">

          <!-- Pedido pendente -->
          <template v-if="o.status === 'pending'">
            <div class="pending-message">
              <span class="pending-dot"></span>
              Aguardando confirmação
            </div>

            <div class="order-actions">
              <button
                type="button"
                class="action-btn reject-btn"
                @click="orders.updateStatus(o.id, 'rejected')"
              >
                Recusar
              </button>

              <button
                type="button"
                class="action-btn confirm-btn"
                @click="orders.updateStatus(o.id, 'accepted')"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="m5 12 5 5L20 7"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Confirmar pedido
              </button>
            </div>
          </template>

          <!-- Pedido aceito -->
          <template v-else-if="o.status === 'accepted'">
            <div class="progress-message">
              <span class="progress-dot accepted-dot"></span>
              Pedido confirmado
            </div>

            <button
              type="button"
              class="action-btn prepare-btn"
              @click="orders.updateStatus(o.id, 'preparing')"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3m9.3-4.3 2.1-2.1M18 12h3"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
                <path
                  d="M5 16a7 7 0 1 1 14 0v4H5v-4Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
              </svg>
              Iniciar preparo
            </button>
          </template>

          <!-- Em preparação -->
          <template v-else-if="o.status === 'preparing'">
            <div class="progress-message">
              <span class="progress-dot preparing-dot"></span>
              Pedido em preparação
            </div>

            <button
              type="button"
              class="action-btn ready-btn"
              @click="orders.updateStatus(o.id, 'ready')"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="m5 12 5 5L20 7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Pronto para retirada
            </button>
          </template>

          <!-- Pronto para retirada -->
          <template v-else-if="o.status === 'ready'">
            <div class="ready-message">
              <div class="ready-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <path
                    d="M12 7v5l3 2"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </div>

              <div>
                <strong>Pedido pronto!</strong>
                <span>Aguardando entregador para retirada.</span>
              </div>
            </div>
          </template>

          <!-- Pedido recusado -->
          <template v-else-if="o.status === 'rejected'">
            <div class="rejected-message">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  stroke-width="1.8"
                />
                <path
                  d="m9 9 6 6m0-6-6 6"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>

              Pedido recusado
            </div>
          </template>

        </div>

      </article>

    </div>
  </div>
</template>

<script setup>
import EmptyState from '../layout/EmptyState.vue'

import { useOrdersStore } from '../../stores/orders'

import {
  paymentLabel,
  formatAddress,
  statusLabel,
  formatCurrency
} from '../../utils/formatters'

const orders = useOrdersStore()
</script>

<style scoped>
.orders-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  min-width: 0;
}

/* Cabeçalho */
.orders-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.orders-heading h3 {
  margin: 0;
  color: #172033;
  font-size: 1rem;
  font-weight: 750;
}

.orders-heading p {
  margin: 5px 0 0;
  color: #8993a5;
  font-size: 0.82rem;
}

.orders-counter {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border: 1px solid #e5eaf1;
  border-radius: 9px;
  background: #ffffff;
  color: #7b8798;
  font-size: 0.78rem;
  white-space: nowrap;
}

.orders-counter svg {
  width: 17px;
  height: 17px;
  color: #3978e8;
}

.orders-counter strong {
  color: #2869d8;
  font-size: 0.85rem;
}

/* Lista */
.orders-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

/* Cartão */
.order-card {
  min-width: 0;
  padding: 19px;
  background: #ffffff;
  border: 1px solid #e8edf4;
  border-radius: 14px;
  box-shadow: 0 3px 12px rgba(25, 42, 70, 0.025);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.order-card:hover {
  border-color: #d6e1f1;
  box-shadow: 0 5px 18px rgba(25, 42, 70, 0.05);
}

.order-ready {
  border-color: #ccebd9;
}

.order-rejected {
  opacity: 0.78;
}

/* Cabeçalho do cartão */
.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.order-number {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.order-number-label,
.information-label {
  color: #98a2b3;
  font-size: 0.65rem;
  font-weight: 750;
  letter-spacing: 0.65px;
}

.order-number h3 {
  margin: 0;
  color: #172033;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.5px;
}

/* Status */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-indicator {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: currentColor;
}

.status-pending {
  color: #b7791f;
  background: #fff6df;
}

.status-accepted {
  color: #3478d9;
  background: #edf4ff;
}

.status-preparing {
  color: #8053bc;
  background: #f4effc;
}

.status-ready {
  color: #16834c;
  background: #eaf8f0;
}

.status-rejected {
  color: #c34b4b;
  background: #fff0f0;
}

/* Divisor */
.order-divider {
  height: 1px;
  margin: 15px 0;
  background: #edf0f5;
}

/* Cliente */
.customer-section {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 17px;
}

.customer-icon {
  width: 39px;
  height: 39px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #edf4ff;
  color: #3978e8;
  border-radius: 10px;
}

.customer-icon svg {
  width: 20px;
  height: 20px;
}

.customer-information {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-information strong {
  color: #253146;
  font-size: 0.91rem;
  overflow-wrap: anywhere;
}

/* Metadados */
.order-metadata {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 14px;
  background: #f8fafc;
  border-radius: 10px;
}

.metadata-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.metadata-item > svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  margin-top: 2px;
  color: #8493a8;
}

.metadata-item > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metadata-item p {
  margin: 0;
  color: #475569;
  font-size: 0.8rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

/* Itens */
.order-items-section {
  margin-top: 18px;
}

.items-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.items-heading h4 {
  margin: 0;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 700;
}

.items-heading > span {
  color: #98a2b3;
  font-size: 0.72rem;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.order-item {
  display: flex;
  align-items: flex-start;
}

.item-description {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
}

.item-quantity {
  min-width: 27px;
  padding: 3px 5px;
  text-align: center;
  color: #3978e8;
  background: #edf4ff;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 750;
}

.item-name {
  padding-top: 2px;
  color: #475569;
  font-size: 0.83rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/* Total */
.order-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 18px;
  padding: 15px 0;
  border-top: 1px dashed #e3e8ef;
  border-bottom: 1px solid #edf0f5;
}

.order-total > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.total-label {
  color: #475569;
  font-size: 0.82rem;
  font-weight: 650;
}

.total-caption {
  color: #a0a8b5;
  font-size: 0.69rem;
}

.order-total > strong {
  color: #16834c;
  font-size: 1.2rem;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Rodapé e ações */
.order-footer {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding-top: 15px;
}

.pending-message,
.progress-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7b8798;
  font-size: 0.75rem;
  font-weight: 550;
}

.pending-dot,
.progress-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.pending-dot {
  background: #e4a52c;
}

.accepted-dot {
  background: #3978e8;
}

.preparing-dot {
  background: #9563d1;
}

.order-actions {
  display: flex;
  gap: 9px;
}

.action-btn {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  font-family: inherit;
  font-size: 0.79rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

.confirm-btn {
  flex: 1;
  background: #16834c;
  color: #ffffff;
}

.confirm-btn:hover {
  background: #116d3e;
}

.reject-btn {
  background: #ffffff;
  color: #cb5151;
  border-color: #f0d4d4;
}

.reject-btn:hover {
  background: #fff0f0;
  border-color: #e8bcbc;
}

.prepare-btn {
  width: 100%;
  background: #3478e5;
  color: #ffffff;
}

.prepare-btn:hover {
  background: #2563c7;
}

.ready-btn {
  width: 100%;
  background: #16834c;
  color: #ffffff;
}

.ready-btn:hover {
  background: #116d3e;
}

/* Pedido pronto */
.ready-message {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px;
  background: #eaf8f0;
  border: 1px solid #d4eedf;
  border-radius: 10px;
}

.ready-icon {
  width: 35px;
  height: 35px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #d5f0e0;
  color: #16834c;
  border-radius: 9px;
}

.ready-icon svg {
  width: 19px;
  height: 19px;
}

.ready-message > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ready-message strong {
  color: #16834c;
  font-size: 0.82rem;
}

.ready-message span {
  color: #648b73;
  font-size: 0.73rem;
}

/* Pedido recusado */
.rejected-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c34b4b;
  font-size: 0.82rem;
  font-weight: 650;
}

.rejected-message svg {
  width: 19px;
  height: 19px;
}

/* Acessibilidade */
.action-btn:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 3px;
}

/* Tablets */
@media (max-width: 950px) {
  .orders-list {
    grid-template-columns: 1fr;
  }
}

/* Smartphones */
@media (max-width: 540px) {
  .orders-heading {
    align-items: flex-start;
  }

  .orders-heading h3 {
    font-size: 0.95rem;
  }

  .orders-heading p {
    font-size: 0.76rem;
  }

  .orders-counter {
    padding: 7px 9px;
    font-size: 0.7rem;
  }

  .orders-list {
    gap: 13px;
  }

  .order-card {
    padding: 15px;
    border-radius: 12px;
  }

  .order-number h3 {
    font-size: 1.15rem;
  }

  .status-badge {
    padding: 6px 8px;
    font-size: 0.66rem;
  }

  .order-metadata {
    padding: 12px;
  }

  .order-total > strong {
    font-size: 1.1rem;
  }

  .action-btn {
    min-height: 43px;
    font-size: 0.76rem;
  }
}

@media (max-width: 360px) {
  .orders-heading {
    flex-wrap: wrap;
  }

  .order-actions {
    flex-direction: column-reverse;
  }

  .reject-btn,
  .confirm-btn {
    width: 100%;
    min-height: 42px;
  }
}
</style>
