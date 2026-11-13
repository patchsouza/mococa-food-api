
<template>
  <div class="menu-manager">

    <!-- Cadastro de produtos -->
    <section class="menu-form-card">

      <div class="form-heading">
        <div class="heading-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </div>

        <div>
          <h3>Adicionar produto</h3>
          <p>Cadastre um novo item no cardápio da sua loja.</p>
        </div>
      </div>

      <form class="product-form" @submit.prevent="submit">

        <div class="form-fields">

          <!-- Nome -->
          <div class="field-group name-field">
            <label for="product-name">Nome do produto</label>
            <input
              id="product-name"
              v-model.trim="newItem.name"
              type="text"
              placeholder="Ex: Pizza de mussarela"
              maxlength="100"
              required
            />
          </div>

          <!-- Categoria -->
          <div class="field-group category-field">
            <label for="product-category">Categoria</label>
            <input
              id="product-category"
              v-model.trim="newItem.category"
              type="text"
              placeholder="Ex: Pizzas, Massas..."
              maxlength="60"
            />
          </div>

          <!-- Preço -->
          <div class="field-group price-field">
            <label for="product-price">Preço de venda</label>

            <div class="price-input">
              <span>R$</span>
              <input
                id="product-price"
                v-model.number="newItem.price"
                type="number"
                inputmode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                required
              />
            </div>
          </div>

        </div>

        <div class="form-footer">
          <p class="form-hint">
            <svg viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <path
                d="M12 11v5M12 8h.01"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            Preencha o nome e o preço para cadastrar.
          </p>

          <button type="submit" class="save-btn">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            Salvar produto
          </button>
        </div>

      </form>
    </section>

    <!-- Lista de produtos -->
    <section class="menu-list-section">

      <div class="list-heading">
        <div>
          <h3>Seu cardápio</h3>
          <p>Gerencie os produtos disponíveis na sua loja.</p>
        </div>

        <div class="product-counter">
          <strong>{{ catalog.myMenu.length }}</strong>
          <span>
            {{ catalog.myMenu.length === 1 ? 'produto' : 'produtos' }}
          </span>
        </div>
      </div>

      <!-- Estado vazio -->
      <div v-if="catalog.myMenu.length === 0" class="empty-container">
        <EmptyState message="Nenhum item cadastrado ainda." />
      </div>

      <!-- Produtos cadastrados -->
      <div v-else class="product-list">

        <article
          v-for="p in catalog.myMenu"
          :key="p.id"
          class="product-card"
        >

          <div class="product-information">
            <div class="product-symbol">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16l-1.5 13h-13L4 7Z"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <path
                  d="M9 7a3 3 0 0 1 6 0"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
              </svg>
            </div>

            <div class="product-details">
              <h4>{{ p.name }}</h4>

              <span class="product-category">
                {{ p.category || 'Sem categoria' }}
              </span>
            </div>
          </div>

          <div class="product-actions">
            <strong class="product-price">
              {{ formatCurrency(p.price) }}
            </strong>

            <button
              type="button"
              class="delete-btn"
              :aria-label="`Excluir ${p.name}`"
              title="Excluir produto"
              @click="catalog.removeMenuItem(p.id)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

        </article>

      </div>
    </section>

  </div>
</template>

<script setup>
import { reactive } from 'vue'

import EmptyState from '../layout/EmptyState.vue'
import { useCatalogStore } from '../../stores/catalog'
import { formatCurrency } from '../../utils/formatters'

const catalog = useCatalogStore()

const newItem = reactive({
  name: '',
  category: '',
  price: 0
})

function submit() {
  const name = newItem.name.trim()
  const category = newItem.category.trim()
  const price = Number(newItem.price)

  if (!name || !Number.isFinite(price) || price <= 0) {
    return
  }

  catalog.addMenuItem({
    name,
    category,
    price
  })

  // Limpa o formulário após o cadastro
  newItem.name = ''
  newItem.category = ''
  newItem.price = 0
}
</script>

<style scoped>
.menu-manager {
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
  min-width: 0;
}

/* Formulário */
.menu-form-card {
  background: #ffffff;
  border: 1px solid #e9edf3;
  border-radius: 15px;
  padding: 23px;
  box-shadow: 0 3px 12px rgba(25, 42, 70, 0.025);
}

.form-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 23px;
}

.heading-icon {
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #edf4ff;
  color: #3978e8;
  border-radius: 12px;
}

.heading-icon svg {
  width: 22px;
  height: 22px;
}

.form-heading h3,
.list-heading h3 {
  margin: 0;
  color: #172033;
  font-size: 1rem;
  font-weight: 700;
}

