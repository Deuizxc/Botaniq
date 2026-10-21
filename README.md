<div align="center">

# 🌱 BotaniQ

**Garden tracking and resource management for the CUAI garden, Quezon City University.**

Plots, crop information, and maintenance tasks in one role-aware workspace.

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

- **Campus welcome** — A growing-plant loader, QCU landing page, and separate login page use the university's supplied seal and garden photograph.
- **Role-aware overview** — Staff see their unfinished tasks and a monthly calendar highlighting only their assigned unfinished work. Admins see team assignments excluding their own, with pending totals by staff.
- **Role-based access** — Administrators manage the garden; staff work their assigned tasks. Every write permission is enforced on the server, not just hidden in the UI.
- **Interactive garden map** — Explore 27 numbered plots with zoom controls, an entrance marker, indoor/outdoor styling, and live occupancy. A personal `!` marks plots with your unfinished tasks. A plot picker also supports small screens and keyboard navigation.
- **Plot overview and editing** — Each plot shows a photo, description, last watering, last harvest, and fertilizer with its application time or None. Admins edit through the pencil button; staff can view every plot.
- **Crop cycles** — Start, assign, harvest, and transplant crops. Each cycle keeps its original plot, planting date, and staff assignment for its whole life.
- **Atomic nursery transplants** — Moving a seedling from the nursery to a plot is a single database transaction. A unique partial index guarantees one live cycle per plot, even under concurrent requests.
- **Dated maintenance tasks** — Schedule watering, fertilizer, hydroponic nutrient, and general maintenance tasks, then assign, reassign, and complete them. Linear task lists have Assigned, Missing, and Done views; admins can schedule with a floating `+` button on phones.
- **Private staff messages** — Staff can send task comments to administrators. Message content is returned only to admins; other staff cannot read it.
- **Task takeover and review** — Staff can take over a colleague's task with a required reason. The original assignee is preserved and the admin dashboard raises a review flag.
- **Weather adjustments** — Watering tasks can be skipped or rescheduled with an explanation. Every change is kept in an audit log, and extra heat-related watering can be added as a new task.
- **Fertilizer records** — Completing a fertilizer or hydroponic task requires a product and records its application time, plot, and recorder in the same transaction. Records appear in plot overview and history; there is no separate nutrient navigation item.
- **Profiles and accounts** — Edit your name, email, or password from the account menu. Admins create or remove accounts. Removal ends access, unassigns pending work and live crops, and retains names on historical records.
- **Notifications and motion** — Toasts confirm actions and announce newly detected assignments or admin messages. Visible sessions check for updates every 30 seconds. Quick page transitions respect reduced-motion preferences.
- **Per-plot history** — Expand dated crop records and saved updates in each plot's History tab. Both roles can search words or tokens such as `crop:"String beans"`, `fertilizer:none`, `before:2026-10-01`, `after:2026-09-01`, and `on:2026-09-20`, plus date-range and fertilizer filters.
- **Manila-time scheduling** — The server computes "today" in `Asia/Manila`, regardless of where it runs.

## Pages and roles

All routes serve the same single-page shell (`index.html`, `css/style.css`, `js/script.js`), so navigation and browser back/forward work without duplicate templates.

| Route | Purpose | Access |
| --- | --- | --- |
| `index.html` | Campus landing page | Public |
| `login.html` | Sign in | Public |
| `admin-dashboard.html` | Team assignments, care totals, notifications | Admin |
| `staff-dashboard.html` | Assigned unfinished tasks and personal calendar | Staff |
| `plot-info.html` | Garden map, plot overview and searchable history (`?id=7` for details) | Signed in; editing is admin-only |
| `edit-plot.html?id=7` | Planting, transplanting, harvest, and staff assignment | Admin |
| `tasks.html` | Dated tasks, assignment, completion, takeover, and weather adjustments | Signed in |
| `inventory.html` | Crop information and new planting cycles | Signed in |
| `nutrients.html` | Compatibility route to maintenance tasks | Signed in |
| `staff.html` | Create and remove accounts | Admin |

