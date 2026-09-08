// Shared keyboard, touch and lifecycle contract: ../shared/controls.js.
import { boot } from '../shared/precision-app.js';
import { PoolGame } from './simulation.js';
boot({ kind: 'pool', create: options => new PoolGame(options), loadView: async () => (await import('./render.js')).PoolView });
