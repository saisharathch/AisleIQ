# Grocery Bill Calculator Beta Setup

This app is now set up for a simple 2-user live beta:

- PostgreSQL for production data
- S3-compatible object storage for receipt files
- NextAuth credentials login, with optional Google login for the shared Sheets owner
- One shared Google Sheet owned by one account
- Inline OCR processing by default so you do not need a separate worker for a tiny beta

## 1. Environment variables

Copy `.env.example` to `.env` and fill in the values.

Required for a real deployment:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `ALLOW_SELF_SIGNUP`
- `NEXT_PUBLIC_ALLOW_SELF_SIGNUP`
- `ALLOWED_SIGNUP_EMAILS`
- `ANTHROPIC_API_KEY`
- `OCR_INLINE_FALLBACK`
- `STORAGE_TYPE`

Required when `STORAGE_TYPE="s3"`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_S3_ENDPOINT` if you use R2, MinIO, Backblaze, or another S3-compatible service
- `AWS_S3_PUBLIC_BASE_URL` if the bucket is exposed through a custom/public URL

Required only if you want Google Sheets sync:

- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SHEETS_OWNER_EMAIL`

## 2. Local setup

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL locally. The included `docker-compose.yml` is enough for local development:

```bash
docker compose up -d db
```

3. Run the database migration:

```bash
npm run db:migrate:deploy
```

4. Start the app:

```bash
npm run dev
```

The default beta setup uses inline OCR processing, so you do not need to run `npm run worker` unless you later decide to move OCR off the web process.

## 3. First beta account setup

Recommended simple flow:

1. Set `ALLOW_SELF_SIGNUP=true`
2. Set `NEXT_PUBLIC_ALLOW_SELF_SIGNUP=true`
3. Set `ALLOWED_SIGNUP_EMAILS` to the two real beta emails
4. Let those two people create accounts
5. Change `ALLOW_SELF_SIGNUP=false`
6. Change `NEXT_PUBLIC_ALLOW_SELF_SIGNUP=false`
7. Redeploy

This keeps account creation simple without building a full invite system yet.

## 4. Google Sheets setup

This beta is intentionally simple:

- only one app user should connect Google Sheets
- that user must use the email in `GOOGLE_SHEETS_OWNER_EMAIL`
- the app writes all synced receipt rows into that owner’s spreadsheet
- then that spreadsheet can be shared manually with the second person

Google Cloud setup:

1. Enable the Google Sheets API
2. Create an OAuth client
3. Add your deployed app URL to the authorized redirect URIs
4. Set the Google env vars
5. Set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`
6. Sign in as the owner account with Google once

## 5. Simple production deployment

Any host that can run a Next.js Node server is fine for this beta.

Minimum production stack:

- one app service running `npm run build` then `npm run start`
- one managed PostgreSQL database
- one S3-compatible bucket for uploads

Recommended deploy sequence:

1. Provision PostgreSQL
2. Provision the S3-compatible bucket
3. Set all production env vars
4. Run:

```bash
npm install
npm run build
npm run db:migrate:deploy
npm run start
```

Health check:

- `GET /api/health`

## 6. Test checklist

Before sharing with the two beta users:

1. Sign up both allowed emails while signup is enabled
2. Disable signup and redeploy
3. Sign in with credentials for both accounts
4. Upload a JPG or PDF receipt from each account
5. Confirm each account only sees its own receipts in the app
6. Re-upload the same receipt and confirm duplicate upload protection triggers
7. Edit and approve a receipt
8. Connect Google only on the owner account
9. Sync a receipt from each app account and confirm both land in the same shared spreadsheet
10. Restart or redeploy the app and confirm uploaded receipts still open correctly

## 7. Intentionally skipped for now

These were left out on purpose to keep the beta small and stable:

- invite flows
- password reset emails
- email verification
- multi-tenant Sheets ownership
- background job infrastructure beyond optional local worker support
- virus scanning / malware scanning for uploads
- advanced audit/security controls
- webhook-based storage processing
- large-scale observability or queue infrastructure
