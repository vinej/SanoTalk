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
