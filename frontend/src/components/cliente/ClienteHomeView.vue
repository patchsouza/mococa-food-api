<template>
  <div class="view">
    <AppHeader
      :title="`Olá, ${firstName} 👋`"
      :subtitle="greeting"
      show-logout
      @logout="auth.logout()"
    />

    <OrderTracker
      v-if="orders.myActiveOrder"
      :order="orders.myActiveOrder"
      @cancel="orders.cancel(orders.myActiveOrder.id)"
    />

    <main class="home">
      <section class="food-feature">
        <div class="food-feature__copy">
          <span class="feature-eyebrow">MOCOCA À MESA</span>
          <h2>Tem sabor bom<br>morando aqui.</h2>
          <p>Descubra quem cozinha pertinho.</p>
        </div>
        <span class="food-feature__stamp" aria-hidden="true">Feito<br>na cidade</span>
      </section>

      <!-- Busca -->
      <div v-if="catalog.openRestaurants.length > 0" class="search">
        <i class="fas fa-search search__icon" aria-hidden="true"></i>
        <input
          v-model="query"
          type="search"
          class="search__input"
          placeholder="Buscar loja ou categoria"
          aria-label="Buscar loja ou categoria"
        />
        <button
          v-if="query"
          type="button"
          class="search__clear"
          aria-label="Limpar busca"
          @click="query = ''"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Filtro por categoria -->
      <div v-if="categories.length > 1" class="chips" role="group" aria-label="Filtrar por categoria">
        <button
          type="button"
          class="chip"
          :class="{ 'chip--active': !activeCat }"
          :aria-pressed="!activeCat"
          @click="activeCategory = null"
        >
          Todas
        </button>
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          class="chip"
          :class="{ 'chip--active': activeCat === c }"
          :aria-pressed="activeCat === c"
          @click="activeCategory = activeCat === c ? null : c"
        >
          <span aria-hidden="true">{{ categoryEmoji(c) }}</span> {{ c }}
        </button>
      </div>

      <!-- Título da seção -->
      <div class="section-head">
        <h2>Lojas em Mococa</h2>
        <span v-if="catalog.openRestaurants.length > 0" class="section-head__count">
          {{ filteredRestaurants.length }}
          {{ filteredRestaurants.length === 1 ? 'aberta' : 'abertas' }}
        </span>
      </div>

      <!-- Estados vazios -->
      <EmptyState
        v-if="catalog.openRestaurants.length === 0"
        icon="fas fa-store-slash"
        message="Nenhuma loja aberta em Mococa agora. Volte daqui a pouco!"
      />
      <EmptyState
        v-else-if="filteredRestaurants.length === 0"
        icon="fas fa-search"
        message="Nenhuma loja encontrada para esse filtro."
      />

      <!-- Lista -->
      <div v-else class="rest-list">
        <article
          v-for="r in filteredRestaurants"
          :key="r.id"
          class="card rest-card"
          role="button"
          tabindex="0"
          :aria-label="`Abrir ${r.name}`"
          @click="selectRestaurant(r)"
          @keydown.enter.prevent="selectRestaurant(r)"
          @keydown.space.prevent="selectRestaurant(r)"
        >
          <div class="rest-img" aria-hidden="true">{{ categoryEmoji(r.category) }}</div>

          <div class="rest-info">
            <h3>{{ r.name }}</h3>
            <p class="rest-meta">
              <span>{{ r.category }}</span>
              <span class="dot" aria-hidden="true">·</span>
              <span>{{ r.minOrderValue > 0 ? `mín. ${formatCurrency(r.minOrderValue)}` : 'sem pedido mínimo' }}</span>
            </p>
            <p class="rest-fee" :class="{ 'rest-fee--free': !r.deliveryFee }">
              <i class="fas fa-motorcycle" aria-hidden="true"></i>
              {{ r.deliveryFee > 0 ? `Taxa: ${formatCurrency(r.deliveryFee)}` : 'Entrega grátis' }}
            </p>
          </div>

          <i class="fas fa-chevron-right rest-chevron" aria-hidden="true"></i>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import EmptyState from '../layout/EmptyState.vue'
import OrderTracker from './OrderTracker.vue'
import { useAuthStore } from '../../stores/auth'
import { useCatalogStore } from '../../stores/catalog'
import { useCartStore } from '../../stores/cart'
import { useOrdersStore } from '../../stores/orders'
import { useNavigationStore } from '../../stores/navigation'
import { formatCurrency } from '../../utils/formatters'

const auth = useAuthStore()
const catalog = useCatalogStore()
const cart = useCartStore()
const orders = useOrdersStore()
const nav = useNavigationStore()

const query = ref('')
const activeCategory = ref(null)

const firstName = computed(
  () => (auth.currentUser?.name || '').trim().split(/\s+/)[0] || 'cliente'
)

