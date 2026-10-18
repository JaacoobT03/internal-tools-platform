// Violation: app dynamically imports another app.
export const bad = () => import('../beta/beta');