Old `archive.html` links open the garden map. The separate archive page and navigation item have been removed.

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

On startup (or the first API request on Vercel), pending migrations run once in a transaction. `001-garden-map.sql` preserves existing plot IDs and crop history, fills missing map positions up to 27, and creates plot snapshots. `002-accounts.sql` adds account removal tracking and renames the original admin to CUIA Admin without changing their email. `003-task-care.sql` adds private task messages and timestamps and task links for fertilizer records. Existing additional plots are retained. The database connection needs permission to create and alter these tables.

On the first run against an empty database the app seeds demo garden data and these accounts. All four initial passwords are `123`:

| Name | Email | Role |
| --- | --- | --- |
| CUIA Admin | `admin@gmail.com` | Admin |
| Heaven Ashley De Paz | `heavenashley@gmail.com` | Staff |
| Brent Andrei Leur Furton | `andreifurton@gmail.com` | Staff |
| John Bernard Bacani | `johntayag@gmail.com` | Staff |

Existing installations replace the four original demo accounts on the next server start or API request. Their record IDs and garden history are retained, and their sessions are revoked. Later password changes are preserved.

Use **Account → Edit profile** to change your password after signing in. New accounts and password changes require 8 to 128 characters. Changing email or password requires your current password and signs out all sessions. The shared initial password `123` is insecure for public use. Password recovery is deferred; no reset email service is configured.

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
    maintenance_tasks ||--o{ task_messages : receives
    users ||--o{ task_messages : sends
```

`cycle_details` is a shared SQL view that joins cycles with their plot, crop, origin plot, and assigned staff.

### Key behaviours

- **History** — Each plot's History tab includes crop cycles, fertilizer applications, and immutable snapshots from every admin detail save, visible to both roles. Historical dates without recorded times are labeled accordingly. The current overview also reflects newer completed watering tasks and fertilizer records.
- **Nursery transplant** — One transaction updates the cycle's current plot, records the transplant date, marks the nursery plot vacant, and marks the destination occupied. Occupied targets, repeated transplants, and harvested cycles are rejected.
- **Takeover review** — The substitute is derived from the signed-in account. The reason, original assignee, and completion time are retained, and marking a takeover as reviewed records the reviewer and time without erasing anything.
- **Scheduling** — Tasks are scheduled explicitly per date and cannot be completed early. There is no recurring scheduler.

### Security

- Scrypt password hashing with unique salts
- Server-side sessions stored as SHA-256 hashes, valid for eight hours, and revoked on password/email change or account removal
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
├── img/                # QCU seal, campus login photo, demo plot photo
├── css/
│   └── style.css       # Responsive interface styles
├── js/
│   ├── script.js       # Client-side app: routing, map, forms, search
│   └── garden.js       # Map geometry, plot facts and history filters
├── migrations/         # Versioned database upgrades
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

The integration suite uses an isolated in-memory PostgreSQL engine (PGlite); it does not need `DATABASE_URL` or modify your live database. It covers role boundaries, history retention, transaction rollback, transplant origin retention, takeover validation, weather history, profiles, password limits, account removal, sessions, private messages, fertilizer completion, sign-in rate limiting, migrations, and plot snapshots. Helper tests cover map geometry, personal assignments, calendar boundaries, notifications, and history searches.

## Roadmap

- [x] Port the integration tests to the PostgreSQL backend
- [ ] Apply `schema.sql` automatically on first start
- [ ] Share the sign-in rate limit across instances
- [ ] Add screenshots and a hosted demo
- [ ] Production hardening, backups, and monitoring

## Out of scope

BotaniQ deliberately does not include pesticide or insecticide task categories, sensor inputs, SMS or email notifications, or measured resource-consumption claims.

## Author

Built by [@Deuizxc](https://github.com/Deuizxc) [@inferism](https://github.com/inferism) for CUAI, Quezon City University.
