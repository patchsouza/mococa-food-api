<template>
  <div class="view">
    <template v-if="restaurant">
      <AppHeader
        :title="restaurant.name"
        :subtitle="restaurant.description"
        :show-back="nav.canGoBack"
        @back="nav.goBack()"
      />

      <!-- Informações da loja -->
      <div class="info-bar">
        <span class="info-bar__item" :class="{ 'info-bar__item--free': !restaurant.deliveryFee }">
          <i class="fas fa-motorcycle" aria-hidden="true"></i>
          {{ restaurant.deliveryFee > 0 ? `Entrega ${formatCurrency(restaurant.deliveryFee)}` : 'Entrega grátis' }}
        </span>
        <span class="info-bar__item">
          <i class="fas fa-receipt" aria-hidden="true"></i>
          {{ minOrder > 0 ? `Pedido mín. ${formatCurrency(minOrder)}` : 'Sem pedido mínimo' }}
        </span>
      </div>

      <!-- Navegação fixa por categoria -->
      <nav
        v-if="sections.length > 1"
        ref="tabsEl"
        class="cat-tabs"
        aria-label="Categorias do cardápio"
      >
        <button
          v-for="s in sections"
          :key="s.cat"
          type="button"
          class="cat-tab"
          :class="{ 'cat-tab--active': activeCat === s.cat }"
          :data-cat="s.cat"
          :aria-current="activeCat === s.cat ? 'true' : undefined"
          @click="scrollToCategory(s.cat)"
        >
          {{ s.cat }}
        </button>
      </nav>

      <EmptyState
        v-if="sections.length === 0"
        icon="fas fa-utensils"
        message="Esta loja ainda não cadastrou itens no cardápio."
      />

      <!-- Cardápio -->
      <section
        v-for="s in sections"
        :key="s.cat"
        :ref="(el) => setSectionEl(s.cat, el)"
        class="menu-section"
      >
        <div class="menu-cat" role="heading" aria-level="2">{{ s.cat }}</div>

        <div class="card menu-card">
          <div
            v-for="p in s.items"
            :key="p.id"
            class="menu-item"
            :class="{ 'menu-item--in-cart': qtyInCart(p) > 0 }"
          >
            <div class="item-info">
              <h4>{{ p.name }}</h4>
              <p v-if="p.description" class="item-desc">{{ p.description }}</p>
              <span class="item-price">{{ formatCurrency(p.price) }}</span>
            </div>

            <div class="item-action">
              <button
                type="button"
                class="btn btn-sm btn-primary"
                :aria-label="`Adicionar ${p.name} à sacola`"
                @click="cart.addItem(p)"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
              <span
                v-if="qtyInCart(p) > 0"
                :key="qtyInCart(p)"
                class="item-qty"
                :aria-label="`${qtyInCart(p)} na sacola`"
              >
                {{ qtyInCart(p) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Espaço para o botão da sacola não cobrir o último item -->
      <div v-if="cart.items.length > 0" class="fab-spacer"></div>

      <!-- Botão da sacola -->
      <div
        v-if="cart.items.length > 0"
        class="fab"
        role="button"
        tabindex="0"
        aria-label="Ver sacola"
        @click="nav.navigateTo('cliente-cart')"
        @keydown.enter.prevent="nav.navigateTo('cliente-cart')"
        @keydown.space.prevent="nav.navigateTo('cliente-cart')"
      >
        <div class="fab__left">
          <span class="fab__qty">{{ cart.qty }}</span>
          <span class="fab__text">
            <span class="fab__label">Ver sacola</span>
            <span v-if="remainingToMin > 0" class="fab__hint">
              Faltam {{ formatCurrency(remainingToMin) }} para o mínimo
            </span>
          </span>
        </div>
        <span class="fab__total">{{ formatCurrency(cart.total) }}</span>
      </div>
    </template>

    <!-- Nenhuma loja selecionada (ex.: recarregou a página) -->
    <template v-else>
      <AppHeader title="Cardápio" :show-back="nav.canGoBack" @back="nav.goBack()" />
      <EmptyState icon="fas fa-store-slash" message="Nenhuma loja selecionada." />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import EmptyState from '../layout/EmptyState.vue'
import { useCatalogStore } from '../../stores/catalog'
import { useCartStore } from '../../stores/cart'
import { useNavigationStore } from '../../stores/navigation'
import { formatCurrency } from '../../utils/formatters'

const catalog = useCatalogStore()
const cart = useCartStore()
const nav = useNavigationStore()

const restaurant = computed(() => cart.selectedRestaurant)

// Categorias já com seus itens (categorias vazias não aparecem)
const sections = computed(() => {
  if (!restaurant.value) return []
  const id = restaurant.value.id
  return catalog
    .menuCategoriesFor(id)
    .map((cat) => ({ cat, items: catalog.getMenuByCategory(id, cat) }))
    .filter((s) => s.items.length > 0)
})

/* ---------- Sacola ---------- */

const minOrder = computed(() => restaurant.value?.minOrderValue ?? 0)
const remainingToMin = computed(() => Math.max(0, minOrder.value - cart.subtotal))

// Quantidade de cada produto já na sacola (ajuste aqui se o formato de cart.items for outro)
const qtyByProduct = computed(() => {
  const map = new Map()
  for (const i of cart.items) {
    const id = i.productId ?? i.product?.id ?? i.id
    map.set(id, (map.get(id) ?? 0) + (i.qty ?? i.quantity ?? 1))
  }
  return map
})
const qtyInCart = (p) => qtyByProduct.value.get(p.id) ?? 0

/* ---------- Navegação por categoria ---------- */

const SCROLL_OFFSET = 140 // distância do topo em que a categoria passa a contar como "atual"

const tabsEl = ref(null)
const activeCat = ref(null)
const sectionEls = new Map()

function setSectionEl(cat, el) {
  if (el) sectionEls.set(cat, el)
  else sectionEls.delete(cat)
}

function scrollToCategory(cat) {
  activeCat.value = cat
  sectionEls.get(cat)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function updateActiveCategory() {
  let current = sections.value[0]?.cat ?? null
  for (const s of sections.value) {
    const el = sectionEls.get(s.cat)
    if (el && el.getBoundingClientRect().top <= SCROLL_OFFSET) current = s.cat
  }
  activeCat.value = current
}

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    updateActiveCategory()
  })
}

