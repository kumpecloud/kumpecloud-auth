export const managementApiAuthDescription = `KumpeCloud Management API is a comprehensive set of REST APIs that gives you full control over KumpeCloud Auth to suit your product needs and tech stack.

### Get started

The API follows the same authentication principles as other API resources, with some slight differences. To use the KumpeCloud Management API:

1. A machine-to-machine (M2M) application needs to be created.
2. A machine-to-machine (M2M) role with Management API permission \`all\` needs to be assigned to the application.

Once you have them set up, you can use the \`client_credentials\` grant type to fetch an access token and use it to authenticate your requests to the KumpeCloud Management API.

### Fetch an access token

To fetch an access token, make a \`POST\` request to the \`/oidc/token\` endpoint of your deployment.

For self-hosted KumpeCloud Auth, use your public endpoint (for example \`https://auth.example.com\`). The built-in Management API resource indicator is \`https://[tenant-id].kumpe.app/api\` (for OSS, the tenant ID is usually \`default\`).

The request should follow the OAuth 2.0 [client credentials](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4) grant type. Here is a non-normative example:

\`\`\`bash
curl --location \\
  --request POST 'https://auth.example.com/oidc/token' \\
  --header 'Content-Type: application/x-www-form-urlencoded' \\
  --data-urlencode 'grant_type=client_credentials' \\
  --data-urlencode 'client_id=[app-id]' \\
  --data-urlencode 'client_secret=[app-secret]' \\
  --data-urlencode 'resource=https://default.kumpe.app/api' \\
  --data-urlencode 'scope=all'
\`\`\`

Replace \`auth.example.com\`, \`[app-id]\`, and \`[app-secret]\` with your deployment endpoint, application ID, and application secret, respectively.

The response will be like:

\`\`\`json
{
  "access_token": "eyJhbG...2g",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "all"
}
\`\`\`

### Use the access token

Include the access token in the \`Authorization\` header with the \`Bearer\` scheme when calling the Management API on your deployment endpoint.

\`\`\`bash
curl --location \\
  --request GET 'https://auth.example.com/api/users' \\
  --header 'Authorization: Bearer eyJhbG...2g'
\`\`\`
`;

export const userApiAuthDescription = `KumpeCloud User API is a set of REST APIs that gives the end user the ability to manage their own profile and perform verifications.

To use this API, you need to have an openid access token with empty audience and required scopes.
`;
