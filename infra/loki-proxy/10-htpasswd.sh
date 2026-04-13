#!/bin/sh
# Generates /tmp/.htpasswd from LOKI_USER / LOKI_PASSWORD env vars before
# nginx starts. Runs from /docker-entrypoint.d/ which the official nginx
# image executes automatically. Writes to /tmp so the container can keep
# read_only: true on its root filesystem.
set -e

: "${LOKI_USER:?LOKI_USER is required}"
: "${LOKI_PASSWORD:?LOKI_PASSWORD is required}"

# apr1 is the classic nginx-compatible htpasswd hash. openssl ships with the
# nginx:alpine base image so no extra packages are needed.
hash=$(openssl passwd -apr1 "$LOKI_PASSWORD")
printf '%s:%s\n' "$LOKI_USER" "$hash" > /tmp/.htpasswd
chmod 600 /tmp/.htpasswd
