// Violation: app imports another app (JSX).
import { beta } from '../beta/beta';

export const Bad = () => <p>{beta}</p>;
