# @mere/fhir-oauth

OAuth clients for SMART on FHIR servers. Handles patient standalone launch flows with vendor-specific clients that normalize the differences in OAuth implementations across EHR systems, exposing a consistent `TokenSet` return type.

## Supported Vendors

| Vendor    | Client Type  | Token Exchange | PKCE | Token Refresh       |
| --------- | ------------ | -------------- | ---- | ------------------- |
| Epic      | Public       | Frontend       | Yes  | JWT-based           |
| Cerner    | Public       | Frontend       | Yes  | refresh_token grant |
| OnPatient | Confidential | Backend        | No   | Not supported       |

## Quick Start (React)

For React apps, `useOAuthFlow` handles the full OAuth lifecycle including session persistence across redirects and loading/error states:

```typescript
import { createCernerClient, CERNER_DEFAULT_SCOPES, type OAuthConfig } from '@mere/fhir-oauth';
import { useOAuthFlow } from '@mere/fhir-oauth/react';

const client = createCernerClient();

// Tenant info typically comes from a provider directory or user selection.
// These URLs are found in the FHIR server's /.well-known/smart-configuration
const config: OAuthConfig = {
  clientId: 'your-cerner-client-id',
  redirectUri: 'https://yourapp.com/oauth/cerner/callback',
  scopes: CERNER_DEFAULT_SCOPES,
  tenant: {
    id: 'ec2458f2-1e24-41c8-b71b-0e701af7583d',
    name: 'Cerner Health',
    authUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/hosts/fhir-myrecord.cerner.com/protocols/oauth2/profiles/smart-v1/token',
    fhirBaseUrl: 'https://fhir-myrecord.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    fhirVersion: 'R4',
  },
};

function LoginPage() {
  const { initiateAuth, isLoading, error } = useOAuthFlow({
    client,
    vendor: 'cerner',
  });

  const handleLogin = async () => {
    const { url } = await initiateAuth(config);
    window.location.href = url;
  };

  return <button onClick={handleLogin} disabled={isLoading}>Connect</button>;
}

function CallbackPage() {
  const { handleCallback, isLoading, error } = useOAuthFlow({
    client,
    vendor: 'cerner',
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    handleCallback(searchParams, config).then((tokens) => {
      // Store tokens and redirect to app
    });
  }, []);

  return <div>{isLoading ? 'Connecting...' : error?.message}</div>;
}
```

For Epic, pass a JWT signing function:

```typescript
import { createEpicClient, EPIC_DEFAULT_SCOPES, type OAuthConfig } from '@mere/fhir-oauth';
import { signJwt } from '@mere/crypto/browser';

const client = createEpicClient({ signJwt });

const config: OAuthConfig = {
  clientId: 'your-epic-client-id',
  redirectUri: 'https://yourapp.com/oauth/epic/callback',
  scopes: EPIC_DEFAULT_SCOPES,
  tenant: {
    id: 'tenant-uuid',
    name: 'MyChart Hospital',
    authUrl: 'https://fhir.hospital.com/oauth2/authorize',
    tokenUrl: 'https://fhir.hospital.com/oauth2/token',
    fhirBaseUrl: 'https://fhir.hospital.com/api/FHIR/R4',
    fhirVersion: 'R4',
  },
};
```

## Quick Start (Non-React)

Without React, use the client directly and manage session state yourself:

```typescript
import { createEpicClient, EPIC_DEFAULT_SCOPES, type OAuthConfig } from '@mere/fhir-oauth';
import { signJwt } from '@mere/crypto/browser';

const client = createEpicClient({ signJwt });

const config: OAuthConfig = {
  clientId: 'your-epic-client-id',
  redirectUri: 'https://yourapp.com/oauth/epic/callback',
  scopes: EPIC_DEFAULT_SCOPES,
  tenant: {
    id: 'tenant-uuid',
    name: 'MyChart Hospital',
    authUrl: 'https://fhir.hospital.com/oauth2/authorize',
    tokenUrl: 'https://fhir.hospital.com/oauth2/token',
    fhirBaseUrl: 'https://fhir.hospital.com/api/FHIR/R4',
    fhirVersion: 'R4',
  },
};

// 1. Initiate auth and save session before redirect
const { url, session } = await client.initiateAuth(config);
sessionStorage.setItem('oauth_session', JSON.stringify(session));
window.location.href = url;

// 2. On callback, restore session and exchange code for tokens
const session = JSON.parse(sessionStorage.getItem('oauth_session')!);
sessionStorage.removeItem('oauth_session');
const searchParams = new URLSearchParams(window.location.search);
const tokens = await client.handleCallback(searchParams, config, session);

// 3. Refresh tokens when expired
if (client.isExpired(tokens)) {
  const newTokens = await client.refresh(tokens, config);
}
```

