export interface ApiKeyStatus {
  hasKey: boolean;
  preview?: string;
  issuedAt?: string;
}

export interface ClassicWebhook {
  url: string;
  enabled: boolean;
  secretConfigured: boolean;
  secretRotatedAt: string | null;
  extraUrls: string[];
}

export type IntegrationKeyState = 'active' | 'rotating' | 'revoked' | 'expired';

export interface IntegrationKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  state: IntegrationKeyState;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  events: string[];
  contract: 'legacy' | 'v2';
  enabled: boolean;
  createdAt?: string;
}

export type BridgeState = 'ok' | 'no_api_key' | 'unavailable';

export interface OrgIntegrations {
  apiKey: ApiKeyStatus;
  classicWebhook: ClassicWebhook;
  bridge: { state: BridgeState; keys: IntegrationKey[]; endpoints: WebhookEndpoint[] };
}

export interface RotatedApiKey {
  apiKey: string;
  issuedAt?: string;
}
