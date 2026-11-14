# Mococa Food — Frontend Prototype

Frontend Vue 3 do app de delivery hiperlocal de Mococa, organizado como projeto
Vite modular. Autenticação, catálogo, pedidos, operação de loja, entregas e Pix
consomem a API Fastify.

## Como rodar

```bash
npm install
npm run dev      # ambiente de desenvolvimento, http://localhost:5173
npm run build    # build de produção em dist/
```

## API

Por padrão, o frontend usa `https://perpetual-cooperation-development.up.railway.app`.
Para trocar de instância, defina `VITE_API_URL` como a URL raiz do backend, sem
`/health` ou `/api`. A verificação de saúde usa `/health`; os recursos usam
`/api`.

O catálogo mostra apenas restaurantes cadastrados e aprovados na instância
configurada. Login e cadastro usam contas reais da API; não há acesso de
demonstração com usuários locais.

## O que mudou em relação ao arquivo único

| Antes | Depois |
|---|---|
| 1 arquivo HTML com `<style>`, `<script>` e todos os templates | Projeto Vite com `.vue` (SFC), CSS e JS separados |
| Um único `setup()` de ~250 linhas misturando estado de cliente, loja e moto | 5 stores Pinia, uma por domínio |
| Views alternadas via `v-if` empilhados no mesmo arquivo | Um componente por tela, resolvido dinamicamente em `App.vue` |
| Estado global solto em `ref`/`reactive` dentro do `setup()` | Stores Pinia (fonte única da verdade, testável isoladamente) |
| Helpers (`paymentLabel`, `formatAddress`...) redeclarados no `return` | `src/utils/formatters.js`, funções puras e importáveis |
| Dados mockados inline no `setup()` | Estado remoto carregado pelos stores |
| Chamadas HTTP distribuídas pela interface | `src/utils/api.js` centraliza autenticação e recursos |

## Estrutura de pastas

```
src/
├── main.js                  # bootstrap: cria o app, instala o Pinia
├── App.vue                  # shell do "celular" + troca de tela
├── assets/base.css          # design tokens (--primary, --success…) e classes utilitárias
│                             #   compartilhadas (.card, .btn, .header, .tracker…)
├── data/seed.js              # dados mockados iniciais (restaurantes, cardápio)
├── utils/formatters.js       # funções puras: paymentLabel, statusLabel, formatCurrency…
├── stores/                   # Pinia — um store por domínio de negócio
│   ├── navigation.js         #   pilha de telas (substitui o histórico manual)
│   ├── auth.js                #   usuário logado, login/registro/logout
│   ├── catalog.js             #   restaurantes + cardápios
│   ├── cart.js                 #   sacola do cliente
│   ├── orders.js               #   pedidos — cruza cliente / loja / moto
│   └── courier.js              #   disponibilidade, saldo, corrida ativa do entregador
└── components/
    ├── layout/                # AppHeader, EmptyState — usados em toda tela autenticada
    ├── auth/                  # LoginView, RegisterView
    ├── cliente/                # Home (+ OrderTracker), Restaurant, Cart
    ├── loja/                    # Setup, Dashboard (+ OrdersTab, MenuTab)
    └── moto/                    # Dashboard
```

## Por que Pinia em vez de `ref`/`reactive` soltos

O arquivo original já usava Composition API, mas todo o estado vivia em um
único `setup()` — qualquer view podia ler e mutar o estado de qualquer outra,
sem fronteira. Cada Pinia store expõe só o que faz sentido para aquele domínio
(ex: só `orders.js` sabe criar ou mudar o status de um pedido), e os
`getters` computam dados derivados (`myActiveOrder`, `storeOrders`,
`availableDeliveries`) declarativamente, exatamente como os `computed`
originais — só que reutilizáveis em qualquer componente sem precisar
"repassar props morro abaixo".

## Próximos passos sugeridos

- Trocar a pilha de navegação manual (`stores/navigation.js`) por
  **vue-router** quando fizer sentido ter URLs reais (`/loja/dashboard`,
  deep-link para um restaurante específico, etc.) — hoje ela imita o
  comportamento de navegação de um app nativo por decisão de escopo, não por
  limitação técnica.
- Usar SSE no acompanhamento de pedidos, substituindo a consulta periódica
  atual quando essa atualização em tempo real for necessária.
- Extrair `src/assets/base.css` para tokens compartilhados com o
  MotoMococa, já que os dois produtos miram o mesmo público em Mococa.
