# BillBharat v3 — Deployment Guide

GST Billing SaaS for Indian SMEs | React + Vite Frontend · FastAPI Backend · Supabase DB

---

## Project Structure

```
billbharat/
├── frontend/          ← React + Vite app
│   ├── src/
│   │   ├── App.jsx    ← Full app (1 file)
│   │   └── main.jsx   ← Entry point
│   ├── public/
│   │   └── manifest.json
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example   ← Copy to .env
│
└── backend/           ← FastAPI backend
    ├── main.py        ← All API routes
    ├── requirements.txt
    ├── supabase_schema.sql
    ├── Dockerfile
    └── .env.example   ← Copy to .env
```

---

## Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon key** (Settings → API)
3. Copy your **service role key** (for backend)
4. Go to **SQL Editor** → paste and run `backend/supabase_schema.sql`
5. Go to **Authentication** → enable Email/Password provider

---

## Step 2 — Set Up Razorpay

1. Go to [razorpay.com](https://razorpay.com) → Create account
2. Settings → API Keys → Generate **Live Key**
3. Settings → Webhooks → Add URL: `https://yourdomain.com/api/payment/webhook`
   - Events: `payment.captured`, `refund.created`
   - Copy the **Webhook Secret**

---

## Step 3 — Frontend Deployment (Vercel — Recommended)

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Create .env from example
cp .env.example .env
# Edit .env — fill in your Supabase URL, anon key, Razorpay key

# 3. Test locally
npm run dev
# → Opens at http://localhost:3000

# 4. Build for production
npm run build
# → Output in frontend/dist/

# 5. Deploy to Vercel
npm i -g vercel
vercel --prod
# Follow prompts — set env vars in Vercel dashboard
```

**Vercel Environment Variables** (Dashboard → Project → Settings → Environment Variables):
```
VITE_SUPABASE_URL        = https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJh...
VITE_RAZORPAY_KEY        = rzp_live_...
VITE_API_URL             = https://api.yourdomain.com/api
```

---

## Step 4 — Backend Deployment (Railway — Recommended)

```bash
cd backend

# 1. Create .env from example
cp .env.example .env
# Edit .env — fill in all values

# 2. Test locally
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → API at http://localhost:8000
# → Docs at http://localhost:8000/docs

# 3. Deploy to Railway
# Go to railway.app → New Project → Deploy from GitHub
# Or use Railway CLI:
npm i -g @railway/cli
railway login
railway up

# Set environment variables in Railway dashboard
```

**Railway Environment Variables**:
```
SUPABASE_URL             = https://xxx.supabase.co
SUPABASE_SERVICE_KEY     = eyJh...  (service role key)
RAZORPAY_KEY_ID          = rzp_live_...
RAZORPAY_KEY_SECRET      = your_secret
RAZORPAY_WEBHOOK_SECRET  = your_webhook_secret
ANTHROPIC_API_KEY        = sk-ant-...
FRONTEND_URL             = https://yourdomain.vercel.app
CORS_ORIGINS             = https://yourdomain.vercel.app
PORT                     = 8000
```

---

## Step 5 — Docker (Alternative Backend Deployment)

```bash
cd backend
docker build -t billbharat-api .
docker run -p 8000:8000 --env-file .env billbharat-api
```

For Docker Compose (frontend + backend together):
```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env

  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes: ["./frontend:/app"]
    command: sh -c "npm install && npm run build && npx serve dist -p 3000"
    ports: ["3000:3000"]
    depends_on: [api]
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/payment/create-order` | Create Razorpay order |
| POST | `/api/payment/verify` | Verify payment + activate premium |
| POST | `/api/payment/webhook` | Razorpay webhook handler |
| POST | `/api/ai/chat` | AI CA Advisor (proxies Anthropic) |
| GET | `/api/subscription/{user_id}` | Check premium status |
| POST | `/api/gstr/generate` | Generate GSTR-1 JSON |
| POST | `/api/sync` | Batch sync data to Supabase |
| GET | `/api/gstin/validate/{gstin}` | Validate GSTIN |
| GET | `/api/analytics/{user_id}` | Dashboard analytics |
| POST | `/api/notify/whatsapp` | Send invoice via WhatsApp |

Interactive docs at: `https://your-api-url/docs`

---

## Promo Codes

| Code | Discount |
|------|----------|
| LAUNCH50 | 50% off |
| STARTUP30 | 30% off |
| EARLYBIRD | 40% off |
| BB2024 | 20% off |

Premium fallback activation code: `797979`

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Recharts |
| Styling | Pure CSS-in-JS (no Tailwind dependency) |
| Auth + DB | Supabase (PostgreSQL + Row Level Security) |
| Payments | Razorpay |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Backend | FastAPI + Uvicorn |
| Hosting (recommended) | Vercel (frontend) + Railway (backend) |

---

## Support

BillBharat v3.0.0 — Built for Indian SMEs 🇮🇳
