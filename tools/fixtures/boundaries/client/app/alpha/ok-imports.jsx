// Allowed: app imports platform and its own files (JSX).
import { util } from '../../lib/util';
import { alpha } from './alpha';

export const Ok = () => <p>{util + alpha}</p>;
