import { installLifecycle } from '../shared/controls.js';
import { bootRide } from '../shared/ride-app.js';
import { SkiGame } from './simulation.js';
import { SkiView } from './render.js';
await bootRide({ Game: SkiGame, View: SkiView, installLifecycle });