const greeting = computed(() => {
  const h = new Date().getHours()
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${saudacao}! O que vamos pedir?`
})

const normalize = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const categories = computed(() => {
  const set = new Set(catalog.openRestaurants.map((r) => r.category).filter(Boolean))
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
})

// Se a categoria selecionada deixar de existir (ex.: loja fechou), volta para "Todas"
const activeCat = computed(() =>
  categories.value.includes(activeCategory.value) ? activeCategory.value : null
)

const filteredRestaurants = computed(() => {
  const q = normalize(query.value)
  return catalog.openRestaurants.filter((r) => {
    const matchesCategory = !activeCat.value || r.category === activeCat.value
    const matchesQuery =
      !q || normalize(r.name).includes(q) || normalize(r.category).includes(q)
    return matchesCategory && matchesQuery
  })
})

const EMOJIS = [
  [/pizza/, '🍕'],
  [/hamburg|lanche|burger/, '🍔'],
  [/acai|sorvete|gelato/, '🍧'],
  [/japon|sushi|oriental/, '🍣'],
  [/doce|sobremesa|bolo|confeit/, '🍰'],
  [/bebida|suco|drink|cerveja/, '🥤'],
  [/padaria|pao|cafe/, '🥖'],
  [/marmit|brasileir|caseir|almoco|prato/, '🍛'],
  [/churrasc|carne|espet/, '🥩'],
  [/salad|saudav|fit|vegan/, '🥗'],
  [/pastel|salgad/, '🥟'],
]

function categoryEmoji(category) {
  const c = normalize(category)
  const found = EMOJIS.find(([re]) => re.test(c))
  return found ? found[1] : '🍽️'
}

function selectRestaurant(restaurant) {
  cart.selectRestaurant(restaurant.id)
  nav.navigateTo('cliente-restaurant')
}
</script>

<style scoped>
.home {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.food-feature {
  position: relative;
  min-height: 230px;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding: clamp(24px, 5vw, 44px);
  border-radius: 8px;
  isolation: isolate;
  background: #344d41;
  color: #fffaf0;
}
.food-feature::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(28, 48, 37, 0.98) 0%, rgba(35, 54, 41, 0.88) 40%, rgba(35, 54, 41, 0.08) 100%),
    url("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1400&q=85") center 48% / cover;
}
.food-feature__copy {
  max-width: 470px;
}
.feature-eyebrow,
.auth-eyebrow {
  display: block;
  color: #e5b477;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.food-feature h2 {
  margin: 11px 0 8px;
  color: inherit;
  font-family: "DM Serif Display", Georgia, serif;
  font-size: clamp(2rem, 5vw, 3.15rem);
  font-weight: 400;
  line-height: 1.04;
}
.food-feature p {
  margin: 0;
  color: rgba(255, 250, 240, 0.78);
  font-size: 0.92rem;
}
.food-feature__stamp {
  position: absolute;
  right: 24px;
  bottom: 20px;
  display: grid;
  place-items: center;
  width: 70px;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 250, 240, 0.6);
  border-radius: 50%;
  color: #fffaf0;
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 0.8rem;
  line-height: 1.1;
  text-align: center;
  transform: rotate(9deg);
}

/* Busca */
.search {
  position: relative;
  display: flex;
  align-items: center;
}
.search__icon {
  position: absolute;
  left: 14px;
  color: var(--text-light, #888);
  pointer-events: none;
}
.search__input {
  width: 100%;
  padding: 12px 40px 12px 40px;
  font-size: 0.95rem;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 12px;
  background: var(--card-bg, #fff);
  color: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  -webkit-appearance: none;
  appearance: none;
}
.search__input:focus {
  border-color: var(--primary, #ea1d2c);
  box-shadow: 0 0 0 3px rgba(234, 29, 44, 0.12);
}
.search__clear {
  position: absolute;
  right: 6px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-light, #888);
  border-radius: 50%;
  cursor: pointer;
}

/* Chips de categoria */
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  margin: 0 -16px;
  padding-left: 16px;
  padding-right: 16px;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chip {
  flex: 0 0 auto;
  padding: 8px 14px;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 999px;
  background: var(--card-bg, #fff);
  color: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chip--active {
  background: var(--primary, #ea1d2c);
  border-color: var(--primary, #ea1d2c);
  color: #fff;
}

/* Título da seção */
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 4px;
}
.section-head h2 {
  font-size: 1.2rem;
  margin: 0;
}
.section-head__count {
  font-size: 0.8rem;
  color: var(--text-light, #888);
}

/* Lista */
.rest-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rest-card {
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}
.rest-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.rest-card:active {
  transform: scale(0.985);
}
.rest-card:focus-visible {
  outline: 2px solid var(--primary, #ea1d2c);
  outline-offset: 2px;
}

.rest-img {
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  font-size: 1.8rem;
  border-radius: 14px;
  background: var(--bg-soft, #f6f6f6);
}

.rest-info {
  flex: 1;
  min-width: 0;
}
.rest-info h3 {
  margin: 0 0 2px;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rest-meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-light, #888);
}
.rest-meta .dot {
  margin: 0 2px;
}
.rest-fee {
  margin: 4px 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-light, #888);
}
.rest-fee i {
  margin-right: 4px;
}
.rest-fee--free {
  color: var(--success, #1a9e4a);
}

.rest-chevron {
  color: var(--text-light, #888);
  align-self: center;
}

@media (prefers-reduced-motion: reduce) {
  .rest-card,
  .chip,
  .search__input {
    transition: none;
  }
}

@media (max-width: 599px) {
  .food-feature {
    min-height: 204px;
    margin: 0 -16px;
    border-radius: 0;
  }
  .food-feature::before {
    background:
      linear-gradient(90deg, rgba(28, 48, 37, 0.96), rgba(35, 54, 41, 0.56)),
      url("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80") center / cover;
  }
  .food-feature__stamp {
    right: 16px;
    bottom: 14px;
    width: 58px;
    font-size: 0.7rem;
  }
}
</style>