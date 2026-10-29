# Development Guide

This document contains technical details, architecture notes, and workflows for developing and deploying Ixues.

---

## 🏗️ Architecture Overview

Ixues is an issue and task tracking web application composed of:

- **Frontend & Server:** [SvelteKit](https://kit.svelte.dev/) with Server-Side Rendering (SSR) via `@sveltejs/adapter-node`.
- **UI Components:** [WebAwesome](https://www.webawesome.com/) web components + custom `Grid.svelte` layout system.
- **Backend & Database:** [PocketBase](https://pocketbase.io/) (SQLite + embedded Go backend) for authentication, collections, and relations.
- **External Integrations:** GitHub API and Jira REST API for synchronized projects.
- **Security:** Secret tokens (GitHub PATs, Jira API tokens) are encrypted with AES-256-GCM before storage in PocketBase and stripped (`null`) before data reaches the client.

---

## 🛠️ Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v24+)
- [PNPM](https://pnpm.io/) (`corepack enable && corepack prepare pnpm@latest --activate`)
- [Docker](https://www.docker.com/) & Docker Compose

### Initial Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start the PocketBase container:**
   ```bash
   docker compose up -d pocketbase
   ```
   - **PocketBase Admin UI:** `http://localhost:8090/_/`
   - **Local override (`docker-compose.override.yml`):** Maps port `8090` and live-mounts `./pb_migrations` for local convenience.

4. **Start the development server:**
   ```bash
   pnpm dev
   ```
   - **Frontend App:** `http://localhost:5173`

5. **Typecheck & Build Verification:**
   ```bash
   pnpm check
   pnpm build
   ```

---

## 🗄️ Database & Migrations

### Collections

PocketBase manages the following core collections:
- `projects`: Contains local and sync project definitions, slugs, repo URLs, encrypted tokens, `privacy` (`private` or `public`), and `share_token`.
- `statuses`: Workflow columns per project (order, key, color, name).
- `tasks`: Issues/tasks with title, description, priority (lowest to urgent), status, labels, relationships, and assigned user.
- `users`: Authentication records managed by PocketBase auth.

### Project Privacy & Secret Share Links

- **Private Mode:** The project is strictly accessible to the owner. Clean URLs (`/projects/[slug]`) require authentication and project ownership; any unauthenticated visitor is redirected to `/login`, and unauthorized users receive a 404.
- **Share Link Mode:** Public access is granted strictly through unguessable, randomized share URLs (`/share/[shareToken]`).
  - Anyone with the link can view the Kanban board and task details in read-only mode.
  - Clean URLs (`/projects/[slug]`) remain private and protected behind login.
  - The project owner can regenerate the share token at any time in Edit Project to revoke access to old links.

### How Migrations Work

All schema modifications are tracked as JavaScript migration files in the `pb_migrations/` directory:
- Migration files are timestamped (e.g. `1793202000_add_privacy_to_projects.js`).
- PocketBase maintains an internal `_migrations` table tracking all applied files.

### Migrations in Production & Coolify

To prevent issues with host filesystem paths on Coolify or remote Docker hosts:

1. **Baking into Docker Image:** `Dockerfile.pocketbase` copies `./pb_migrations` directly into `/pb_migrations` inside the image at build time:
   ```dockerfile
   FROM ghcr.io/muchobien/pocketbase:latest
   COPY pb_migrations /pb_migrations
   ```
2. **Auto-execution on Startup:** PocketBase runs with `--automigrate=true` by default. When Coolify builds and starts the `pocketbase` container, PocketBase automatically detects any unapplied migrations in `/pb_migrations` and applies them to the persistent `pb_data` volume before serving requests.

### Useful Migration Commands

Run migrations manually inside the local container:
```bash
# Apply pending migrations
docker exec issues-pocketbase-1 /usr/local/bin/pocketbase migrate up --dir=/pb_data

# Revert the last applied migration
docker exec issues-pocketbase-1 /usr/local/bin/pocketbase migrate down 1 --dir=/pb_data

# Sync _migrations history table with available files
docker exec issues-pocketbase-1 /usr/local/bin/pocketbase migrate history-sync --dir=/pb_data
```

Run migrations manually in Coolify:
- Navigate to the **PocketBase container** in Coolify → **Terminal / Exec** tab.
- Run:
  ```bash
  /usr/local/bin/pocketbase migrate up --dir=/pb_data --migrationsDir=/pb_migrations
  ```

---

## 🐳 Docker & Production Deployment

The project is pre-configured for deployment on **Coolify** using Docker Compose.

### Docker Compose Services

- **`web`**: Built from the root `Dockerfile` using Node 22 Alpine in a multi-stage build. Runs the SvelteKit Node server on port `3000`.
- **`pocketbase`**: Built from `Dockerfile.pocketbase`. Runs PocketBase on port `8090`, persisting data in the `pb_data` Docker volume.

### Production Build & Launch

```bash
docker compose up -d --build
```

---

## 📐 Code Style & Conventions

- **Formatting:** 2 spaces indentation.
- **Language:** Code comments, git commit messages, and documentation must be in English.
- **Components:** Use WebAwesome custom elements (`<wa-*>`) and `<Grid>` for layout.
- **CSS:** Avoid Tailwind or external CSS frameworks; do not use inline styles.
