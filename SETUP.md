# CA Practice Manager — Setup Guide

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 15 · TypeScript · Tailwind CSS · ShadCN UI · Zustand · React Query |
| Backend | Node.js · Express · TypeScript |
| Database | PostgreSQL 16 · Prisma ORM |
| Auth | JWT (access + refresh tokens) · RBAC |
| Queue | Redis 7 · BullMQ |
| Storage | Cloudflare R2 or AWS S3 |
| Automation | Playwright |
| AI | OpenAI GPT-4o |
| Container | Docker · docker-compose |

---

## Quick Start (Docker — recommended)

### 1. Clone & configure
```bash
# Copy environment file
cp .env.example .env

# Edit .env — at minimum set:
# JWT_SECRET, JWT_REFRESH_SECRET (openssl rand -hex 64)
# ENCRYPTION_KEY (openssl rand -hex 32)
# OPENAI_API_KEY
# R2_* or AWS_* storage credentials
```

### 2. Start services
```bash
docker-compose up -d
```

### 3. Run migrations & seed
```bash
# Inside the backend container
docker exec ca_backend npx prisma migrate deploy
docker exec ca_backend npm run db:seed
```

### 4. Access the app
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000/api |
| API Health | http://localhost:4000/api/health |

**Demo login:** `admin@capractice.com` / `Admin@123`

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally
- Redis 7 running locally

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment
```bash
# Backend
cp .env.example backend/.env
# Edit backend/.env

# Frontend
cp frontend/.env.local.example frontend/.env.local
```

### 3. Database setup
```bash
cd backend
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start dev servers
```bash
# From root (runs both simultaneously)
npm run dev

# Or individually:
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:3000
```

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `JWT_SECRET` | 64-char hex JWT signing key | ✅ |
| `JWT_REFRESH_SECRET` | 64-char hex refresh token key | ✅ |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256 | ✅ |
| `STORAGE_PROVIDER` | `r2` or `s3` | ✅ |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | R2 only |
| `R2_ACCESS_KEY_ID` | R2 access key | R2 only |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | R2 only |
| `R2_BUCKET_NAME` | R2 bucket name | R2 only |
| `OPENAI_API_KEY` | OpenAI API key for AI features | ✅ |
| `SMTP_HOST` | SMTP server host | For email |
| `SMTP_USER` | SMTP username | For email |
| `SMTP_PASS` | SMTP password / app password | For email |

---

## Project Structure

```
practice-management/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Full DB schema (17 models)
│   │   └── seed.ts            # Demo data seeder
│   └── src/
│       ├── controllers/       # Route handlers (auth, clients, tasks…)
│       ├── routes/            # Express router definitions
│       ├── middleware/        # auth, rbac, audit, errorHandler
│       ├── services/          # encryption, storage, AI, notifications
│       ├── queues/            # BullMQ queue setup + workers
│       ├── automation/        # Playwright runner
│       └── lib/               # Prisma & Redis clients
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/  # Login page
│       │   └── (dashboard)/   # All app pages
│       │       ├── dashboard/
│       │       ├── clients/
│       │       ├── tasks/
│       │       ├── compliance/
│       │       ├── notices/
│       │       ├── documents/
│       │       ├── billing/
│       │       ├── credentials/
│       │       ├── automation/
│       │       ├── ai/
│       │       ├── team/
│       │       └── settings/
│       ├── components/
│       │   ├── ui/            # ShadCN UI components
│       │   ├── layout/        # Sidebar, TopNav
│       │   ├── clients/       # ClientDialog, ImportDialog
│       │   ├── tasks/         # TaskDialog
│       │   └── billing/       # InvoiceDialog
│       ├── hooks/             # use-toast
│       ├── lib/               # api client, utils
│       └── store/             # Zustand stores (auth, ui)
│
├── docker-compose.yml
├── .env.example
└── SETUP.md
```

---

## User Roles & Permissions

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Full access — all modules |
| `PARTNER` | All client data, team management |
| `MANAGER` | Assigned clients, tasks, compliance |
| `ARTICLE_ASSISTANT` | Tasks, filings (no credentials/billing) |
| `ACCOUNTANT` | Clients, tasks, documents |
| `CLIENT` | Client portal only |

---

## Key Features

### 🔐 Security
- JWT + refresh token rotation
- AES-256-GCM encryption for credential vault
- OTP-gated credential reveal
- RBAC on all endpoints
- Audit log on every sensitive action
- bcrypt password hashing (12 rounds)
- Helmet + rate limiting

### 🤖 AI (GPT-4o powered)
- Notice summarization & risk classification
- AI-drafted notice replies
- Document analysis & insights
- Compliance recommendations

### ⚡ Automation (Playwright)
- Background portal login (GST, IT, TRACES, MCA)
- BullMQ job queue with retry logic
- Semi-auto / manual assist modes

### 📊 Dashboard
- Real-time KPI cards
- Revenue area charts (Recharts)
- Filing status pie chart
- Compliance heatmap
- Activity timeline
- Upcoming due dates

---

## Production Checklist

- [ ] Rotate all secrets in `.env`
- [ ] Set strong `ENCRYPTION_KEY` (never change after data is created)
- [ ] Configure SMTP for email notifications
- [ ] Set up Cloudflare R2 or AWS S3 bucket with proper CORS
- [ ] Add OpenAI API key
- [ ] Run `prisma migrate deploy` (not `migrate dev`) in production
- [ ] Set up a reverse proxy (Nginx / Caddy) in front of both services
- [ ] Enable HTTPS
- [ ] Configure log rotation for `/backend/logs`
