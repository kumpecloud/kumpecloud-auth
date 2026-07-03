# Importing the KumpeApps Auth agent

This skill teaches Cursor agents about KumpeCloud Auth and aMember sync. Import it into any repo where you build apps that authenticate against KumpeCloud Auth.

## Option 1: Git submodule (recommended)

Keeps the skill in sync with `kumpecloud-auth`:

```bash
# From the target repo root
git submodule add -b main \
  https://github.com/kumpecloud/kumpecloud-auth.git \
  .vendor/kumpecloud-auth

# Symlink or copy the skill into the discovery path
mkdir -p .agents/skills
ln -sf ../../.vendor/kumpecloud-auth/.agents/skills/kumpeapps-auth \
  .agents/skills/kumpeapps-auth
```

After `git submodule update --remote`, the skill updates with the auth repo.

## Option 2: Copy the skill folder

```bash
# One-time copy
cp -R /path/to/kumpecloud-auth/.agents/skills/kumpeapps-auth \
  /path/to/your-app/.agents/skills/kumpeapps-auth
```

Re-copy when the skill changes. Good for repos without submodule access.

## Option 3: Sparse checkout (CI / monorepo tooling)

```bash
git clone --filter=blob:none --sparse git@github.com:kumpecloud/kumpecloud-auth.git .vendor/kumpecloud-auth
cd .vendor/kumpecloud-auth
git sparse-checkout set .agents/skills/kumpeapps-auth
```

Then symlink as in option 1.

## Discovery paths

Cursor discovers skills from:

- `.agents/skills/<name>/SKILL.md`
- `.cursor/skills/<name>/SKILL.md`

Use either path in the consuming repo. The skill name is `kumpeapps-auth`.

## Invoking the agent

In Cursor chat:

```text
Use $kumpeapps-auth to ...
```

Examples:

- "Use $kumpeapps-auth to add OIDC sign-in to this Next.js app against staging."
- "Use $kumpeapps-auth — why doesn't this user have product role 42?"

## What ships with this skill

| File | Contents |
|------|----------|
| `SKILL.md` | Entry point, env URLs, quick reference |
| `references/architecture.md` | Monorepo layout, Logto concepts, fork deltas |
| `references/amember-sync.md` | Full sync behavior, config, troubleshooting |
| `references/app-integration.md` | SDK setup for consumer apps |
| `references/deployment.md` | Prod/stage images, deploy-bot, secrets |
| `agents/openai.yaml` | Cursor agent interface metadata |

## Related skills (auth repo only)

These live in `kumpecloud-auth` and are linked from `SKILL.md` when working on the auth service itself:

- `logto-dev-environment` — local stack bootstrap
- `logto-local-storage` — MinIO for avatar uploads in dev

Copy those separately if agents in another repo need to run the auth stack locally.
