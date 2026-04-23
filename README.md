# IT Support Ticket Form

A lightweight ticketing form for internal employees. It accepts tickets only from a configured email domain.

## Run

```bash
cp .env.example .env
```

```bash
node server.js
```

Open `http://localhost:3000`.

Admin dashboard: `http://localhost:3000/admin.html`

## Configuration

Set these keys in `.env`:

- `ALLOWED_EMAIL_DOMAIN` (default: `company.com`)
- `ALLOWED_USER_EMAILS` (optional, comma-separated emails allowed to open the form; if empty, any email from the allowed domain can continue)
- `ALLOWED_USER_DISPLAY_NAMES` (optional, comma-separated `email:Display Name` pairs for the verified greeting)
- `PORT` (default: `3000`)
- `ADMIN_TOKEN` (optional, protects ticket list endpoint)
- `SUPABASE_URL` (optional; if set with key, Supabase storage is used)
- `SUPABASE_SERVICE_ROLE_KEY` (optional; required for Supabase mode)
- `SUPABASE_TICKETS_TABLE` (optional; default: `it_support_tickets`)

## Storage modes

- Local fallback: tickets are stored in `data/tickets.json`
- Supabase mode: automatically enabled when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy project values into `.env`:
   - `SUPABASE_URL` from project settings
   - `SUPABASE_SERVICE_ROLE_KEY` from API keys
4. Restart server.

## API

- `POST /api/tickets` - submit a ticket
- `POST /api/identity` - validate an employee email before showing the form
- `GET /api/config` - front-end config (allowed domain)
- `GET /api/tickets` - list tickets (requires `x-admin-token` if `ADMIN_TOKEN` is set)

## Admin dashboard

Open `/admin.html`, enter the value of `ADMIN_TOKEN`, then load submitted tickets. The dashboard supports search, priority/status filters, refresh, and CSV export.

Will be enhanced later
