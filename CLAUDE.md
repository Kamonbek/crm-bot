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