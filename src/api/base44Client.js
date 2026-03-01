import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// When running locally without a token, the SDK analytics module calls User/me and
// gets a 401. Disable analytics pre-emptively so no network call is made.
if (!token && typeof window !== 'undefined') {
  const instances = window.base44SharedInstances;
  if (instances?.analytics?.instance?.config) {
    instances.analytics.instance.config.enabled = false;
  }
}

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});
