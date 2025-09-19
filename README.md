## WhatsApp Coach API

Minimal Express + TypeScript service integrating Twilio WhatsApp, OpenAI, and Supabase.

### Prerequisites
- Node.js 18+
- Twilio account with a WhatsApp-enabled number
- OpenAI API key
- Supabase project (URL + anon key)

### Setup
1. Install dependencies:
```bash
npm install
```
2. Create an `.env` file from `env.example` and fill in your values.
3. Create the database schema in Supabase using `database_schema.sql`.

### Scripts
- `npm run dev` – Start dev server with autoreload
- `npm run build` – Type-check and compile to `dist/`
- `npm start` – Run compiled server

### Endpoints
- `POST /webhooks/whatsapp` – Twilio WhatsApp webhook receiver
- `GET /health` – Health check

### Notes
- Twilio sends `application/x-www-form-urlencoded`; this app enables `urlencoded` and `json` parsers.
- Ensure your Twilio webhook is configured to this server's public URL.



