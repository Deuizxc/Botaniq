# BotaniQ redesign verification

## October 23 reference update

- Applied the supplied landing, login, logo, and flower-header assets while retaining the existing navigation.
- Missing tasks display directly and cannot be completed or taken over through either the UI or API. Admin task details show staff weather observations, with no completion or adjustment buttons.
- Admins can filter tasks by staff or view all assignments, and the atlas has an unfinished-task sidebar. Selected maps support pointer dragging and arrow-key panning; deselection resets the view.
- Both roles can type crop names or varieties into the catalog dropdown. Crop uniqueness now uses the trimmed, case-insensitive name/variety pair; migration 004 preserves plants and cycle references.
- Browser checks used an isolated in-memory database: public pages, both overviews, missing-task actions, admin filtering, crop search, weather adjustment delivery from staff to admin, map dragging/reset, accounts, and phone-width tasks/map. No console errors or horizontal overflow were observed in those checks.
- `npm test`: **31 passed, 0 failed**. Coverage includes page rendering, static asset routes, missing-task rejection, same-name varieties, and migration preservation. JavaScript syntax checks and `git diff --check` also pass. Production deployment was not checked.

## Previous verification

Verified locally on October 22, 2026 using an isolated PGlite demo database. No production records were changed during testing.

## Delivered

- Growing-plant loader, QCU landing page, separate login page, original BotaniQ mark, and the supplied campus photograph with a green overlay.
- Overview → Maintenance tasks → Garden plots navigation; Crop information replaces the inventory label; the separate nutrient navigation item is removed.
- Staff unfinished-task calendar and personal map alerts; admin team assignments exclude the signed-in admin's tasks.
- Assigned / Missing / Done task lists, expandable task details, mobile admin scheduling button, and private staff-to-admin messages.
- Fertilizer task completion records the product and application timestamp atomically, then displays them in plot overview and history.
- Edit profile menu, eight-character minimum for new passwords, account removal with historical attribution retained, and CUIA Admin naming.
- Action toasts, periodic notification toasts, quick transitions, and reduced-motion support.

Password recovery was explicitly deferred by the user.

## Checks

- `npm test`: **26 passed, 0 failed**. Covers authorization, private-message visibility, profile changes, removal/session revocation, fertilizer transactions, migrations, history, calendar boundaries, map assignments, and existing garden workflows.
- `node --check`: backend and both frontend JavaScript modules pass.
- Browser workflow: landing/login, navigation order, profile menu, task scheduling, calendar filtering, comment delivery, fertilizer completion/history, per-staff map isolation, zoom, mobile scheduling, account creation/removal. No browser errors or mobile page overflow.
- Timed notification check: an admin assigned a new task while a staff workspace stayed open; its notification toast arrived on the next poll. Mobile profile menu and edit dialog were also captured and checked.
- Responsive inspector: landing, login, both overviews, tasks, map, selected plot, crop information, and accounts checked at **1440, 768, and 390 pixels**. Final reports have **0 failures**; identified contrast and small-text issues were corrected.
- Source design lint: **0 failures, 23 warnings**. Warnings include inherited label class names, map depth effects and genuine overlay shadows, the dialog backdrop, and the requested growing plant's scale animation.

Local screenshots and browser scripts are retained in ignored `.taste-skill/`. They are development evidence and are not shipped with the app.

## Design decisions and critique

Public direction: `page-is-the-object`, seed **328016410**. App direction: `editorial-greeting`, seed **1716569097**. Existing forest/olive colors and system typography remain; the public heading uses Georgia.

The supplied compact landing reference takes precedence over the skill's four-photo requirement. The single campus photo is intentional (`--allow few-pictures`); no footage was supplied. Motion remains quick rather than adding persistent decorative animation. The login's larger heading belongs to its public welcome layout. Staff calendars use sage highlights for actual task dates. Mobile crop records use labeled rows, so their counts intentionally align with the text rather than a desktop numeric column. Admin assignment and team panels retain content-dependent heights.

### ROUND 1

Seen in one second: a green garden workspace with a disconnected login form.

Idea: bring the university's garden identity into the entry pages and put assigned care first inside the app.

Live thing: sign in and act on actual garden tasks.

Layout words by section: login=split / overview=metrics-and-list / tasks=table.

Scores: design 6 · usability 6 · creativity 6 · content 7 → overall 6.1.

Caps applied: initial login inspector had 2 failures, so overall **6.0**.

Top three problems, screenshots and fixes:

1. `before/desktop-fold.jpg`: disconnected plain login; use the supplied campus photo and QCU identity.
2. `after-staff/mobile-page-01.jpg`: small, pale labels; raise text sizes and contrast.
3. `after-tasks/desktop-page-01.jpg`: task scan path too wide; cap board width and collapse empty groups.

### ROUND 2

Seen in one second: a campus welcome sign outside, today's garden care inside.

Idea: keep QCU's garden visible while making each person's next task easy to find.

Live thing: complete assigned care, filter the calendar, inspect plots, and message the admin.

Layout words by section: landing=split-heading-and-photo / login=split / overview=metrics-and-queue / tasks=linear-list / map=atlas / crops=table-to-labeled-rows.

Scores: design 7 · usability 8 · creativity 7 · content 7 → overall **7.3**.

Caps applied: the public single-photo design is a user-reference exception. Existing demo plot photographs remain placeholders; plot-screen content is capped at 5, giving that screen an overall **7.1**.

Top three problems, screenshots and fixes:

1. `final-crops/mobile-page-01.jpg`: table notes required horizontal scrolling; replaced with labeled mobile rows (`verified-crops/mobile-page-01.jpg`).
2. `final-map/mobile-page-01.jpg`: tiny plot numbers and excess vertical space; enlarged numbers and shortened the map viewport (`verified-map/mobile-page-01.jpg`).
3. `verified-plot/desktop-page-01.jpg`: heavy inspector shadow; reduced it and improved tab/caption contrast (`final-plot/desktop-page-01.jpg`).

Remaining limits: this is a coherent update to the existing system, not a 7.5+ gallery redesign. The existing demo plot photo needs real plot photography; the dense 27-space map still benefits from its picker and zoom on phones. These do not block the requested workflows.

## Release notes

Pending migrations run on startup or the first API request. Existing data is preserved. Account removal keeps the person's name on historical records, removes their credentials/contact email, and unassigns pending tasks and live crops.

Production deployment and live database migration were not exercised. Existing demo passwords remain `123`; new/changed passwords use the new 8–128 character policy. Change demo credentials before public use. Notifications check every 30 seconds while the workspace is visible and no modal is open; they are not browser push notifications.
