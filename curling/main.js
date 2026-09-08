// Shared keyboard, touch and lifecycle contract: ../shared/controls.js.
import { boot } from '../shared/precision-app.js';
import { CurlingGame } from './simulation.js';
boot({ kind: 'curling', create: options => new CurlingGame(options), loadView: async () => (await import('./render.js')).CurlingView });
