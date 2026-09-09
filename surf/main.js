import { installLifecycle } from '../shared/controls.js';
import { bootRide } from '../shared/ride-app.js';
import { SurfGame } from './simulation.js';
import { SurfView } from './render.js';
await bootRide({ Game: SurfGame, View: SurfView, installLifecycle });