// Mantém a aba ativa visível na barra horizontal
watch(activeCat, (cat) => {
  const bar = tabsEl.value
  if (!bar || !cat) return
  const btn = [...bar.querySelectorAll('.cat-tab')].find((b) => b.dataset.cat === cat)
  if (!btn) return
  bar.scrollTo({
    left: btn.offsetLeft - bar.clientWidth / 2 + btn.clientWidth / 2,
    behavior: 'smooth',
  })
})

watch(sections, () => nextTick(updateActiveCategory), { immediate: true })

onMounted(() => {
  // capture = true: funciona mesmo se quem rola for um container e não a janela
  document.addEventListener('scroll', onScroll, true)
  updateActiveCategory()
})
onBeforeUnmount(() => document.removeEventListener('scroll', onScroll, true))
</script>

<style scoped>
/* Informações da loja */
.info-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 12px 16px;
  background: var(--card-bg, #fff);
  border-bottom: 1px solid var(--border, #e5e5e5);
  font-size: 0.85rem;
  color: var(--text-light, #888);
}
.info-bar__item i {
  margin-right: 4px;
}
.info-bar__item--free {
  color: var(--success, #1a9e4a);
  font-weight: 600;
}

/* Abas de categoria (fixas no topo ao rolar) */
.cat-tabs {
  position: sticky;
  top: var(--sticky-top, 0px); /* se o AppHeader for fixo, defina --sticky-top com a altura dele */
  z-index: 5;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 16px;
  background: var(--card-bg, #fff);
  border-bottom: 1px solid var(--border, #e5e5e5);
  scrollbar-width: none;
}
.cat-tabs::-webkit-scrollbar {
  display: none;
}
.cat-tab {
  flex: 0 0 auto;
  padding: 7px 14px;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.cat-tab--active {
  background: var(--primary, #ea1d2c);
  border-color: var(--primary, #ea1d2c);
  color: #fff;
}

/* Seções do cardápio */
.menu-section {
  scroll-margin-top: 64px; /* compensa as abas fixas ao clicar numa categoria */
}
.menu-card {
  margin-top: 0;
}

.menu-item {
  gap: 12px;
}
.item-info {
  min-width: 0;
}
.item-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-price {
  color: var(--primary, #ea1d2c);
  font-weight: 700;
}

/* Botão de adicionar + contador */
.item-action {
  position: relative;
  flex: 0 0 auto;
}
.item-qty {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  color: var(--primary, #ea1d2c);
  background: #fff;
  border: 1.5px solid var(--primary, #ea1d2c);
  border-radius: 999px;
  pointer-events: none;
  animation: pop 0.2s ease-out;
}
@keyframes pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* Botão da sacola */
.fab-spacer {
  height: 88px;
}
.fab {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fab:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -4px;
}
.fab__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.fab__qty {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: var(--primary, #ea1d2c);
  font-size: 0.8rem;
  font-weight: 700;
}
.fab__text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.fab__label {
  font-weight: 600;
}
.fab__hint {
  font-size: 0.72rem;
  opacity: 0.9;
}
.fab__total {
  font-weight: 700;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .item-qty {
    animation: none;
  }
  .cat-tab {
    transition: none;
  }
}
</style>