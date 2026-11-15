# Mococa Food API

API para um app de pedidos de comida, construída com **Node.js**, **Fastify**, **MongoDB/Mongoose** e **Redis** (cache, geolocalização, filas de oferta de corrida e tempo real).

## Stack e por quê

| Peça | Uso |
|---|---|
| **Node.js** | Runtime JavaScript e execução da API e dos scripts. |
| **Fastify** | Servidor HTTP, rotas, plugins (`@fastify/jwt`, `@fastify/cors`). |
| **MongoDB (Mongoose)** | Persistência: usuários, restaurantes, produtos, pedidos. |
| **Redis (ioredis)** | 4 usos concretos: <br>1. **Cache** de listagem/detalhe de restaurante e cardápio (cache-aside). <br>2. **GEO** (`GEOADD`/`GEOSEARCH`) para localização ao vivo dos entregadores e matching por proximidade. <br>3. **Lock distribuído** (`SET NX EX`) para impedir que dois entregadores aceitem a mesma corrida. <br>4. **Pub/Sub** para notificar o cliente em tempo real (SSE) sobre o status do pedido. |

## Como rodar

```bash
cp .env.example .env
# ajuste MONGO_URI e REDIS_URL se necessário

npm install
npm run seed     # popula dados de teste (dono, cliente, entregador, restaurante)
npm run dev      # inicia em http://localhost:3000
```

Requer um MongoDB e um Redis rodando (local ou containers):

```bash
docker run -d -p 27017:27017 --name mongo mongo:7
docker run -d -p 6379:6379 --name redis redis:7
```

## Autenticação

Todas as rotas privadas usam **JWT** via header:
```
Authorization: Bearer <token>
```

Papéis de usuário (`role`): `customer`, `restaurant_owner`, `courier`. Administradores pertencem à collection `admins`, autenticam-se separadamente e não podem ser criados pelo cadastro público.

## Área administrativa

Crie o primeiro admin por ambiente seguro, sem endpoint público de cadastro:

```bash
export ADMIN_NAME="Admin Mococa"
export ADMIN_EMAIL="admin@seudominio.com"
read -rsp "Senha administrativa: " ADMIN_PASSWORD; echo
export ADMIN_PASSWORD
npm run admin:create
unset ADMIN_PASSWORD
```

O token de `POST /api/admin/auth/login` identifica e revalida um documento da collection `admins` em cada requisição; `POST /api/admin/auth/logout` revoga as sessões anteriores desse admin. Após a atualização da autenticação, usuários comuns devem entrar novamente para receber um token com o novo tipo de principal. As ações ficam em `/api/admin/audit-logs`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/dashboard` | Resumo operacional e pedidos recentes |
| GET/PATCH | `/api/admin/users`, `/api/admin/users/:id/status` | Consulta e ativa/desativa contas comuns |
| GET/PATCH | `/api/admin/restaurants`, `/api/admin/restaurants/:id/status` | Consulta, aprova e ativa/desativa lojas |
| GET/POST/PATCH/DELETE | `/api/admin/coupons` | Emite, altera e cancela cupons |
| GET/POST/PATCH/DELETE | `/api/admin/service-areas` | Administra cidades e polígonos GeoJSON |
| GET/POST | `/api/admin/payouts`, `/api/admin/payouts/:id/decision` | Consulta e aprova/recusa saques pendentes |
| POST | `/api/admin/payouts/:id/paid` | Registra transferência externa com referência |
| GET | `/api/admin/finance/summary` | Soma pagamentos Pix confirmados, sem comissão de 1%, separando mercadorias e entregas |
| GET | `/api/admin/finance/payments` | Lista pagamentos confirmados com paginação e intervalo de datas |

Mococa é inicializada como cidade ativa sem polígono; configure polígonos para restringir bairros. `GET /api/restaurants/map?city=Mococa&bbox=-47.1,-21.6,-46.9,-21.3` fornece pins para o mapa; o token público do Mapbox deve ficar na configuração do frontend. O faturamento conta somente pagamentos Pix confirmados na conta central; dinheiro e cartão não estão integrados. Saques aprovados permanecem reservados até que um admin registre o pagamento e sua referência. A API não transfere dinheiro por conta própria.

## Mapa de endpoints (por funcionalidade pedida)

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastro (name, email, password, role, phone, address) |
| POST | `/api/auth/login` | Login → retorna JWT |
| GET | `/api/auth/me` | Perfil do usuário logado |

### 1. Cadastrar restaurante
| POST | `/api/restaurants` | Cria restaurante (role: `restaurant_owner`) |

### 2. Gerenciar restaurante
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/restaurants` | Lista pública (cache 60s), filtros `?city=&category=` |
| GET | `/api/restaurants/map` | Pins de lojas aprovadas e ativas, opcionalmente filtrados por `city` e `bbox` |
| GET | `/api/service-areas` | Cidades e polígonos ativos |
| GET | `/api/restaurants/:id` | Detalhe + cardápio (cache) |
| PATCH | `/api/restaurants/:id` | Edita dados do restaurante |
| PATCH | `/api/restaurants/:id/toggle-open` | Abre/fecha a loja |
| GET | `/api/restaurants/mine/all` | Restaurantes do dono logado |
| POST | `/api/restaurants/:id/products` | Adiciona item ao cardápio |
| PATCH | `/api/restaurants/:id/products/:productId` | Edita item (preço, disponibilidade...) |
| DELETE | `/api/restaurants/:id/products/:productId` | Remove item |
| GET | `/api/restaurants/:id/orders` | Pedidos recebidos pelo restaurante |
| PATCH | `/api/orders/:id/status` | Avança status: `confirmed → preparing → ready_for_pickup` (dispara matching de entregador automaticamente) |
| GET | `/api/restaurants/:id/dashboard` | Métricas do dia + pedidos ativos |

