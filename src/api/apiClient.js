import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

export const api = createClient({
  appId,
  serverUrl,
  token,
  functionsVersion,
  requiresAuth: false
});
