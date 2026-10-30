# Tala Eats Repartidores — RC141 release plan (Kali, 18199 ONLY)

## Important scope and status
This document **prepares** deployment. It does not execute it. No PM2/Node,
Stripe, PostgreSQL, Clientes 18195, Restaurantes 18197, Cloudflared or existing
Nginx config may be modified by the RC141 static release.

- GitHub: `feat/rc141-driver-native-ux-resilience-20261029`, PR #24.
- Site: `https://repartidores-talaeats.alan-palacios-dev.com/repartidor/acceso`.
- Static release source: `/home/tala-node-stage/tala-eats-web-releases/<WEB_SHA40>`.
- Static target: `/srv/talaeats-repartidores-pwa/releases/<WEB_SHA40>`.
- Serving process: existing `talaeats-repartidores-pwa.service`, Nginx port 18199.
- Rollback: existing `deploy/kali-update-repartidores-isolated.sh --rollback`.
- No real-order E2E claimed by CI; no server financial flags changed.

## Security acceptance gate

The Nginx template in `deploy/nginx-repartidores-isolated-server.conf`
corrects the inherited-header bug: locations with their own `add_header`
must explicitly include CSP, no-referrer, nosniff, frame protections,
permissions policy, and noindex. The CSP permits `blob:` image previews
prepared locally on mobile. **This template is NOT automatically installed
by the static updater.** Never assume headers were hardened merely because
the static deploy passed.

Before deployment, execute read-only checks:

```bash
sudo bash /home/tala-node-stage/tala-eats-web-releases/<WEB_SHA40>/deploy/rc141-kali-driver-security-audit.sh --audit
sudo bash /home/tala-node-stage/tala-eats-web-releases/<WEB_SHA40>/deploy/rc141-kali-driver-security-audit.sh --public
```

The currently installed Nginx configuration may legitimately report
`RC141_SECURITY=HOLD_...` before we apply the new security template. This is
a security finding, not a reason to restart the portal or ignore the header gap.

After the exact SHA build and main/driver health preflight are PASS, the
separate **driver-only headers** tool provides a safe, isolated
`--plan` / `--apply` / `--rollback` path. It validates the exact Nginx
master PID and config identity, preserves a root-only backup outside the
served directory, installs `root:www-data 0640`, performs `nginx -t` as
`www-data`, sends HUP **only** to the active 18199 service and runs the
HTTP security audits. It automatically restores the prior config on a HOLD.

```bash
WEB_SHA='<WEB_SHA40>'
HDR="/home/tala-node-stage/tala-eats-web-releases/$WEB_SHA/deploy/rc141-kali-driver-headers-18199.sh"
sudo bash "$HDR" --plan "$WEB_SHA"
# Only after a PASS and explicit operator consent, activate headers:
sudo bash "$HDR" --apply "$WEB_SHA" I_APPROVE_RC141_DRIVER_HEADERS_18199_ONLY
# Separate recovery command if needed:
sudo bash "$HDR" --rollback "$WEB_SHA" I_APPROVE_RC141_DRIVER_HEADERS_ROLLBACK
```

**Never run --rollback after a failed --apply if the script already restored
the previous config.** Do not change `/etc/talaeats-web-pwa`, the 18195
service or any other PWA. Successful status is
`RC141_SECURITY_READ_ONLY=PASS` in both local and public audits.

## Phase 1: pinned checkout and isolated build (service user, no LIVE writes)

Replace `<WEB_SHA40>` with the last reviewed GitHub commit on PR #24.
Never build an unpinned `main` or assume a PR branch itself is deployed.
The helper `deploy/rc138-kali-build-driver-only.sh` clones the specified
SHA to the correct path, runs `npm test`, and builds
**only** `dist-repartidores`. It fails if that target already exists.

A practical bootstrap from the operator account:

