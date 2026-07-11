export const seedRestaurants = [
  {
    id: 'r1',
    name: 'Cantina da Nonna',
    category: 'Italiana',
    minOrderValue: 30,
    deliveryFee: 5.50,
    isOpen: true,
    description: 'A melhor massa de Mococa.',
    address: 'Rua XV, 100'
  },
  {
    id: 'r2',
    name: 'Burger Mococa',
    category: 'Hamburgueria',
    minOrderValue: 25,
    deliveryFee: 4.00,
    isOpen: true,
    description: 'Artesanais e suculentos.',
    address: 'Av. São João, 50'
  }
]

export const seedMenuItems = [
  { id: 'm1', restaurantId: 'r1', name: 'Lasanha Bolonhesa', category: 'Massas', price: 45.00, description: 'Massa fresca, molho caseiro' },
  { id: 'm2', restaurantId: 'r1', name: 'Espaguete à Carbonara', category: 'Massas', price: 38.00, description: 'Bacon, creme de leite, parmesão' },
  { id: 'm3', restaurantId: 'r1', name: 'Pizza Margherita', category: 'Pizzas', price: 55.00, description: 'Molho, mussarela, manjericão' },
  { id: 'm4', restaurantId: 'r2', name: 'X-Bacon', category: 'Clássicos', price: 28.00, description: 'Pão, carne, bacon, queijo' },
  { id: 'm5', restaurantId: 'r2', name: 'X-Salada', category: 'Clássicos', price: 22.00, description: 'Pão, carne, queijo, salada' }
]
