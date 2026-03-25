<img src="assets/logo.svg" alt="SanoTalk" width="240" />

# SanoTalk

> **Website:** [www.sanotalk.com](http://www.sanotalk.com) — currently under construction, coming soon!

A real-time AI-powered medical conversation platform with transcription, live
video/audio sessions, and intelligent note generation.

## Tech Stack

### Frontend
| Package | Purpose |
|---|---|
| React 19 | UI framework |
| TanStack Router | File-based type-safe routing |
| TanStack Query | Server state & caching |
| shadcn/ui | Component library |
| ai-elements | Streaming AI UI primitives |
| @json-render/* | Dynamic JSON-driven UI |
| @livekit/components-react | Real-time audio/video |
| @daveyplate/better-auth-ui | Auth UI components |

### Backend
| Package | Purpose |
|---|---|
| TypeScript | Language |
| tRPC | End-to-end type-safe API |
| Mastra | AI agent orchestration |
| Drizzle ORM | Type-safe database access |
| PostgreSQL | Primary database |

### Services
| Service | Purpose |
|---|---|
| LiveKit | Real-time audio/video rooms |
| Deepgram | Speech-to-text transcription |
| Better Auth + Resend | Authentication & email |
| MinIO (S3) | Object/file storage |
| Grafana + Loki | Observability & log aggregation |
| OpenReplay | Session replay & analytics |

## Features

### Consultations

- Real-time audio/video medical consultations via LiveKit
- Live speech-to-text transcription powered by Deepgram
- AI-generated session summaries and SOAP notes via Claude (Anthropic)
- Session recordings stored in MinIO (S3-compatible)

### AI Health Assistant

- In-session AI chat panel powered by Claude Sonnet — ask health questions and get informed responses in real time
- Voice-to-AI: live transcript is automatically forwarded to the AI assistant, so speaking during a consultation also feeds the assistant
- AI chat history is included as context when generating the session summary
- Toggle voice mode on/off independently of the microphone

### Summary Sharing

- Once a summary is generated, patients can email it directly to their linked doctor or pharmacist with a single click
- The dialog only shows providers already linked to the patient's profile — no free-form address entry

### User Profiles

- Role-based profile editing from the dashboard
- Patients can link a doctor and a pharmacist from the registered users list
- Doctors and pharmacists can set their specialty and license number

### Platform

- **Kanban board** for task management — assign tasks to users, track progress across *Not Assigned*, *Assigned*, and *Completed* columns
- Fully internationalized UI (6 languages: English, French, Spanish, Chinese, Arabic, Hindi)
- Session replay and analytics via OpenReplay
- Observability with Grafana + Loki

## Getting Started

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker & Docker Compose

### 1. Clone & Install

```bash
git clone https://github.com/vinej/SanoTalk.git
cd SanoTalk
pnpm install
```

### 2. Configure Environment

The project uses two `.env` files — one for the server, one for the Vite frontend:

#### Root (server)

```bash
cp .env.example .env
# Fill in your values — database, auth, API keys, email, etc.
```

#### Frontend (`apps/web/`)

```bash
cp apps/web/.env.example apps/web/.env
# Fill in the Vite-specific values — API URLs, OpenReplay
```

> Vite only reads `.env` files from its own package directory (`apps/web/`), not from the monorepo root. The root `.env` is used exclusively by the Node server.

### 3. Start Infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Run Migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 5. Start Dev Servers

```bash
pnpm dev
# Web:    http://localhost:5173
# Server: http://localhost:3001
# MinIO:  http://localhost:9001
# Grafana:http://localhost:3000
```

## Getting API Keys

Each external service requires credentials. Below are the steps to obtain them.

---

### 🔐 Better Auth — `BETTER_AUTH_SECRET`

No sign-up needed. Just generate a random secret (minimum 32 characters):

```bash
openssl rand -base64 32
```

Paste the output as `BETTER_AUTH_SECRET` in your `.env`.

---

### 📧 Resend — `RESEND_API_KEY`

Used for transactional emails (email verification, password reset).

1. Go to [https://resend.com](https://resend.com) and create a free account
2. In the dashboard, navigate to **API Keys** → **Create API Key**
3. Copy the key and set it as `RESEND_API_KEY`
4. Set `EMAIL_FROM` to a verified sender address (the free tier allows `onboarding@resend.dev` without domain verification)

---

### 🎥 LiveKit — `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

Used for real-time audio/video rooms.

1. Go to [https://livekit.io](https://livekit.io) and sign up for a free cloud account
2. Create a new **Project** from the dashboard
3. Open the project settings → **Keys** tab
4. Copy the **API Key**, **API Secret**, and **WebSocket URL** (format: `wss://your-project.livekit.cloud`)
5. Set them as `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_URL`

---

### 🎙️ Deepgram — `DEEPGRAM_API_KEY`

Used for real-time speech-to-text transcription.

1. Go to [https://console.deepgram.com](https://console.deepgram.com) and create a free account
2. From the dashboard, click **Create a new API Key**
3. Give it a name, select **Member** role, and click **Create Key**
4. Copy the key immediately (it is only shown once) and set it as `DEEPGRAM_API_KEY`

---

### 🤖 Anthropic — `ANTHROPIC_API_KEY`

Used for AI agent note generation via the Claude API.

1. Go to [https://console.anthropic.com](https://console.anthropic.com) and sign up
2. Navigate to **API Keys** → **Create Key**
3. Copy the key (format: `sk-ant-...`) and set it as `ANTHROPIC_API_KEY`

> **Note:** Anthropic requires adding credits before the API key becomes active.

---

### 📊 OpenReplay — `VITE_OPENREPLAY_PROJECT_KEY`, `VITE_OPENREPLAY_INGEST_POINT`

Used for session replay and frontend analytics. Optional — the app runs fine without it.

**Cloud (easiest):**

1. Go to [https://openreplay.com](https://openreplay.com) and create a free account
2. Create a new **Project**
3. In the project settings, copy the **Project Key**
4. Set `VITE_OPENREPLAY_PROJECT_KEY` to that key and `VITE_OPENREPLAY_INGEST_POINT` to `https://api.openreplay.com/ingest`

**Self-hosted:**

1. Follow the self-hosting guide at [https://docs.openreplay.com/deployment](https://docs.openreplay.com/deployment)
2. Set `VITE_OPENREPLAY_INGEST_POINT` to your own instance URL (e.g. `https://your-domain.com/ingest`)

---

## Docker Services

| Service | Image | Port(s) | Purpose |
| --- | --- | --- | --- |
| PostgreSQL | `postgres:16-alpine` | `5432` | Main relational database — users, sessions, messages |
| MinIO | `minio/minio` | `9000` (API), `9001` (UI) | S3-compatible file storage — avatars, attachments, recordings |
| MinIO Init | `minio/mc` | — | One-time job that creates the `sanotalk` bucket on startup |
| Loki | `grafana/loki` | `3100` | Log aggregation — collects logs from the server |
| Grafana | `grafana/grafana` | `3000` | Monitoring dashboard — visualize logs from Loki |

**In short:** Postgres = data, MinIO = files, Loki + Grafana = logs & monitoring.

- MinIO admin UI: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)
- Grafana UI: [http://localhost:3000](http://localhost:3000) (`admin` / `admin`) — Loki is pre-configured as a datasource

Start all services from the `infra/` folder:

```bash
cd infra
docker compose up -d
```

---

## Supported Languages

The UI is fully internationalized (i18n) and available in 6 languages:

| Code | Language |
| --- | --- |
| `en` | English |
| `fr` | French |
| `es` | Spanish |
| `zh` | Chinese (Simplified) |
| `ar` | Arabic |
| `hi` | Hindi |

## Project Structure

```text
SanoTalk/
├── apps/
│   ├── web/          # React 19 frontend (Vite)
│   └── server/       # tRPC + Mastra API server
├── packages/
│   ├── db/           # Drizzle schema & migrations
│   ├── trpc/         # Shared router types
│   └── config/       # Shared ESLint & TS configs
└── infra/            # Docker Compose & Grafana config
```

## License

MIT
