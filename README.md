# Issues

An issue and task tracking web application.

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v24+)
- [PNPM](https://pnpm.io/) (`corepack enable && corepack prepare pnpm@latest --activate`)
- [Docker](https://www.docker.com/) (optional, for running with PocketBase)

### Install Dependencies

```bash
pnpm install
```

### Local Development

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Start the development server (PocketBase will automatically start in the background):
   ```bash
   pnpm dev
   ```

   - **Frontend:** `http://localhost:5173`
   - **PocketBase Admin UI:** `http://localhost:8090/_/`

---

## 🐳 Docker & Coolify

The project is pre-configured for deployment on **Coolify** using Dockerfile or Docker Compose:

### Production with Docker Compose:
```bash
docker compose up -d --build
```

- **SvelteKit App:** Port `3000`
- **PocketBase:** Port `8090` (persisted via `pb_data` volume)

---

## 📄 License

Distributed under the [MIT](LICENSE) License.
