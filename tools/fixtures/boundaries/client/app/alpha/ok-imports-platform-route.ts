// Allowed only because (platform) is classified as client-platform; if the
// client/app/* glob treated it as an app this would be a cross-app import.
import { auditPage } from '../(platform)/audit/page';

export const value = auditPage;
