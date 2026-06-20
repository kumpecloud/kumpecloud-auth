<p align="center">
  <img width="240" src="./logo.png" alt="KumpeCloud Auth logo">
</p>

# KumpeCloud Auth

**KumpeCloud Auth is the self-hosted identity and access management platform for KumpeCloud.**

It provides OIDC, OAuth 2.1, SAML, enterprise SSO, multi-tenancy, and RBAC for production applications without upstream OSS feature caps.

## Quick start

### Docker Compose

```bash
docker compose up
```

The admin console is available on port `3002` and the API on port `3001`.

Published container images:

```bash
docker pull ghcr.io/kumpecloud/kumpecloud-auth:latest
```

### Local development

See [AGENTS.md](./AGENTS.md) for the full local development workflow, including PostgreSQL setup, database seeding, and `pnpm start:dev`.

## Upstream attribution

KumpeCloud Auth is derived from [Logto](https://github.com/logto-io/logto) by Silverhand Inc., licensed under the [Mozilla Public License 2.0](./LICENSE).

This fork:

- Rebrands the admin console and sign-in experience as **KumpeCloud Auth**
- Publishes Docker images to `ghcr.io/kumpecloud/kumpecloud-auth`

Internal package names, environment variables, and APIs remain compatible with upstream Logto unless noted otherwise.

See [NOTICE](./NOTICE) for copyright and trademark details.

## Licensing

Source code in this repository is available under [MPL-2.0](./LICENSE).

The **Logto** name, logos, and related trademarks belong to their respective owners and are not granted by the license. KumpeCloud Auth does not represent itself as an official Logto product.
