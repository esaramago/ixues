# Ixues

An issue and task tracking web application built with SvelteKit, PocketBase, and WebAwesome.

Supports local issue tracking as well as synchronized projects connecting directly with external providers like GitHub and Jira.

---

## 🛠️ Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v24+)
- [PNPM](https://pnpm.io/) (`corepack enable && corepack prepare pnpm@latest --activate`)
- [Docker](https://www.docker.com/)

### Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start the development environment:**
   ```bash
   docker compose up -d pocketbase
   pnpm dev
   ```

   - **Frontend:** `http://localhost:5173`
   - **PocketBase Admin UI:** `http://localhost:8090/_/`

---

## 📖 Technical Documentation

For in-depth technical documentation, see [DEVELOPMENT.md](DEVELOPMENT.md):

- **Architecture:** SvelteKit SSR, PocketBase integration, and token encryption.
- **Database & Migrations:** Schema definitions, migration management, and automated deployment migrations.
- **Deployment & Coolify:** Multi-service Docker setup, persistent storage volumes, and container builds.
- **Conventions:** Code style, layout system, and component guidelines.

---

## 📄 License

Distributed under the [MIT](LICENSE) License.