.form-heading p,
.list-heading p {
  margin: 5px 0 0;
  color: #8993a5;
  font-size: 0.82rem;
}

/* Campos */
.form-fields {
  display: grid;
  grid-template-columns: 1.5fr 1fr 0.7fr;
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.field-group label {
  color: #475569;
  font-size: 0.82rem;
  font-weight: 650;
}

.field-group input {
  width: 100%;
  height: 45px;
  box-sizing: border-box;
  padding: 0 13px;
  background: #f9fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  outline: none;
  color: #172033;
  font-family: inherit;
  font-size: 0.88rem;
  transition: all 0.2s ease;
}

.field-group input::placeholder {
  color: #a5adba;
}

.field-group input:focus {
  background: #ffffff;
  border-color: #6b9ce9;
  box-shadow: 0 0 0 3px rgba(57, 120, 232, 0.09);
}

.price-input {
  height: 45px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 12px;
  background: #f9fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  transition: all 0.2s ease;
}

.price-input:focus-within {
  background: #ffffff;
  border-color: #6b9ce9;
  box-shadow: 0 0 0 3px rgba(57, 120, 232, 0.09);
}

.price-input > span {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 600;
}

.price-input input {
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: 0.9rem;
  font-weight: 650;
}

.price-input input:focus {
  outline: none;
  box-shadow: none;
}

/* Rodapé do formulário */
.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #f0f2f6;
}

.form-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #94a0b1;
  font-size: 0.76rem;
}

.form-hint svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.save-btn {
  min-height: 43px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 19px;
  border: none;
  border-radius: 9px;
  background: #3478e5;
  color: #ffffff;
  font-size: 0.84rem;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.save-btn svg {
  width: 17px;
  height: 17px;
}

.save-btn:hover {
  background: #2563c7;
  transform: translateY(-1px);
}

.save-btn:active {
  transform: translateY(0);
}

/* Lista de produtos */
.menu-list-section {
  min-width: 0;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 17px;
}

.product-counter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border: 1px solid #e5eaf1;
  border-radius: 9px;
  background: #ffffff;
  color: #7b8798;
  font-size: 0.76rem;
}

.product-counter strong {
  color: #3478e5;
  font-size: 0.84rem;
}

/* Cartão individual */
.product-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.product-card {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 16px 18px;
  background: #ffffff;
  border: 1px solid #e9edf3;
  border-radius: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  border-color: #cfddf2;
  box-shadow: 0 4px 14px rgba(25, 42, 70, 0.04);
}

.product-information {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 13px;
}

.product-symbol {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5fb;
  color: #587ba9;
  border-radius: 11px;
}

.product-symbol svg {
  width: 21px;
  height: 21px;
}

.product-details {
  min-width: 0;
}

.product-details h4 {
  margin: 0;
  color: #253146;
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.product-category {
  display: inline-block;
  margin-top: 6px;
  padding: 3px 8px;
  background: #f1f5f9;
  border-radius: 6px;
  color: #748195;
  font-size: 0.72rem;
}

.product-actions {
  display: flex;
  align-items: center;
  gap: 19px;
  flex-shrink: 0;
}

.product-price {
  color: #16834c;
  font-size: 0.95rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.delete-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #f5dddd;
  border-radius: 9px;
  background: #fff7f7;
  color: #d65b5b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn svg {
  width: 17px;
  height: 17px;
}

.delete-btn:hover {
  background: #fee8e8;
  border-color: #f2c5c5;
}

/* Estado vazio */
.empty-container {
  padding: 10px 0;
}

/* Acessibilidade */
.save-btn:focus-visible,
.delete-btn:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 3px;
}

/* Tablets */
@media (max-width: 768px) {
  .form-fields {
    grid-template-columns: 1fr 1fr;
  }

  .name-field {
    grid-column: 1 / -1;
  }
}

/* Smartphones */
@media (max-width: 540px) {
  .menu-manager {
    gap: 23px;
  }

  .menu-form-card {
    padding: 17px;
    border-radius: 13px;
  }

  .form-heading {
    margin-bottom: 19px;
  }

  .form-fields {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .name-field {
    grid-column: auto;
  }

  .form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .form-hint {
    font-size: 0.73rem;
  }

  .save-btn {
    width: 100%;
    min-height: 46px;
  }

  .product-card {
    padding: 13px;
    gap: 9px;
  }

  .product-information {
    gap: 10px;
  }

  .product-symbol {
    width: 37px;
    height: 37px;
  }

  .product-details h4 {
    font-size: 0.84rem;
  }

  .product-actions {
    gap: 9px;
  }

  .product-price {
    font-size: 0.84rem;
  }

  .delete-btn {
    width: 33px;
    height: 33px;
  }
}
</style>
