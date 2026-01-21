# @mere/fhir-oauth

OAuth clients for SMART on FHIR servers. Handles the authorization flow including PKCE, token exchange, and JWT-based token refresh.

## Usage

OAuth requires a redirect to the authorization server and back, so the flow spans two pages:

### 1. Login Page - Initiate Authorization

```typescript
import { createEpicClient, OAuthConfig } from '@mere/fhir-oauth';
import { signJwt } from '@mere/crypto';

const client = createEpicClient({ signJwt });

const config: OAuthConfig = {
  clientId: 'your-client-id',
  redirectUri: 'https://yourapp.com/callback',
  scopes: ['openid', 'fhirUser'],
  tenant: {
    id: 'epic-tenant-id',
    name: 'Hospital Name',
    authUrl: 'https://fhir.epic.com/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/oauth2/token',
    fhirBaseUrl: 'https://fhir.epic.com/api/FHIR/R4',
  },
};

// Generate auth URL and PKCE session
const { url, session } = await client.initiateAuth(config);

// Persist session across redirect (PKCE verifier + state)
sessionStorage.setItem('oauth_session', JSON.stringify(session));

// Redirect to authorization server
window.location.href = url;
```

### 2. Callback Page - Exchange Code for Tokens

```typescript
import { createEpicClient, TokenSet } from '@mere/fhir-oauth';
import { signJwt } from '@mere/crypto';

const client = createEpicClient({ signJwt });

// Restore session from before redirect
const session = JSON.parse(sessionStorage.getItem('oauth_session'));
sessionStorage.removeItem('oauth_session');

// Exchange authorization code for tokens
const searchParams = new URLSearchParams(window.location.search);
const tokens: TokenSet = await client.handleCallback(searchParams, config, session);

// tokens.accessToken - Use for FHIR API calls
// tokens.refreshToken - Use for token refresh (if available)
// tokens.patientId - The patient context (if returned)
```

### Token Refresh

```typescript
if (client.isExpired(tokens)) {
  const newTokens = await client.refresh(tokens, config);
}
```

## Proxy Support

For environments where direct FHIR server access is blocked (CORS), use the proxy client:

```typescript
import { createEpicClientWithProxy } from '@mere/fhir-oauth';

const client = createEpicClientWithProxy(
  { signJwt },
  (tenantId, targetType) => `https://yourproxy.com/api/proxy?serviceId=${tenantId}&target_type=${targetType}`
);
```

## Dynamic Client Registration

Epic supports registering a dynamic client for automatic token refresh:

```typescript
import { registerEpicDynamicClient } from '@mere/fhir-oauth';
import { getPublicKey } from '@mere/crypto';

const publicKey = await getPublicKey();
const { clientId } = await registerEpicDynamicClient(
  tokens.accessToken,
  epicBaseUrl,
  originalClientId,
  publicKey
);

// Use the new clientId for subsequent refresh calls
const refreshedTokens = await client.refresh(
  { ...tokens, clientId },
  config
);
```

## Cerner / Oracle Health

Cerner uses standard OAuth2 with PKCE (no JWT signing required):

```typescript
import { createCernerClient, OAuthConfig } from '@mere/fhir-oauth';

const client = createCernerClient();

const config: OAuthConfig = {
  clientId: 'your-cerner-client-id',
  redirectUri: 'https://yourapp.com/cerner/callback',
  scopes: ['openid', 'fhirUser', 'offline_access', 'patient/Patient.read'],
  tenant: {
    id: 'cerner-tenant-id',
    name: 'Hospital Name',
    authUrl: 'https://authorization.cerner.com/.../authorize',
    tokenUrl: 'https://authorization.cerner.com/.../token',
    fhirBaseUrl: 'https://fhir-myrecord.cerner.com/r4/...',
  },
};

// Initiate auth (same flow as Epic)
const { url, session } = await client.initiateAuth(config);
sessionStorage.setItem('oauth_session', JSON.stringify(session));
window.location.href = url;

// On callback page
const session = JSON.parse(sessionStorage.getItem('oauth_session'));
const tokens = await client.handleCallback(searchParams, config, session);

// Token refresh uses standard refresh_token grant (no JWT required)
if (client.isExpired(tokens)) {
  const newTokens = await client.refresh(tokens, config);
}
```
