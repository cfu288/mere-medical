# @mere/fhir-oauth

OAuth clients for SMART on FHIR servers. Provides vendor-specific clients that handle the differences in OAuth implementations across EHR systems while exposing a consistent `TokenSet` type.

## Supported Vendors

| Vendor    | Client Type  | Token Exchange | PKCE | Token Refresh       |
| --------- | ------------ | -------------- | ---- | ------------------- |
| Epic      | Public       | Frontend       | Yes  | JWT-based           |
| Cerner    | Public       | Frontend       | Yes  | refresh_token grant |
| OnPatient | Confidential | Backend        | No   | Not supported       |

## Core Types

All clients work with these shared types:

```typescript
interface TokenSet {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  patientId?: string;
  scope?: string;
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
}
```

## Public Client Flow (Epic, Cerner)

Epic and Cerner use public OAuth clients where token exchange happens. The flow spans two arms - first sending the user to authorize, then handling the callback on redirect to exchange the code for tokens:

### 1. Initiate Authorization

```typescript
import { createEpicClient } from '@mere/fhir-oauth';
import { signJwt } from '@mere/crypto';

// Epic requires JWT signing; Cerner does not
// JWT is passed in as a dep as different platforms may have different signing methods (e.g. Web Crypto, Node.js crypto)
const client = createEpicClient({ signJwt });
// const client = createCernerClient();

const config: OAuthConfig = {
  clientId: 'your-client-id',
  redirectUri: 'https://yourapp.com/callback',
  scopes: ['openid', 'fhirUser'],
  tenant: {
    id: 'tenant-id',
    name: 'Hospital Name',
    authUrl: 'https://fhir.example.com/oauth2/authorize',
    tokenUrl: 'https://fhir.example.com/oauth2/token',
    fhirBaseUrl: 'https://fhir.example.com/api/FHIR/R4',
  },
};

const { url, session } = await client.initiateAuth(config);
// Save session data to verify on callback
sessionStorage.setItem('oauth_session', JSON.stringify(session));
window.location.href = url;
```

### 2. Handle Callback

Once a user has completed authorization with an EMR, you should handle the redirect back to your app:

```typescript
// Fetch the session data saved earlier
const session = JSON.parse(sessionStorage.getItem('oauth_session'));
sessionStorage.removeItem('oauth_session');

const searchParams = new URLSearchParams(window.location.search);
const tokens: TokenSet = await client.handleCallback(searchParams, config, session);
```

### 3. Token Refresh

Client provides a helper to refresh tokens when expired:

```typescript
if (client.isExpired(tokens)) {
  const newTokens = await client.refresh(tokens, config);
}
```

## Confidential Client Flow (OnPatient)

OnPatient requires a `client_secret`, so token exchange must happen on the backend. The client provides helpers for the frontend portion of the flow.

```typescript
import { createOnPatientClient, ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';

const client = createOnPatientClient();

// Frontend: Build auth URL and redirect
const authUrl = client.buildAuthUrl({
  clientId: 'your-client-id',
  redirectUri: 'https://yourapp.com/api/onpatient/callback',
});
window.location.href = authUrl;

// Backend handles code exchange with client_secret...
// Frontend fetches tokens from backend via session

// Frontend: Parse backend response into TokenSet
const tokens = client.parseTokenResponse(backendResponse);
```

Constants are exported for API calls:

- `ONPATIENT_CONSTANTS.BASE_URL` - `https://onpatient.com`
- `ONPATIENT_CONSTANTS.FHIR_URL` - `https://onpatient.com/api/fhir`

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
import { getPublicKey } from '@mere/crypto';

const publicKey = await getPublicKey();
const { clientId } = await registerEpicDynamicClient(tokens.accessToken, epicBaseUrl, originalClientId, publicKey);

const refreshedTokens = await client.refresh({ ...tokens, clientId }, config);
```
