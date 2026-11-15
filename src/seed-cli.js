import { createStore } from './store/index.js';
import { seedDemo } from './seed.js';

const store = await createStore();
const result = await seedDemo(store);
store.flush?.();
console.log(result.created ? 'Demo circle created:' : 'Demo circle already exists:', result);