```bash
WEB_SHA='<WEB_SHA40>'
REPO='https://github.com/AlanPalacios23/tala-eats-version-web.git'
STAGE="/home/tala-node-stage/tala-eats-rc141-bootstrap-$WEB_SHA"
sudo -H -u tala-node-stage git clone --no-checkout "$REPO" "$STAGE"
sudo -H -u tala-node-stage git -C "$STAGE" fetch origin "$WEB_SHA"
sudo -H -u tala-node-stage git -C "$STAGE" checkout --detach "$WEB_SHA"
test "$(sudo -H -u tala-node-stage git -C "$STAGE" rev-parse HEAD)" = "$WEB_SHA"
sudo -H -u tala-node-stage bash "$STAGE/deploy/rc138-kali-build-driver-only.sh" "$WEB_SHA"
```

The SHA-specific build tool requires the service user's HOME and Node 22/24.
Never turn on `VITE_DRIVER_ACTIONS_ENABLED`,
`VITE_CASH_HANDOFF_V2_ENABLED`, or
`VITE_FINANCE_WALLET_V2_ENABLED` to force a release.

## Phase 2: readonly source + live backend identity preflight

```bash
WEB_SHA='<WEB_SHA40>'
WORK="/home/tala-node-stage/tala-eats-web-releases/$WEB_SHA"
sudo -H -u tala-node-stage bash "$WORK/deploy/rc138-kali-driver-live-preflight.sh" --detect-backend
```

Take only the 40-character `DRIVER_RC138_CURRENT_LIVE_BACKEND_SHA`
from the output and set `BACK_SHA`; avoid printing PM2 JSON or LIVE env files.
Then:

```bash
BACK_SHA='<EXACT_RUNNING_BACKEND_SHA40>'
sudo bash "$WORK/deploy/rc138-kali-driver-deploy.sh" --plan "$WEB_SHA" "$BACK_SHA"
```

The plan MUST emit `DRIVER_RC138_PLAN=PASS_EXACT_BACKEND_AND_STATIC_PRECHECK`.
If `HOLD` appears, stop. The plan checks role/auth guards, live health,
Postgres/worker readiness, build, pinned SHA and no accidental real-order writes.

## Phase 3: optional operator-approved static-only deployment

Only after CI PASS, exact `--plan` PASS, and the security review:

```bash
sudo bash "$WORK/deploy/rc138-kali-driver-deploy.sh" --apply "$WEB_SHA" "$BACK_SHA" I_APPROVE_DRIVER_RC138_STATIC_ONLY
```

The existing updater backs up the current static release then atomically
switches ONLY `/srv/talaeats-repartidores-pwa/current`. There is **no
Nginx config edit, restart or reload** in this static step. The postflight
checks live PM2 identity and exact served HTML at localhost and public HTTPS.

If postflight fails, the wrapper attempts a **driver-static-only** rollback.
Read its output and verify the current symlink before any retry. If necessary:

```bash
sudo bash "$WORK/deploy/kali-update-repartidores-isolated.sh" --rollback I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY
```

## Phase 4: QA on real devices (not a simulated financial go-live)

- Android Chrome: eligible browser opens installation confirmation only on
  the driver's click, app icon opens the independent `/repartidor` PWA.
- iOS Safari: Share -> Add to Home Screen, user confirms; no automatic install API.
- Login/registration roles and plate/document upload, private image previews.
- Profile/available offers/active delivery, GPS accuracy, foreground-only
  presence, paused state, hidden-screen PIN clearing, network recovery.
- Test an actual customer -> restaurant -> driver E2E only after all backend
  LIVE financial and dispatch preflight gates pass, using real account consent.
- Confirm main Customers `https://web-talaeats.alan-palacios-dev.com/clientes`
  and Restaurants `https://restaurantes-talaeats.alan-palacios-dev.com/restaurante`
  remain HTTP 200 after the isolated driver static switch.

Do not call the release complete if `RC141_SECURITY=HOLD`, if the backend
cannot authorize financial operations, or if no real delivery has been proved.
