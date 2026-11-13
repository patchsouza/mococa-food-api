
<template>
  <div class="store-dashboard">
    <AppHeader
      :title="catalog.myRestaurant.name"
      subtitle="Painel de gerenciamento da loja"
      show-logout
      @logout="auth.logout()"
    >
      <template #actions>
        <button
          type="button"
          class="store-status"
          :class="catalog.myRestaurant.isOpen ? 'is-open' : 'is-closed'"
          :aria-pressed="catalog.myRestaurant.isOpen"
          @click="catalog.toggleMyStoreStatus()"
        >
          <span class="status-dot"></span>
          <span>
            {{ catalog.myRestaurant.isOpen ? 'Loja aberta' : 'Loja fechada' }}
          </span>
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </template>
    </AppHeader>

    <main class="dashboard-content">

      <!-- Resumo do dia -->
      <section class="overview-section">
        <div class="section-heading">
          <div>
            <h2>Visão geral</h2>
            <p>Acompanhe o desempenho da sua loja.</p>
          </div>

          <span class="today-label">
            <svg viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <path
                d="M16 3v4M8 3v4M3 10h18"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            Hoje
          </span>
        </div>

        <div class="stats-grid">

          <!-- Pedidos -->
          <article class="stat-card orders-card">
            <div class="stat-top">
              <div class="stat-icon orders-icon">
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
              </div>

              <span class="stat-caption">Movimento</span>
            </div>

            <div class="stat-information">
              <span class="stat-value">
                {{ orders.restStatsToday.ordersToday }}
              </span>
              <span class="stat-label">Pedidos recebidos</span>
            </div>

            <div class="stat-footer">
              <span>Volume de pedidos de hoje</span>
            </div>
          </article>

          <!-- Faturamento -->
          <article class="stat-card revenue-card">
            <div class="stat-top">
              <div class="stat-icon revenue-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </div>

              <span class="stat-caption">Financeiro</span>
            </div>

            <div class="stat-information">
              <span class="stat-value">
                {{ formatCurrency(orders.restStatsToday.revenueToday) }}
              </span>
              <span class="stat-label">Faturamento bruto</span>
            </div>

            <div class="stat-footer">
              <span>Total registrado hoje</span>
            </div>
          </article>

        </div>
      </section>

      <!-- Área de gerenciamento -->
      <section class="management-section">

        <div class="management-heading">
          <div>
            <h2>Gerenciar loja</h2>
            <p>Administre seus pedidos e produtos.</p>
          </div>
        </div>

        <!-- Navegação -->
        <div class="tabs-container">
          <div class="tabs" role="tablist" aria-label="Gerenciamento da loja">

            <button
              type="button"
              class="tab"
              :class="{ active: tab === 'pedidos' }"
              role="tab"
              :aria-selected="tab === 'pedidos'"
              @click="tab = 'pedidos'"
            >
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
              <span>Pedidos</span>
            </button>

            <button
              type="button"
              class="tab"
              :class="{ active: tab === 'cardapio' }"
              role="tab"
              :aria-selected="tab === 'cardapio'"
              @click="tab = 'cardapio'"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 5h16M4 12h16M4 19h16"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
                <circle cx="2.5" cy="5" r="1" fill="currentColor"/>
                <circle cx="2.5" cy="12" r="1" fill="currentColor"/>
                <circle cx="2.5" cy="19" r="1" fill="currentColor"/>
              </svg>
              <span>Cardápio</span>
            </button>

          </div>
        </div>

        <!-- Conteúdo das abas -->
        <div class="tab-content">
          <LojaOrdersTab v-if="tab === 'pedidos'" />

          <LojaMenuTab v-else-if="tab === 'cardapio'" />
        </div>

      </section>

    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

import AppHeader from '../layout/AppHeader.vue'
import LojaOrdersTab from './LojaOrdersTab.vue'
import LojaMenuTab from './LojaMenuTab.vue'

import { useAuthStore } from '../../stores/auth'
import { useCatalogStore } from '../../stores/catalog'
import { useOrdersStore } from '../../stores/orders'
import { formatCurrency } from '../../utils/formatters'

const auth = useAuthStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()

const tab = ref('pedidos')
</script>

<style scoped>
.store-dashboard {
  min-height: 100vh;
  background: #f5f7fb;
  color: #172033;
}

/* Conteúdo principal */
.dashboard-content {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 30px 32px 50px;
  box-sizing: border-box;
}

/* Cabeçalhos das seções */
.section-heading,
.management-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.section-heading h2,
.management-heading h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 750;
  color: #172033;
  letter-spacing: -0.3px;
}