### 3. Fazer pedidos como cliente
| POST | `/api/orders` | Cria pedido `{ restaurantId, items:[{productId,quantity,notes}], deliveryAddress, paymentMethod, couponCode? }` |

### 4. Gerenciar pedidos como cliente
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/orders/mine` | Lista pedidos do cliente (`?status=`) |
| GET | `/api/orders/:id` | Detalhe do pedido |
| POST | `/api/orders/:id/cancel` | Cancela (se ainda permitido pela máquina de estados) |

### 5. Esperar entrega a ser feita
| GET | `/api/orders/:id/stream` | **SSE** — stream em tempo real do status do pedido (via Redis Pub/Sub) até `delivered`/`cancelled` |

### 6. Lado do entregador — aceitar ou recusar corridas
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/deliveries/location` | Atualiza posição ao vivo `{lat,lng}` (Redis GEOADD) |
| POST | `/api/deliveries/availability` | Liga/desliga disponibilidade `{isAvailable}` |
| GET | `/api/deliveries/offers` | Corridas oferecidas a este entregador |
| POST | `/api/deliveries/:orderId/accept` | Aceita a corrida (lock distribuído evita duplicidade) |
| POST | `/api/deliveries/:orderId/reject` | Recusa a oferta |
| POST | `/api/deliveries/:orderId/complete` | Marca entrega como concluída |

### 7. Ver lista de corridas
| GET | `/api/deliveries/mine/active` | Corridas em andamento |
| GET | `/api/deliveries/mine/history` | Histórico de entregas |

### 8. Dashboard do entregador
| GET | `/api/deliveries/dashboard` | Saldo, avaliação, entregas hoje, ganhos hoje, ativas e histórico recente |
| POST | `/api/deliveries/payouts` | Solicita saque e reserva saldo disponível |
| GET | `/api/deliveries/payouts/mine` | Consulta saques e saldo reservado/disponível |

## Fluxo de status do pedido

```
pending → confirmed → preparing → ready_for_pickup → awaiting_courier → in_delivery → delivered
                                                                  ↘ cancelled (em vários pontos antes de in_delivery)
```

Quando o restaurante marca `ready_for_pickup`, o sistema automaticamente:
1. Muda o pedido para `awaiting_courier`.
2. Busca entregadores disponíveis num raio configurável (`DELIVERY_SEARCH_RADIUS_KM`) usando `GEOSEARCH` do Redis.
3. Empilha a oferta na fila pessoal de cada entregador próximo (`courier:{id}:offers`), com TTL.
4. O primeiro entregador que chamar `/accept` fecha a corrida (lock `SET NX` evita corrida dupla); os demais recebem `409 Conflict` se tentarem depois.

## Estrutura de pastas

```
src/
  config/     # env, mongo, redis
  models/     # User, Admin, Restaurant, Product, Order, Coupon, ServiceArea, PixTransaction, PaymentLedger
  plugins/    # autenticação e autorização separadas para usuário/admin
  routes/     # auth, admin, service-area, restaurant, order, delivery, dashboard, pix
  services/   # regras de negócio (order, delivery, notification, pix)
  utils/      # erros, cache, geo, seed
  modules/    # documentação de módulos (PIX_README.md)
  server.js
```

## Testando rapidamente

```bash
# Login como cliente
curl -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"cliente@mococafood.com","password":"123456"}'

# Fazer pedido (troque <TOKEN> e <RESTAURANT_ID>/<PRODUCT_ID> pelos IDs reais do seed)
curl -X POST localhost:3000/api/orders -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"restaurantId":"<RESTAURANT_ID>","items":[{"productId":"<PRODUCT_ID>","quantity":2}],"deliveryAddress":{"street":"Rua A","lat":-21.47,"lng":-47.01}}'
```

## Próximos passos sugeridos

### ✅ Implementado: Módulo de Pagamento Pix

O módulo de pagamento Pix foi implementado com sucesso! Consulte a documentação completa em [`src/modules/PIX_README.md`](src/modules/PIX_README.md).

**Resumo das funcionalidades:**
- Geração automática de QR Code Pix (BR Code) com CRC16
- Webhook para confirmação automática de pagamentos
- Integração completa com o fluxo de pedidos
- Cancelamento e expiração automáticos de transações
- Dashboard de transações para restaurantes

**Novos endpoints adicionados:**
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/orders/:orderId/pix` | Cria transação Pix para um pedido |
| GET | `/api/pix/:transactionId` | Obtém detalhes da transação |
| GET | `/api/orders/:orderId/pix` | Obtém transação por pedido |
| DELETE | `/api/pix/:transactionId` | Cancela transação pendente |
| GET | `/api/pix/transactions` | Lista transações (admin/restaurante) |
| POST | `/api/pix/webhook` | Recebe confirmações de pagamento |

**Configuração necessária:**
```bash
# .env
PIX_ENABLED=true
PIX_EXPIRATION_MINUTES=30
PIX_WEBHOOK_SECRET=seu-segredo-aqui

# Configure as chaves Pix de cada restaurante no modelo Restaurant:
{
  pixKey: "cnpj@restaurante.com.br",
  pixKeyType: "email",
  pixBank: "001"
}
```

### Pendentes
- Push notifications (FCM) além do SSE para quando o app estiver em background.
- Testes automatizados (bun:test) para os serviços de pedido e entrega.
- Rate limiting global (`@fastify/rate-limit`) e validação de schema com JSON Schema/Zod nas rotas.
