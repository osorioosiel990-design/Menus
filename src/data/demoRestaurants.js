const sharedImage = (id, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=78`;

window.DEMO_RESTAURANTS = {
  'mesa-limon': {
    name: 'Mesa Limón',
    label: 'RESTAURANTE DE DEMOSTRACIÓN',
    description: 'Cocina fresca para compartir, hecha al ritmo de la temporada.',
    location: 'Catálogo de muestra',
    hours: 'Horario de ejemplo',
    currency: 'MXN',
    theme: { accent: '#bc4f34', ink: '#273c32', paper: '#f4f2eb' },
    cover: sharedImage('photo-1517248135467-4c7edcad34c4', 1800),
    categories: [
      { id: 'entradas', name: 'Para empezar' },
      { id: 'fuertes', name: 'Platos de casa' },
      { id: 'bebidas', name: 'Bebidas' },
      { id: 'dulce', name: 'Algo dulce' },
    ],
    products: [
      { id: 'tostada', category: 'entradas', name: 'Tostada de temporada', description: 'Aguacate, cítricos, hierbas frescas y un toque de chile.', price: 145, image: sharedImage('photo-1547592180-85f173990554'), available: true, featured: true },
      { id: 'ensalada', category: 'entradas', name: 'Ensalada del huerto', description: 'Hojas tiernas, fruta de estación, semillas tostadas y vinagreta de limón.', price: 168, image: sharedImage('photo-1512621776951-a57141f2eefd'), available: true },
      { id: 'pasta', category: 'fuertes', name: 'Pasta al limón', description: 'Pasta fresca, parmesano, pimienta y ralladura de limón.', price: 238, image: sharedImage('photo-1473093295043-cdd812d0e601'), available: true, featured: true },
      { id: 'vegetales', category: 'fuertes', name: 'Vegetales a la brasa', description: 'Vegetales asados, yogur de hierbas y pan de masa madre.', price: 205, image: sharedImage('photo-1540420773420-3366772f4999'), available: false },
      { id: 'agua', category: 'bebidas', name: 'Agua fresca del día', description: 'Preparada en casa. Pregunta por el sabor disponible.', price: 58, image: sharedImage('photo-1544145945-f90425340c7e'), available: true },
      { id: 'tarta', category: 'dulce', name: 'Tarta de fruta', description: 'Rebanada del día con fruta de temporada.', price: 112, image: sharedImage('photo-1488477181946-6428a0291777'), available: true },
    ],
  },
  'patio-bruma': {
    name: 'Patio Bruma',
    label: 'RESTAURANTE DE DEMOSTRACIÓN',
    description: 'Un menú breve, sabores al fuego y sobremesas sin prisa.',
    location: 'Catálogo de muestra',
    hours: 'Horario de ejemplo',
    currency: 'MXN',
    theme: { accent: '#41695a', ink: '#24382f', paper: '#f3f0e8' },
    cover: sharedImage('photo-1414235077428-338989a2e8c0', 1800),
    categories: [
      { id: 'entradas', name: 'Al centro' },
      { id: 'fuego', name: 'Del fuego' },
      { id: 'bebidas', name: 'Bebidas' },
    ],
    products: [
      { id: 'pan', category: 'entradas', name: 'Pan de la casa', description: 'Pan rústico tibio, aceite de hierbas y sal de mar.', price: 92, image: sharedImage('photo-1509440159596-0249088772ff'), available: true },
      { id: 'berenjena', category: 'entradas', name: 'Berenjena tatemada', description: 'Berenjena al fuego, crema de ajonjolí y hierbas.', price: 154, image: sharedImage('photo-1518977676601-b53f82aba655'), available: true, featured: true },
      { id: 'pollo', category: 'fuego', name: 'Pollo a las brasas', description: 'Pollo marinado, vegetales y jugo de cocción.', price: 286, image: sharedImage('photo-1532550907401-a500c9a57435'), available: true },
      { id: 'hongos', category: 'fuego', name: 'Hongos de temporada', description: 'Hongos asados, puré suave y aceite de chile.', price: 224, image: sharedImage('photo-1504545102780-26774c1bb073'), available: false },
      { id: 'limonada', category: 'bebidas', name: 'Limonada de la casa', description: 'Limón, agua mineral y hojas frescas.', price: 64, image: sharedImage('photo-1544145945-f90425340c7e'), available: true },
    ],
  },
  'demo-inactivo': {
    name: 'Catálogo no disponible',
    label: 'DEMO INACTIVO',
    description: '',
    isActive: false,
    categories: [],
    products: [],
  },
};