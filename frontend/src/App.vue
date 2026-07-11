<template>
  <div class="app-container">
    <transition name="view" mode="out-in">
      <component :is="currentScreen" :key="nav.view" />
    </transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNavigationStore } from './stores/navigation'

import LoginView from './components/auth/LoginView.vue'
import RegisterView from './components/auth/RegisterView.vue'
import ClienteHomeView from './components/cliente/ClienteHomeView.vue'
import ClienteRestaurantView from './components/cliente/ClienteRestaurantView.vue'
import ClienteCartView from './components/cliente/ClienteCartView.vue'
import LojaSetupView from './components/loja/LojaSetupView.vue'
import LojaDashboardView from './components/loja/LojaDashboardView.vue'
import MotoDashboardView from './components/moto/MotoDashboardView.vue'

const nav = useNavigationStore()

// Maps each named "screen" in the navigation stack to its component.
// Adding a new screen only ever requires an entry here + one file in src/components.
const SCREENS = {
  login: LoginView,
  register: RegisterView,
  'cliente-home': ClienteHomeView,
  'cliente-restaurant': ClienteRestaurantView,
  'cliente-cart': ClienteCartView,
  'loja-setup': LojaSetupView,
  'loja-dashboard': LojaDashboardView,
  'moto-dashboard': MotoDashboardView
}

const currentScreen = computed(() => SCREENS[nav.view])
</script>
