# Issues

An issue and task tracking web application.

## 🚀 Stack

- **Package Manager:** [PNPM](https://pnpm.io/)
- **Frontend / Framework:** [SvelteKit](https://kit.svelte.dev/)
- **Backend / Database:** [PocketBase](https://pocketbase.io/)
- **UI Components:** [WebAwesome](https://webawesome.com/)
- **Containerization:** [Docker](https://www.docker.com/) & Docker Compose
- **Hosting / Deployment:** Ready for [Coolify](https://coolify.io/)

---

## 📐 Guidelines & Conventions

1. **No Tailwind:** This project does not use Tailwind CSS.
2. **Layout with `Grid.svelte`:** Use the `Grid.svelte` component (`@/components/Grid.svelte`) whenever possible to structure layouts and element alignment.
3. **Elements with WebAwesome:** Use WebAwesome web components (`<wa-...>`) for buttons, icons, cards, inputs, and other interface elements.
4. **Minimal CSS:** Do not add CSS rules or classes unnecessarily. Keep styles clean and let components handle structure.
5. **No Redundant Attributes:** Do not specify default prop values (e.g. avoid `<Grid gap="m" />` since `m` is default).
6. **Separate Header & Footer:** Header and Footer are separate, reusable components.

---

## 📁 Project Structure

```text
.
├── docker-compose.yml       # Local / Coolify orchestration (SvelteKit + PocketBase)
├── Dockerfile               # Multi-stage build optimized for production
├── src/
│   ├── app.d.ts             # Global typings and PocketBase session types
│   ├── app.html             # Base HTML template
│   ├── hooks.server.ts      # PocketBase auth hook and session management
│   ├── components/
│   │   ├── Grid.svelte      # Base layout and flex alignment component
│   │   ├── Header.svelte    # Application header component
│   │   └── Footer.svelte    # Application footer component
│   ├── css/
│   │   ├── main.css         # Main CSS entry point
│   │   ├── base/            # Reset and WebAwesome theme variables
│   │   └── layout/          # Containers and layout utilities
│   ├── lib/
│   │   └── pocketbase.ts    # PocketBase client instance and user store
│   ├── routes/
│   │   ├── +layout.svelte   # Root layout (Header, Grid, Footer, global styles)
│   │   ├── +page.svelte     # Starter home page
│   │   └── login/           # Login page
│   └── types/
│       └── grid.ts          # Types and props for Grid.svelte
├── AGENTS.md                # Agent instructions and checklist
└── LICENSE                  # MIT License
```

---

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

2. (Optional) Start PocketBase via Docker Compose:
   ```bash
   docker compose up -d pocketbase
   ```
   The PocketBase Admin UI will be available at: `http://localhost:8090/_/`

3. Start the SvelteKit development server:
   ```bash
   pnpm dev
   ```
   The application will be running at `http://localhost:5173`.

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
