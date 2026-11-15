# Módulo de Pagamento Pix - Mococa Food

## 📋 Visão Geral

Fluxo Pix do Mococa Food: gera cobranças para a conta central e confirma pagamentos por webhook assinado. A integração de transporte com o banco/PSP deve ser configurada fora da API e encaminhar callbacks no formato normalizado descrito abaixo.

## 🏗️ Arquitetura

```
src/
├── models/
│   └── PixTransaction.js       # Modelo de transações Pix
├── services/
│   └── pix.service.js          # Lógica de negócio do Pix
├── routes/
│   └── pix.routes.js           # Rotas da API Pix
└── config/
    └── env.js                  # Variáveis de ambiente do Pix
```

## 🎯 Funcionalidades

### 1. **Geração de QR Code Pix**
- Cria payload BR Code conforme padrão do Banco Central
- Calcula CRC16 automaticamente
- Gera QR Code em base64 para exibição no frontend
- Suporta todos os tipos de chave Pix (CPF, CNPJ, Email, Telefone, Aleatória)

### 2. **Gerenciamento de Transações**
- Status: `pending`, `paid`, `expired`, `cancelled`, `refunded`
- Controle de expiração (configurável, padrão: 30 minutos)
- Reconciliação automática via webhook
- Histórico de cada transação e do identificador E2E retornado pelo provedor

### 3. **Integração com Pedidos**
- Cria transação Pix automaticamente ao escolher pagamento via Pix
- Confirmação automática do pedido quando pagamento é confirmado
- Cancelamento sincronizado entre transação e pedido
- Atualização em tempo real via SSE

### 4. **Webhook de Confirmação**
- Endpoint para receber notificações de pagamento
- Validação de status e idempotência
- Atualização automática do pedido associado
- Logs detalhados para troubleshooting

## 📦 Modelos de Dados

### PixTransaction

```javascript
{
  order: ObjectId,              // Referência ao pedido
  transactionId: String,        // ID único da transação
  pixCode: String,             // BR Code completo
  endToEndId: String,          // ID E2E confirmado pelo provedor
  amount: Number,              // Valor da transação
  
  beneficiary: {
    name: String,              // Nome da conta central da plataforma
    key: String,               // Chave Pix
    keyType: String,           // Tipo da chave
    bank: String,              // Código do banco
    city: String               // Cidade
  },
  
  payer: {
    name: String,              // Nome do pagador (preenchido após pagamento)
    document: String,          // CPF/CNPJ do pagador
    accountNumber: String      // Conta do pagador
  },
  
  status: String,              // pending | paid | expired | cancelled | refunded
  expiresAt: Date,             // Data de expiração
  paidAt: Date,                // Data do pagamento
  
  webhookData: Mixed,          // Dados brutos do webhook
  reconciliationAttempts: Number,
  lastReconciliationAt: Date,
  cancelReason: String,
  
  metadata: {
    description: String,
    referenceLabel: String
  }
}
```

## 🔌 API Endpoints

### 1. Criar Transação Pix
```http
POST /api/orders/:orderId/pix
Authorization: Bearer <token>
```

**Request:**
```json
{
  "expiresInMinutes": 30
}
```

**Response:**
```json
{
  "transactionId": "TXN-1234567890-ABC123",
  "pixCode": "00020126580014BR.GOV.BCB.PIX...",
  "amount": 45.90,
  "expiresAt": "2024-01-15T20:30:00.000Z",
  "status": "pending",
  "beneficiary": {
    "name": "Mococa Food",
    "key": "chave-da-conta-central",
    "keyType": "email"
  },
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### 2. Obter Transação por ID
```http
GET /api/pix/:transactionId
Authorization: Bearer <token>
```

### 3. Obter Transação por Pedido
```http
GET /api/orders/:orderId/pix
Authorization: Bearer <token>
```

### 4. Cancelar Transação
```http
DELETE /api/pix/:transactionId
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Desisti do pedido"
}
```

### 5. Listar Transações (Admin)
```http
GET /api/pix/transactions?status=paid&limit=20&skip=0
Authorization: Bearer <token>
```

### 6. Webhook de Confirmação
```http
POST /api/pix/webhook
Content-Type: application/json
X-Webhook-Signature: sha256=<HMAC-SHA256 do corpo bruto>

