
<template>
  <header class="app-header">
    <div class="header-main">

      <!-- Botão voltar -->
      <button
        v-if="showBack"
        type="button"
        class="header-icon-btn back-btn"
        aria-label="Voltar"
        @click="$emit('back')"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M19 12H5M12 19l-7-7 7-7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <!-- Título e subtítulo -->
      <div class="header-content">
        <h1 class="header-title">{{ title }}</h1>

        <p v-if="subtitle" class="header-subtitle">
          {{ subtitle }}
        </p>
      </div>

      <!-- Ações personalizadas -->
      <div class="header-actions">
        <slot name="actions" />

        <!-- Botão sair -->
        <button
          v-if="showLogout"
          type="button"
          class="logout-btn"
          title="Sair da conta"
          aria-label="Sair da conta"
          @click="$emit('logout')"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M10 17l5-5-5-5M15 12H3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <span>Sair</span>
        </button>
      </div>

    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  showBack: {
    type: Boolean,
    default: false
  },
  showLogout: {
    type: Boolean,
    default: false
  }
})

defineEmits(['back', 'logout'])
</script>

<style scoped>
.app-header {
  width: 100%;
  background: rgba(246, 242, 233, 0.94);
  border-bottom: 1px solid #e8e2d6;
  padding: 19px clamp(18px, 4vw, 42px);
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(14px);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 48px;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.header-title {
  margin: 0;
  color: #242922;
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 1.55rem;
  font-weight: 400;
  line-height: 1.3;
}

.header-subtitle {
  margin: 5px 0 0;
  color: #777D72;
  font-size: 0.875rem;
  line-height: 1.5;
}

.header-icon-btn {
  width: 42px;
  height: 42px;
  min-width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ded7c9;
  border-radius: 6px;
  background: #fbf8f1;
  color: #344D41;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-icon-btn svg,
.logout-btn svg {
  width: 19px;
  height: 19px;
}

.header-icon-btn:hover {
  background: #e8f0ec;
  border-color: #b7c9bb;
  color: #344D41;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logout-btn {
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 16px;
  border: 1px solid #efd0c6;
  border-radius: 6px;
  background: #fcebe5;
  color: #b93626;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background: #f7ded5;
  border-color: #e8b9aa;
}

.header-icon-btn:focus-visible,
.logout-btn:focus-visible {
  outline: 3px solid #abc2ad;
  outline-offset: 3px;
}

/* Tablets */
@media (max-width: 768px) {
  .app-header {
    padding: 17px 20px;
  }

  .header-title {
    font-size: 1.25rem;
  }
}

/* Smartphones */
@media (max-width: 480px) {
  .app-header {
    padding: 15px 16px;
  }

  .header-main {
    gap: 11px;
  }

  .header-title {
    font-size: 1.1rem;
  }

  .header-subtitle {
    font-size: 0.78rem;
  }

  .header-icon-btn {
    width: 38px;
    height: 38px;
    min-width: 38px;
  }

  .logout-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    gap: 0;
  }

  .logout-btn span {
    display: none;
  }
}
</style>
