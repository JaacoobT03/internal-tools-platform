// Violation: app imports another app (ES module).
import { beta } from '../beta/beta';

export const bad = beta;
