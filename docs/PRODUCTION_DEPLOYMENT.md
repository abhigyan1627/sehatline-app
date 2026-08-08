# SehatLine production deployment

This deployment keeps the existing Patient, Doctor and Admin interfaces on one HTTPS domain, with all `/api/*` requests served by the same application.

## What the stack contains

- SehatLine Node.js application
- MongoDB-backed persistent platform data
- Persistent profile-photo storage
- Caddy reverse proxy with automatic HTTPS
- Real MSG91 OTP credentials supplied only through server environment variables

## Server requirement

Use one Linux VPS with Docker and Docker Compose installed. Point the GoDaddy domain to the VPS public IPv4 address before starting Caddy.

In GoDaddy DNS add:

1. `A` record: host `@`, value = VPS public IPv4 address.
2. `CNAME` record: host `www`, value = `@` or the apex hostname.
3. Remove conflicting parked `A`/`AAAA` records for the same host.

Ports 80 and 443 must be open in the VPS firewall. Do not expose MongoDB port 27017 publicly.

## First deployment

```bash
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml exec app node scripts/create-super-admin.mjs
```

Open:

- `https://YOUR_DOMAIN/patient/`
- `https://YOUR_DOMAIN/doctor/`
- `https://YOUR_DOMAIN/admin/login`
- `https://YOUR_DOMAIN/api/health`

The owner creates or approves doctors in Admin. Only an approved doctor's registered mobile number can enter the Doctor workspace. The doctor publishes a daily schedule and token limit; bookings then receive sequential live tokens.

## Updates and backups

Deploy an update with:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Back up both the `sehatline_mongo` and `sehatline_uploads` Docker volumes. Test restores regularly. Keep `.env.production`, database backups and admin credentials outside source control.

## Launch gate

Before accepting real patients, complete security review, privacy policy/consent copy, medical-data retention policy, incident response, backups, monitoring, MSG91 production approval, and the authorised identity-provider integration. Sandbox identity must remain disabled in production.
