#!/usr/bin/env bash
# First-time setup of a Mizan cloud server on Ubuntu or Debian.
# Run from a checkout of the repository:  sudo ./deploy/install.sh
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo ./deploy/install.sh"; exit 1; }

say "Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null

# Building the app needs about 2 GB of memory: add swap on small servers.
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 3000000 ] && ! swapon --show | grep -q .; then
  say "Adding a 2 GB swap file (small server)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if command -v ufw >/dev/null 2>&1; then
  say "Firewall: SSH, HTTP and HTTPS only"
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443 >/dev/null
  ufw --force enable >/dev/null
elif command -v netfilter-persistent >/dev/null 2>&1; then
  # Oracle Cloud images: saved iptables rules reject everything but SSH.
  # Open HTTP and HTTPS above that reject rule (ufw is not used there).
  say "Firewall: opening HTTP and HTTPS"
  for rule in "-p tcp --dport 80" "-p tcp --dport 443" "-p udp --dport 443"; do
    # shellcheck disable=SC2086
    if ! iptables -C INPUT -m state --state NEW $rule -j ACCEPT 2>/dev/null; then
      pos=$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" {print $1; exit}')
      # shellcheck disable=SC2086
      if [ -n "$pos" ]; then
        iptables -I INPUT "$pos" -m state --state NEW $rule -j ACCEPT
      else
        iptables -A INPUT -m state --state NEW $rule -j ACCEPT
      fi
    fi
  done
  netfilter-persistent save >/dev/null
fi

first_install=false
if [ ! -f .env ]; then
  first_install=true
  say "Configuration"
  read -rp "Domain for the app (e.g. app.mizan.dz): " DOMAIN
  read -rp "Email for HTTPS certificate notices: " ACME_EMAIL
  read -rp "Your username for the owner console [owner]: " ADMIN
  ADMIN=${ADMIN:-owner}
  umask 077
  sed -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" \
      -e "s|^ACME_EMAIL=.*|ACME_EMAIL=${ACME_EMAIL}|" \
      -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" \
      -e "s|^PLATFORM_ADMINS=.*|PLATFORM_ADMINS=${ADMIN}|" \
      .env.example > .env

  say "Building the app (a few minutes)"
  docker compose build app

  say "Generating the license signing keys"
  keys=$(docker compose run --rm --no-deps app node admin.mjs keys:generate | grep '^LICENSE_')
  priv=$(printf '%s\n' "$keys" | sed -n 's/^LICENSE_PRIVATE_KEY=//p')
  pub=$(printf '%s\n' "$keys" | sed -n 's/^LICENSE_PUBLIC_KEY=//p')
  sed -i -e "s|^LICENSE_PRIVATE_KEY=.*|LICENSE_PRIVATE_KEY=${priv}|" \
         -e "s|^LICENSE_PUBLIC_KEY=.*|LICENSE_PUBLIC_KEY=${pub}|" .env
fi

domain=$(sed -n 's/^DOMAIN=//p' .env)
server_ip=$(curl -fsS4 https://api.ipify.org 2>/dev/null || true)
dns_ip=$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1 {print $1}')
if [ -n "$server_ip" ] && [ "$dns_ip" != "$server_ip" ]; then
  echo "Warning: ${domain} points to '${dns_ip:-nothing}', this server is ${server_ip}."
  echo "HTTPS will start working once the DNS A record points here."
fi

say "Starting"
docker compose up -d --build
for _ in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)")" = healthy ] && break
  sleep 2
done

if $first_install; then
  say "Creating your console account"
  password=$(openssl rand -base64 18)
  docker compose exec -T app node admin.mjs platform:admin "$ADMIN" --name "$ADMIN" --password "$password" >/dev/null
fi

say "Daily off-volume backup (03:30)"
script="$(pwd)/backup.sh"
if command -v crontab >/dev/null 2>&1; then
  { crontab -l 2>/dev/null | grep -vF "$script" || true
    echo "30 3 * * * $script >> /var/log/mizan-backup.log 2>&1"; } | crontab -
else
  echo "cron is not installed: run $script daily yourself (apt install cron, then re-run install.sh)."
fi

say "Done"
echo "App:      https://${domain}"
echo "Console:  https://${domain}/en/platform"
if $first_install; then
  echo "Username: ${ADMIN}"
  echo "Password: ${password}   (shown once; you will set up an authenticator app at first sign-in)"
  echo
  echo "Keep a copy of deploy/.env somewhere safe: without LICENSE_PRIVATE_KEY no new"
  echo "license can be issued, and changing it invalidates every existing one."
  echo "Put LICENSE_PUBLIC_KEY in the GitHub secret of the same name for desktop builds:"
  sed -n 's/^LICENSE_PUBLIC_KEY=/  /p' .env
fi
