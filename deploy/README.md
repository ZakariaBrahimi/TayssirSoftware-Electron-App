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
To pay nothing, use the free Oracle Cloud server described next, with a free
DuckDNS address until you buy a domain.

## Free option: an Oracle Cloud server

Oracle Cloud's "Always Free" tier includes an ARM server (up to 4 CPUs,
24 GB of memory, 200 GB of disk) that stays free with no time limit and may
be used commercially. Mizan's image is tested on ARM, and `install.sh`
handles Oracle's firewall. If you use it, follow these steps instead of
"What you need", then continue at step 1 below.

**Create the account**

1. Sign up at <https://signup.cloud.oracle.com>. A card is asked for to check
   your identity; Always Free resources are not charged. If one card is
   refused, try another (an international Visa or Mastercard usually works).
2. Choose the **home region** carefully: it cannot be changed, and the free
   ARM server only exists there. Close to Algeria: _France South (Marseille)_,
   _Spain Central (Madrid)_ or _Italy North (Milan)_.

**Create the server**

1. Menu → Compute → Instances → **Create instance**.
2. Image: **Canonical Ubuntu 24.04**.
3. Shape: **Change shape** → Ampere → **VM.Standard.A1.Flex**, 2 OCPUs and
   12 GB of memory (enough for Mizan; the free tier allows up to 4 and 24).
4. Networking: create a new virtual cloud network with a **public subnet**
   and keep **Assign a public IPv4 address** on.
5. SSH keys: **Save private key** (keep this file; it is the only way in).
6. Boot volume: 100 GB is plenty. Create.

"Out of capacity for shape VM.Standard.A1.Flex" means the free ARM servers in
that zone are taken: pick another availability domain, try 1 OCPU / 6 GB, or
retry later (early morning often works).

**Open HTTP and HTTPS in Oracle's network**

Oracle blocks everything but SSH at the network level too:

1. Open the instance → its subnet → **Default Security List** → **Add Ingress Rules**.
2. Source CIDR `0.0.0.0/0`, IP protocol **TCP**, destination port **80** → Add.
3. Same again for TCP port **443**.

(The firewall inside the server is opened by `install.sh`.)

**Connect**

```sh
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@PUBLIC_IP
sudo -i        # the install commands below run as root
```

On Windows, use the same command in PowerShell.

**Keep it from being reclaimed**

Oracle may reclaim free servers that stay almost idle for a week. To avoid
that, upgrade the account to **Pay As You Go** (Billing → Upgrade): Always Free
resources stay free, and you can add a budget alert of $1 to be warned of any
charge.

**No domain yet? Use DuckDNS (free)**

1. Sign in at <https://www.duckdns.org>, add a subdomain (e.g. `mizan`) and
   set its IP to the server's public IP.
2. Use `mizan.duckdns.org` as the domain in `install.sh`.

Buy your real domain before you release the desktop app: installed desktops
keep the server address they were built with (see "Changing servers" below).

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
- For copies off the server (recommended), use rclone with free storage.
  With **Backblaze B2** (10 GB free):
  1. Create an account at <https://www.backblaze.com/b2>, a private bucket
     (e.g. `mizan-backups`) and an application key limited to that bucket.
  2. On the server: `apt install -y rclone`, then `rclone config` →
     `n` (new) → name `b2` → storage `b2` → paste the key ID and key → defaults.
  3. In `deploy/.env`, set `RCLONE_REMOTE=b2:mizan-backups`, then run
     `sudo ./backup.sh` once to check.

  Google Drive, Oracle Object Storage or any S3-compatible storage work the
  same way (`rclone config` lists them).

- Also turn on your VPS provider's server snapshots if offered (about 20% of the server price).

Restoring replaces the whole database (every shop) with the chosen copy; the
replaced one is kept as a `pre-restore` backup.

## Changing servers

You can move to another server or provider at any time. Three things must
come with you:

| Keep              | Why                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| The **domain**    | Web users and desktops reach the server by it; desktops have it built in.                                       |
| **`deploy/.env`** | A new `LICENSE_PRIVATE_KEY` would invalidate every license sold; a new `BETTER_AUTH_SECRET` signs everyone out. |
| The **database**  | Every shop's data: take it with `backup.sh`, put it back with `restore.sh`.                                     |

Desktops keep selling offline during the move and sync again afterwards. A
day before, lower the DNS record's TTL to 5 minutes so the switch is quick.

### Moving to another server

On the new server, run the install with the same domain, then before
signing up anyone:

```sh
cp /safe/place/.env /opt/mizan/deploy/.env    # same keys and secret
sudo ./deploy/install.sh                      # keeps the existing .env
sudo ./deploy/restore.sh /path/to/latest.db   # a file from deploy/backups
```

Then point the DNS record to the new IP, check the app, and only then shut the old server down.
