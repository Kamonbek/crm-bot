# Arabic Teacher Telegram CRM Bot

Build a Telegram CRM and learning funnel for an Arabic teacher.

## Architecture

Backend:
- Python 3.12
- FastAPI
- aiogram v3
- SQLAlchemy 2.x async
- Alembic
- PostgreSQL
- pytest
- Cloud Run deployment

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- GitHub Pages deployment

Database:
- PostgreSQL, compatible with Supabase or Neon free tier.

MVP must avoid Redis/Celery. Use database-backed scheduled messages.

## Core Features

- Telegram webhook
- /start deep-link campaign tracking
- user registration
- campaign management
- materials management
- automation sequences
- scheduled follow-up messages
- segmented broadcasts
- delivery logs
- event logs
- admin web dashboard

## Non-goals

Do not build payments, complex CRM pipelines, drag-and-drop automation, Telegram Mini App, or SaaS multi-tenancy.

## Security

Never expose TELEGRAM_BOT_TOKEN to frontend.
Never commit secrets.
Use backend-only env vars.
Use JWT admin auth.
All admin APIs require auth.
Broadcasts require preview before sending.

## Database Provider

Use Supabase PostgreSQL as the production database.

The backend must connect to Supabase through DATABASE_URL.

For Cloud Run, prefer Supabase Supavisor transaction pooler connection string on port 6543 because Cloud Run may scale horizontally.

Use SQLAlchemy async with asyncpg.

DATABASE_URL example:

postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

Important:
- Never use Supabase anon key for backend database access.
- Never expose DATABASE_URL to frontend.
- Frontend must call backend API only.
- Backend owns all database access.
- Use small SQLAlchemy pool settings suitable for Cloud Run.