# RC142 — Driver live-map pilot: isolated 18199 deployment

## Status and constraints
This PR adds a browser-side live GPS map and backend-authorized pickup offers to
the already deployed RC141. It is **not deployed** by merging code or running CI.
Driver LIVE active flags remain backend-authoritative. The frontend does not
turn on dispatch, cash/card payments, connected-account transfers or withdrawals.

**Map limitation:** current Node driver API has a POST `/driver/orders/:id/accept`
but no verified POST reject endpoint. `Descartar` only hides an offer in the
current driver map session; it does not reject, cancel, unassign, or notify the
server. To implement server-recorded rejection requires a separately reviewed
backend API and immutable dispatch audit.

## Tile data and privacy
- Leaflet 1.9.4 is bundled locally; raster tiles come from
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- Map visible only while authenticated driver is server-confirmed ONLINE.
  GPS `watchPosition` runs only while tab is visible; no GPS persistence
  or extra location writes. Existing heartbeat remains unchanged.
- The provider sees the **viewport tiles requested**, which can roughly reveal
  the user's area. Only public merchant coordinates are placed in offer pins;
  customer addresses are never sent or placed on the pre-acceptance map.
- OSM attribution is kept visible and `referrerPolicy` on tile images is
  `strict-origin-when-cross-origin` while all other requests retain
  `no-referrer`.
- This is a **small-pilot, best-effort** provider. No offline tile prefetch,
  service-worker caching, bulk tile fetching, guaranteed uptime or production
  SLA. Evaluate a commercial tile host with formal limits as usage grows.
  Policy: https://operations.osmfoundation.org/policies/tiles/

## QA and approval gates
1. On the PR head commit: GitHub PWA CI PASS, Repartidores mobile QA PASS,
   and no regressions to Clientes.
2. Build exact pinned SHA using existing
   `deploy/rc138-kali-build-driver-only.sh`; it builds only
   `dist-repartidores`.
3. Use service-user `--detect-backend` and the existing
   `deploy/rc138-kali-driver-deploy.sh --plan <WEB_SHA> <BACK_SHA>` gate.
4. Run `deploy/rc141-kali-driver-headers-18199.sh --plan <WEB_SHA>`
   and inspect diffs: only driver CSP is expanded for
   `img-src https://tile.openstreetmap.org`. Reuse the separately approved
   `--apply` gate to activate the 18199-only config before the static
   deployment. **Never touch the 18195/18197 Nginx services.** RC142 changes the
   Nginx config's permissions to root:root 0644, avoiding the RC141
   service-user read failure; its backup is still root-only 0600.
5. Run `deploy/rc141-kali-driver-security-audit.sh --audit` and
   `--public`; both must PASS before the static switch.
6. Publish only via the existing
   `deploy/rc138-kali-driver-deploy.sh --apply <WEB_SHA> <BACK_SHA>
   I_APPROVE_DRIVER_RC138_STATIC_ONLY` wrapper; it backs up prior files,
   swaps `current` atomically, and verifies public/pinned release.
7. Mobile QA: toggle online OFF → ON, request GPS access, confirm true
   local GPS marker, decline OS permission (fallback visible); offer with
   public merchant coords gets a marker, missing coords remains a card;
   tap offer/accept; use Descarta to hide only locally; background app stops
   GPS tracking; return foreground resumes; test 320/360/390/430dp and iOS.
8. Make sure RC141 previous symlink and original 18199 config backup are
   retained for independent rollback paths. **Never attempt automatic backend
   migrations, API flags, or real-money tests as part of the static release**.

A successful static deployment is **not proof of real orders or payouts**.
If the exact backend remains disabled for dispatch, the new map correctly
shows GPS and a disabled/empty offer state; no simulated orders are inserted.
