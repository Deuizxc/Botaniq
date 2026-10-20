<div align="center">

# 🌱 BotaniQ

**Garden tracking and resource management for the CUAI garden, Quezon City University.**

Plots, crop cycles, maintenance tasks, and nutrient logs in one role-aware workspace.

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![Status](https://img.shields.io/badge/status-pilot-2e7d32)

[Features](#features) · [Getting Started](#getting-started) · [Deployment](#deployment) · [Architecture](#architecture) · [Roadmap](#roadmap)

</div>

<!-- Add a screenshot of the admin dashboard to /assets and uncomment:
<p align="center"><img src="assets/dashboard.png" alt="BotaniQ admin dashboard" width="860"></p>
-->

---

## Overview

BotaniQ is a database-driven web application for managing the Center for Urban Agriculture and Innovation (CUAI) garden at Quezon City University. It replaces ad hoc notes with a single source of truth for what is planted where, who is responsible for it, and what care it needs today.

The app is intentionally lightweight: a vanilla HTML/CSS/JavaScript front end served by a small Node.js HTTP backend on top of PostgreSQL. There is no front-end framework and no build step.

> **Note:** Seeded crops, plots, and tasks are fictional demonstration records.

## Features

- **Role-based access** — Administrators manage the garden; staff work their assigned tasks. Every write permission is enforced on the server, not just hidden in the UI.
- **Plot management** — Track outdoor, greenhouse, and nursery plots with live occupancy status (`Vacant`, `Occupied`, `Harvested`).
- **Crop cycles** — Start, assign, harvest, and transplant crops. Each cycle keeps its original plot, planting date, and staff assignment for its whole life.
- **Atomic nursery transplants** — Moving a seedling from the nursery to a plot is a single database transaction. A unique partial index guarantees one live cycle per plot, even under concurrent requests.
- **Dated maintenance tasks** — Schedule watering, fertilizer, hydroponic nutrient, and general maintenance tasks, then assign, reassign, and complete them.
- **Task takeover and review** — Staff can take over a colleague's task with a required reason. The original assignee is preserved and the admin dashboard raises a review flag.
- **Weather adjustments** — Watering tasks can be skipped or rescheduled with an explanation. Every change is kept in an audit log, and extra heat-related watering can be added as a new task.
- **Nutrient logging** — Fertilizer and hydroponic nutrient applications are recorded by date, product, plot, and recorder.
- **Six-week history** — Active and recent cycles stay in the working view, while older harvests move to an admin-only, read-only archive. This is a date filter, so no background job or row migration is needed.
- **Manila-time scheduling** — The server computes "today" in `Asia/Manila`, regardless of where it runs.

## Pages and roles

All routes serve the same single-page shell (`index.html`, `css/style.css`, `js/script.js`), so navigation and browser back/forward work without duplicate templates.

| Route | Purpose | Access |
| --- | --- | --- |
| `index.html` | Sign-in and role-aware overview | Public |
| `admin-dashboard.html` | Plot overview, today's care list, takeover review | Admin |
| `staff-dashboard.html` | Assigned tasks and recent crop history | Staff |
| `plot-info.html` | Search and filter plots (`?id=7` for details) | Signed in |
| `edit-plot.html?id=7` | Planting, transplanting, harvest, and staff assignment | Admin |
| `tasks.html` | Dated tasks, assignment, completion, takeover, and weather adjustments | Signed in |
| `inventory.html` | Crop catalog and new planting cycles | Signed in |
| `nutrients.html` | Fertilizer and hydroponic nutrient log | Signed in |
| `staff.html` | Create accounts, activate or deactivate access | Admin |
| `archive.html` | Read-only archive of older crop cycles | Admin |

## Tech stack

| Layer | Technology |
| --- | --- |
| Front end | Vanilla HTML, CSS, and JavaScript (ES modules) |
| Back end | Node.js (`node:http`), no web framework |
| Database | PostgreSQL via [`pg`](https://node-postgres.com/) |
| Auth | Scrypt password hashing, server-side sessions, `HttpOnly` cookies |
| Hosting | Local Node server or Vercel serverless function |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- A PostgreSQL database (local or hosted) with the `citext` extension available

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Deuizxc/Botaniq.git
cd Botaniq

# 2. Install dependencies
npm install

# 3. Point the app at your database
export DATABASE_URL="postgres://user:password@localhost:5432/botaniq"

# 4. Create the tables (run once)
psql "$DATABASE_URL" -f schema.sql

# 5. Start the server
npm start
```

Then open **http://localhost:3000**. Do not open `index.html` directly, because sign-in and records need the server.

On the first run against an empty database the app seeds demo garden data and these accounts. All four initial passwords are `123`:

| Name | Email | Role |
| --- | --- | --- |
| Admin Admin | `admin@gmail.com` | Admin |
| Heaven Ashley De Paz | `heavenashley@gmail.com` | Staff |
| Brent Andrei Leur Furton | `andreifurton@gmail.com` | Staff |
| John Bernard Bacani | `johntayag@gmail.com` | Staff |

Existing installations replace the four original demo accounts on the next server start or API request. Their record IDs and garden history are retained, and their sessions are revoked. Later password changes are preserved.

Use the account button at the top right to change your password after signing in. New accounts and password changes still require 12 to 128 characters. The shared initial password `123` is insecure for public use.

### Environment variables

| Variable | Required | Description |
| --- | :---: | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. SSL is enabled automatically unless the URL contains `localhost`. |
| `PORT` | No | Local server port. Defaults to `3000`. |
| `COOKIE_SECURE` | No | Set to `true` behind HTTPS to mark session cookies as `Secure`. |

The local server binds to `127.0.0.1` only.

## Deployment

The repository is set up for [Vercel](https://vercel.com/):

- `api/index.js` exposes the backend as a serverless function.
- `vercel.json` rewrites `/api/*` to that function and maps each page route to `index.html`.

To deploy:

1. Provision a hosted PostgreSQL database and run `schema.sql` against it.
2. Import the repository into Vercel.
3. Add `DATABASE_URL` as an environment variable.
4. Deploy.

For a persistent-server deployment instead, run `npm start` behind a trusted HTTPS reverse proxy and set `COOKIE_SECURE=true`. Replace the demo accounts and data before real use.

## Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>index.html · css · js"] -->|"fetch /api/*"| Backend["backend.js<br/>auth · rules · API"]
    Backend -->|"pg pool"| DB[("PostgreSQL")]
    Vercel["api/index.js<br/>Vercel function"] --> Backend
```

### Data model

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ crop_cycles : "assigned to"
    users ||--o{ maintenance_tasks : "assigned to"
    users ||--o{ nutrient_logs : records
    plants ||--o{ crop_cycles : grown_as
    plots ||--o{ crop_cycles : hosts
    plots ||--o{ maintenance_tasks : needs
    plots ||--o{ nutrient_logs : receives
    maintenance_tasks ||--o{ task_adjustments : audited_by
```

`cycle_details` is a shared SQL view that joins cycles with their plot, crop, origin plot, and assigned staff.

### Key behaviours

- **Six-week history** — `harvest_date IS NULL OR harvest_date >= today - 42 days` selects active and recent cycles. Older harvested cycles are archived and only returned to admins. Cycles are immutable through the app once harvested.
- **Nursery transplant** — One transaction updates the cycle's current plot, records the transplant date, marks the nursery plot vacant, and marks the destination occupied. Occupied targets, repeated transplants, and harvested cycles are rejected.
- **Takeover review** — The substitute is derived from the signed-in account. The reason, original assignee, and completion time are retained, and marking a takeover as reviewed records the reviewer and time without erasing anything.
- **Scheduling** — Tasks are scheduled explicitly per date and cannot be completed early. There is no recurring scheduler.

### Security

- Scrypt password hashing with unique salts
- Server-side sessions stored as SHA-256 hashes, valid for eight hours, and revoked on password change or account deactivation
- `HttpOnly`, `SameSite=Strict` session cookies
- Cross-origin write rejection, JSON-only request bodies, and a 16 KB request size limit
- Strict Content Security Policy, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: same-origin`
- Sign-in rate limiting (10 attempts per 15 minutes)

> The sign-in rate limiter is per process. Multi-instance load testing and public production hosting have not been completed.

## Project structure

```text
Botaniq/
├── api/
│   └── index.js        # Vercel serverless entry point
├── assets/             # Images and screenshots
├── css/
│   └── style.css       # Responsive interface styles
├── js/
│   └── script.js       # Client-side app: routing, forms, search
├── test/
│   └── app.test.js     # Integration tests
├── backend.js          # HTTP server, auth, API, business rules
├── index.html          # Single-page application shell
├── schema.sql          # Tables, constraints, indexes, cycle_details view
├── vercel.json         # Rewrites for API and page routes
└── package.json
```

## Testing

Run the focused account seed and replacement checks (using a mock database client):

```bash
node --test test/accounts.test.js
```

Run the full suite:

```bash
npm test
```

The integration suite in `test/app.test.js` covers role boundaries, the exact six-week cutoff, transaction rollback, transplant origin retention, takeover validation, weather history, password changes, session revocation, and sign-in rate limiting.

> **Heads up:** the suite was written for the earlier SQLite version of the backend and still imports `server.js`. It needs to be ported to the PostgreSQL `backend.js` before it will run (see [Roadmap](#roadmap)).

## Roadmap

- [ ] Port the integration tests to the PostgreSQL backend
- [ ] Apply `schema.sql` automatically on first start
- [ ] Share the sign-in rate limit across instances
- [ ] Add screenshots and a hosted demo
- [ ] Production hardening, backups, and monitoring

## Out of scope

BotaniQ deliberately does not include pesticide or insecticide task categories, sensor inputs, SMS or email notifications, or measured resource-consumption claims.

## Author

Built by [@Deuizxc](https://github.com/Deuizxc) [@inferism](https://github.com/inferism) for CUAI, Quezon City University.