{
  "transactionId": "TXN-1234567890-ABC123",
  "endToEndId": "E1234567890ABCDEFGHIJKLMNOP",
  "status": "paid",
  "amount": 45.90,
  "paidAt": "2024-01-15T20:15:00.000Z",
  "payer": {
    "name": "João Silva",
    "document": "12345678900",
    "accountNumber": "12345-6"
  }
}
```

## ⚙️ Configuração

### Variáveis de Ambiente

Adicione ao seu `.env`:

```bash
# Configurações Pix
PIX_ENABLED=true
PIX_EXPIRATION_MINUTES=30
PIX_WEBHOOK_SECRET=segredo-compartilhado-com-o-provedor
PIX_RECEIVER_KEY=chave-pix-da-conta-da-plataforma
PIX_RECEIVER_KEY_TYPE=email
PIX_RECEIVER_NAME=Mococa Food
PIX_RECEIVER_CITY=MOCOCA
```

Os pagamentos Pix são direcionados à conta central da plataforma. Em produção, configure uma chave pertencente à operação e um banco/PSP que assine callbacks com `PIX_WEBHOOK_SECRET`. Não use chaves fictícias: sem conta central configurada, a API não emite cobrança.

O callback precisa incluir o `transactionId` exibido no QR, o valor recebido em BRL e a assinatura HMAC do corpo HTTP bruto. O E2E bancário real pode ser enviado junto e fica armazenado para reconciliação.

## 🔄 Fluxo de Pagamento

```
1. Cliente cria pedido com paymentMethod='pix'
         ↓
2. Sistema gera transação Pix com QR Code
         ↓
3. Cliente escaneia QR Code e paga no app do banco
         ↓
4. Banco processa pagamento e envia webhook
         ↓
5. Sistema valida a assinatura HMAC do corpo bruto e o valor recebido
         ↓
6. Transação marcada como 'paid'
         ↓
7. Pedido atualizado automaticamente para 'confirmed'
         ↓
8. Cliente e restaurante notificados em tempo real
         ↓
9. Restaurante começa a preparar o pedido
```

## 🔒 Segurança

### Validações Implementadas
- ✅ Verificação de autenticidade do usuário
- ✅ Identidade administrativa em collection separada, com status e permissões revalidados
- ✅ Idempotência no processamento de webhooks
- ✅ Assinatura HMAC obrigatória e conferência do valor do pagamento
- ✅ Validação de status antes de transições
- ✅ Campos EMV completos e CRC16 coberto por teste

### Em Produção
- [ ] Integrar o provedor bancário/PSP escolhido e validar callbacks conforme o contrato dele
- [ ] Usar certificado SSL para todas as comunicações
- [ ] Implementar rate limiting nas rotas Pix
- [x] Adicionar logging de auditoria para ações administrativas
- [x] Usar variáveis de ambiente para segredos

## 🧪 Testes

### Teste Manual do Fluxo

1. **Criar pedido com Pix:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "...",
    "items": [{"productId": "...", "quantity": 2}],
    "deliveryAddress": {...},
    "paymentMethod": "pix"
  }'
```

2. **Gerar QR Code Pix:**
```bash
curl -X POST http://localhost:3000/api/orders/<orderId>/pix \
  -H "Authorization: Bearer <token>"
```

3. **Simular webhook de pagamento:**
```bash
curl -X POST http://localhost:3000/api/pix/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "endToEndId": "E1234567890TEST",
    "status": "paid",
    "paidAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "payer": {"name": "Test User"}
  }'
```

## 🛠️ Jobs Automatizados

### Expiração de Transações Pendentes

Execute periodicamente (ex: a cada 5 minutos):

```javascript
import { expireOldPixTransactions } from './services/pix.service.js';

// Cron job ou setInterval
setInterval(async () => {
  const result = await expireOldPixTransactions();
  console.log(result.message);
}, 5 * 60 * 1000); // 5 minutos
```

## 📊 Monitoramento

### Métricas Importantes
- Taxa de conversão de pagamentos Pix
- Tempo médio entre criação e confirmação
- Quantidade de transações expiradas vs pagas
- Erros no processamento de webhooks

### Logs
Todos os eventos são logados via Pino:
- Criação de transação
- Recebimento de webhook
- Erros de validação
- Expiração de transações

## 🔗 Integração com Bancos

### Bancos Suportados
O módulo é genérico e funciona com qualquer banco que siga o padrão Pix do Banco Central:

- Banco do Brasil
- Itaú
- Bradesco
- Santander
- Caixa
- Nubank
- Inter
- Original

### Configuração por Banco

Cada banco pode ter particularidades no webhook. Consulte a documentação do seu banco para:
- Formato exato do payload do webhook
- Método de autenticação (API Key, Certificado, HMAC)
- URLs de sandbox e produção

## 🚀 Próximos Passos

- [ ] Integração com gateway de pagamento (ex: Asaas, Juno, Stripe)
- [ ] Suporte a Pix Saque/Troco
- [ ] Reembolso automático via API Pix
- [ ] Dashboard de transações para restaurantes
- [ ] Relatórios financeiros
- [ ] Notificações push de confirmação
- [ ] Split de pagamento (marketplace)

## 📚 Referências

- [Manual de Implementação do Pix - Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix)
- [Padrão EMV QRCPS](https://www.emvco.com/)
- [API Pix - Especificação](https://openbanking-brasil.github.io/specs-seguranca/openapi-idp-br.html)

## 📄 Licença

Mesma licença do projeto Mococa Food.
