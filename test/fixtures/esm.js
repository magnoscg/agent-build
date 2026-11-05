import { isRunning, start, stop } from '../../dist/agent-build.mjs';
import '../../dist/auto.mjs';

window.esm = { isRunning, start, stop };
