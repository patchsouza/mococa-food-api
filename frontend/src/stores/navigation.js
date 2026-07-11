import { defineStore } from 'pinia'

export const useNavigationStore = defineStore('navigation', {
  state: () => ({
    history: ['login']
  }),

  getters: {
    view: (state) => state.history[state.history.length - 1],
    canGoBack: (state) => state.history.length > 1
  },

  actions: {
    navigateTo(newView) {
      if (this.view !== newView) this.history.push(newView)
    },

    goBack() {
      if (this.canGoBack) this.history.pop()
    },

    /** Replaces the whole stack — used after login/logout/checkout, so "back" can't return to a stale screen. */
    reset(targetView) {
      this.history = [targetView]
    }
  }
})
