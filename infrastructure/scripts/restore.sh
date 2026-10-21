#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Uso: $0 <arquivo-de-backup.dump>" >&2
  exit 2
fi
if [[ ! -f "${ROOT_DIR}/.env" ]]; then
  echo "Arquivo .env não encontrado em ${ROOT_DIR}." >&2
  exit 1
fi

cat <<'WARNING'
ATENÇÃO: a restauração substitui os objetos existentes no banco de dados.
Confirme que o arquivo escolhido é o backup correto antes de continuar.
WARNING
read -r -p "Digite RESTAURAR para prosseguir: " CONFIRMATION
if [[ "${CONFIRMATION}" != "RESTAURAR" ]]; then
  echo "Restauração cancelada."
  exit 1
fi

docker compose --project-directory "${ROOT_DIR}" --env-file "${ROOT_DIR}/.env" \
  -f "${ROOT_DIR}/compose.yml" exec -T database \
  sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < "${BACKUP_FILE}"
echo "Restauração concluída a partir de: ${BACKUP_FILE}"
