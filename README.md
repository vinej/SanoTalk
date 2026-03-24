# SanoTalk 🩺🎙️

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

## Getting Started

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker & Docker Compose

### 1. Clone & Install
\`\`\`bash
git clone https://github.com/vinej/SanoTalk.git
cd SanoTalk
pnpm install
\`\`\`

### 2. Configure Environment
\`\`\`bash
cp .env.example .env
# Fill in your values in .env
\`\`\`

### 3. Start Infrastructure
\`\`\`bash
docker compose -f infra/docker-compose.yml up -d
\`\`\`

### 4. Run Migrations
\`\`\`bash
pnpm db:generate
pnpm db:migrate
\`\`\`

### 5. Start Dev Servers
\`\`\`bash
pnpm dev
# Web:    http://localhost:5173
# Server: http://localhost:3001
# MinIO:  http://localhost:9001
# Grafana:http://localhost:3000
\`\`\`

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
\`\`\`
SanoTalk/
├── apps/
│   ├── web/          # React 19 frontend (Vite)
│   └── server/       # tRPC + Mastra API server
├── packages/
│   ├── db/           # Drizzle schema & migrations
│   ├── trpc/         # Shared router types
│   └── config/       # Shared ESLint & TS configs
└── infra/            # Docker Compose & Grafana config
\`\`\`

## License
MIT
``*
