#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-"${ROOT_DIR}/backups"}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/nfcapp-${TIMESTAMP}.dump"

if [[ ! -f "${ROOT_DIR}/.env" ]]; then
  echo "Arquivo .env não encontrado em ${ROOT_DIR}." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
docker compose --project-directory "${ROOT_DIR}" --env-file "${ROOT_DIR}/.env" \
  -f "${ROOT_DIR}/compose.yml" exec -T database \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "${BACKUP_FILE}"
echo "Backup criado: ${BACKUP_FILE}"