## Core Types

```typescript
interface TokenSet {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
  patientId?: string;
  clientId?: string;
  raw: Record<string, unknown>;
}

interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  tenant?: TenantConfig;
}

interface TenantConfig {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  fhirVersion?: 'DSTU2' | 'R4';
}
```

## Custom Storage Adapters

By default, `useOAuthFlow` uses `sessionStorage`. For non-browser React environments like [Ink](https://github.com/vadimdemedes/ink) (React for CLI apps), provide a custom adapter:

```typescript
import { useOAuthFlow, StorageAdapter } from '@mere/fhir-oauth/react';

const fileStorage: StorageAdapter = {
  async getItem(key) {
    /* Read from file, keychain, etc. */
  },
  async setItem(key, value) {
    /* Write to file, keychain, etc. */
  },
  async removeItem(key) {
    /* Delete from file, keychain, etc. */
  },
};

const { initiateAuth, handleCallback } = useOAuthFlow({
  client,
  vendor: 'epic',
  storage: fileStorage,
});
```

The `StorageAdapter` interface supports both sync and async implementations, so browser's `sessionStorage` works directly.

## Confidential Client Flow (OnPatient)

OnPatient requires a `client_secret`, so token exchange must happen on the backend. Only frontend utilities are provided:

```typescript
import { buildOnPatientAuthUrl, parseOnPatientTokenResponse, ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';

// Frontend: Build auth URL and redirect
const authUrl = buildOnPatientAuthUrl({
  clientId: 'your-client-id',
  publicUrl: 'https://yourapp.com',
  redirectPath: '/api/onpatient/callback',
});
window.location.href = authUrl;

// Backend handles code exchange with client_secret...
// Frontend fetches tokens from your backend and parses them
const tokens = parseOnPatientTokenResponse(backendResponse);
```

Constants are exported for API calls:

- `ONPATIENT_CONSTANTS.BASE_URL` - `https://onpatient.com`
- `ONPATIENT_CONSTANTS.FHIR_URL` - `https://onpatient.com/api/fhir`
- `ONPATIENT_CONSTANTS.DEFAULT_SCOPE` - `patient/*.read`

## Epic-Specific Features

### Proxy Support

For environments where direct FHIR server access is blocked (CORS):

```typescript
import { createEpicClientWithProxy } from '@mere/fhir-oauth';

const client = createEpicClientWithProxy({ signJwt }, (tenantId, targetType) => `https://yourproxy.com/api/proxy?serviceId=${tenantId}&target_type=${targetType}`);
```

### Dynamic Client Registration

Epic supports registering a dynamic client for token refresh:

```typescript
import { registerEpicDynamicClient } from '@mere/fhir-oauth';
import { getPublicKey } from '@mere/crypto/browser';

const publicKey = await getPublicKey();
const { clientId } = await registerEpicDynamicClient(tokens.accessToken, epicBaseUrl, originalClientId, publicKey);

const refreshedTokens = await client.refresh({ ...tokens, clientId }, config);
```

## Low-Level APIs

These are exported for advanced use cases but most applications should use `useOAuthFlow` or the client directly.

### `createSessionManager`

OAuth requires redirecting users to an external authorization server, which means your app loses all in-memory state. The session contains the PKCE `codeVerifier` and `state` parameter that must survive this redirect—without them, the token exchange will fail.

`useOAuthFlow` handles this automatically. For non-React environments (e.g., Node.js CLI tools), use `createSessionManager`:

```typescript
import { createSessionManager } from '@mere/fhir-oauth';

// Browser envs use sessionStorage by default
// Custom storage adapter example:
const manager = createSessionManager('epic', customStorage);

// Before redirect: save the session returned by initiateAuth
const { url, session } = await client.initiateAuth(config);
await manager.save(session);

// After redirect: restore session for token exchange
const session = await manager.load();
const tokens = await client.handleCallback(searchParams, config, session);
await manager.clear();
```

### `useOAuthorizationRequestState`

React hook that provides session persistence without the loading/error state management of `useOAuthFlow`. Use this when you need finer control over the auth flow—for example, when integrating with existing state management or when `useOAuthFlow`'s built-in state doesn't fit your UI patterns.

```typescript
import { useOAuthorizationRequestState } from '@mere/fhir-oauth/react';

const { saveSession, loadSession, clearSession } = useOAuthorizationRequestState('epic');

// You call the client directly and manage state yourself
const handleLogin = async () => {
  setLoading(true);
  const { url, session } = await client.initiateAuth(config);
  await saveSession(session);
  window.location.href = url;
};

const handleCallback = async () => {
  const session = await loadSession();
  if (!session) throw new Error('No session found');
  const tokens = await client.handleCallback(searchParams, config, session);
  await clearSession();
  return tokens;
};
```