.section-heading p,
.management-heading p {
  margin: 5px 0 0;
  color: #8993a5;
  font-size: 0.88rem;
}

.today-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  background: #ffffff;
  border: 1px solid #e8ecf2;
  border-radius: 10px;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 600;
}

.today-label svg {
  width: 16px;
  height: 16px;
}

/* Indicadores */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 38px;
}

.stat-card {
  position: relative;
  min-width: 0;
  padding: 23px;
  background: #ffffff;
  border: 1px solid #e9edf3;
  border-radius: 16px;
  box-shadow: 0 3px 12px rgba(25, 42, 70, 0.025);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(25, 42, 70, 0.06);
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.stat-icon {
  width: 43px;
  height: 43px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.stat-icon svg {
  width: 21px;
  height: 21px;
}

.orders-icon {
  background: #edf4ff;
  color: #3978e8;
}

.revenue-icon {
  background: #eaf8f0;
  color: #20945a;
}

.stat-caption {
  color: #98a1b1;
  font-size: 0.78rem;
  font-weight: 600;
}

.stat-information {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 20px;
}

.stat-value {
  color: #172033;
  font-size: clamp(1.55rem, 2.5vw, 2rem);
  font-weight: 750;
  letter-spacing: -1px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 500;
}

.stat-footer {
  margin-top: 19px;
  padding-top: 13px;
  border-top: 1px solid #f0f2f6;
  color: #9aa3b2;
  font-size: 0.77rem;
}

/* Status da loja */
.store-status {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 11px;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.2s ease;
}

.store-status svg {
  width: 15px;
  height: 15px;
}

.store-status.is-open {
  color: #16834c;
  background: #eaf8f0;
  border-color: #ccebd9;
}

.store-status.is-open:hover {
  background: #d9f3e4;
}

.store-status.is-closed {
  color: #c34b4b;
  background: #fff0f0;
  border-color: #f5d3d3;
}

.store-status.is-closed:hover {
  background: #ffe3e3;
}

.status-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: currentColor;
}

/* Gerenciamento */
.management-section {
  background: #ffffff;
  border: 1px solid #e9edf3;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 3px 12px rgba(25, 42, 70, 0.025);
}

.management-heading {
  margin-bottom: 22px;
}

/* Abas */
.tabs-container {
  border-bottom: 1px solid #edf0f5;
}

.tabs {
  display: flex;
  align-items: center;
  gap: 28px;
}

.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 48px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: #8993a5;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}

.tab svg {
  width: 18px;
  height: 18px;
}

.tab:hover {
  color: #3978e8;
}

.tab.active {
  color: #2869d8;
}

.tab.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  border-radius: 4px 4px 0 0;
  background: #3978e8;
}

.tab:focus-visible,
.store-status:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 3px;
}

/* Conteúdo */
.tab-content {
  padding-top: 22px;
  min-width: 0;
}

/* Tablets */
@media (max-width: 768px) {
  .dashboard-content {
    padding: 24px 20px 40px;
  }

  .stats-grid {
    gap: 13px;
  }

  .stat-card {
    padding: 19px;
  }

  .management-section {
    padding: 20px;
  }
}

/* Smartphones */
@media (max-width: 540px) {
  .dashboard-content {
    padding: 20px 14px 32px;
  }

  .section-heading,
  .management-heading {
    align-items: flex-start;
  }

  .section-heading h2,
  .management-heading h2 {
    font-size: 1.05rem;
  }

  .section-heading p,
  .management-heading p {
    font-size: 0.8rem;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 27px;
  }

  .stat-card {
    padding: 14px;
    border-radius: 13px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .stat-icon svg {
    width: 18px;
    height: 18px;
  }

  .stat-caption {
    font-size: 0.68rem;
  }

  .stat-information {
    margin-top: 16px;
  }

  .stat-value {
    font-size: clamp(1.15rem, 5vw, 1.55rem);
  }

  .stat-label {
    font-size: 0.76rem;
  }

  .stat-footer {
    margin-top: 13px;
    padding-top: 10px;
    font-size: 0.68rem;
  }

  .today-label {
    padding: 7px 9px;
    font-size: 0.74rem;
  }

  .management-section {
    padding: 16px 13px;
    border-radius: 13px;
  }

  .tabs {
    gap: 22px;
  }

  .tab {
    min-height: 45px;
    font-size: 0.84rem;
  }

  .tab-content {
    padding-top: 17px;
  }
}

@media (max-width: 360px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 17px;
  }
}
</style>
