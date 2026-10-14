# Deploying the Mizan cloud server

One small Linux server runs the online app, the landing page, the owner
console and the license/sync server for desktops. Caddy in front of it gets
and renews the HTTPS certificate on its own. Count about 30 minutes.

## What you need

| Item                                                  | Suggestion                                                   | Cost               |
| ----------------------------------------------------- | ------------------------------------------------------------ | ------------------ |
| A VPS with Ubuntu 24.04, 2 vCPU, 4 GB RAM, 40 GB disk | Hetzner CX22, Contabo VPS S, OVH VPS                         | about €4–6 / month |
| A domain name                                         | a `.com` from any registrar, or `.dz` via a NIC.dz registrar | €10–15 / year      |
| An SSH client                                         | Terminal (macOS/Linux) or Windows Terminal                   | free               |

2 GB of RAM also works: the install script adds swap for the build.

## 1. Point the domain to the server

At your domain registrar, add a DNS record:

| Type | Name                               | Value                      |
| ---- | ---------------------------------- | -------------------------- |
| A    | `app` (or `@` for the bare domain) | your server's IPv4 address |

Use the full name, e.g. `app.mizan.dz`, in the next step. DNS can take a few
minutes to an hour; the install works before that, HTTPS starts once it
resolves.

## 2. Install

```sh
ssh root@YOUR_SERVER_IP
apt update && apt install -y git cron
git clone https://github.com/ZakariaBrahimi/TayssirSoftware-Electron-App.git /opt/mizan
cd /opt/mizan
sudo ./deploy/install.sh
```

It asks for the domain, an email for certificate notices and your console
username, then:

- installs Docker, opens only SSH, HTTP and HTTPS in the firewall;
- writes `deploy/.env` with a random auth secret and **new license signing keys**;
- builds and starts the app and Caddy;
- creates your console account and prints its password **once**;
- schedules a nightly backup.

**Copy `deploy/.env` to a safe place now** (password manager, encrypted USB).
`LICENSE_PRIVATE_KEY` cannot be recovered: if it is lost, no new license can be
issued; if it is changed, every license already sold stops working.

## 3. First sign-in

1. Open `https://YOUR_DOMAIN/en/platform` and sign in with the printed username and password.
2. Set up two-step verification with an authenticator app (Google Authenticator, Aegis, 1Password…) and keep the backup codes.
3. **Plans**: set the monthly, yearly and license prices.
4. **Website**: payment details (CCP, RIP, RIB), contacts, download link.
5. Open `https://YOUR_DOMAIN/?preview` to check the landing page.

## 4. Connect the desktop app

In GitHub → the repository → Settings → Secrets and variables → Actions:

| Name                 | Kind     | Value                                            |
| -------------------- | -------- | ------------------------------------------------ |
| `LICENSE_PUBLIC_KEY` | Secret   | the `LICENSE_PUBLIC_KEY` line from `deploy/.env` |
| `LICENSE_SERVER_URL` | Variable | `https://YOUR_DOMAIN`                            |

Then publish a release: bump `version` in `apps/desktop/package.json`, commit,
and push a tag such as `desktop-v2.1.0`. The installers appear under GitHub
Releases, which is where the landing page's download button and the
auto-update point by default.

## Everyday operations

All commands run on the server from `/opt/mizan/deploy`.

| Task                                                           | Command                                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Update to the latest code (backup first, migrations automatic) | `sudo ./update.sh`                                                     |
| Backup now and copy backups out of Docker                      | `sudo ./backup.sh`                                                     |
| List backups / restore one                                     | `sudo ./restore.sh` / `sudo ./restore.sh <name or file>`               |
| App logs                                                       | `docker compose logs -f app`                                           |
| Status                                                         | `docker compose ps`                                                    |
| Vendor CLI                                                     | `docker compose exec app node admin.mjs <command>`                     |
| Lost authenticator                                             | `docker compose exec app node admin.mjs platform:2fa-reset <username>` |

## Backups

- The app snapshots its database every day inside the Docker volume (30 kept).
- Every night at 03:30, `backup.sh` takes another snapshot and copies them to
  `/opt/mizan/deploy/backups` (30 kept), so they survive the loss of the volume.
- For copies off the server (recommended), install rclone
  (`apt install rclone`), run `rclone config` to add e.g. Backblaze B2 or
  Google Drive, and set `RCLONE_REMOTE=remote:folder` in `deploy/.env`.
- Also turn on your VPS provider's server snapshots if offered (about 20% of the server price).

Restoring replaces the whole database (every shop) with the chosen copy; the
replaced one is kept as a `pre-restore` backup.

## Moving to another server

On the new server, run the install with the same domain, then before
signing up anyone:

```sh
cp /safe/place/.env /opt/mizan/deploy/.env    # same keys and secret
sudo ./deploy/install.sh                      # keeps the existing .env
sudo ./deploy/restore.sh /path/to/latest.db   # a file from deploy/backups
```

Then point the DNS record to the new IP.
