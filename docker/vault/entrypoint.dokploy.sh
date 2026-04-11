#!/bin/sh

set -eu

docker-entrypoint.sh server &
SERVER_PID=$!

sleep 10

export BAO_ADDR="http://127.0.0.1:8200"
INIT_JSON="/openbao/init/vault-secret.json"
CREDS_DIR="/vault-shared"
CREDS_FILE="${CREDS_DIR}/.vault-credentials"
ROLE_NAME="${PROJECT_NAME:-langboard}-role"

mkdir -p /openbao/init "${CREDS_DIR}"

if [ -f "${INIT_JSON}" ] && [ -s "${INIT_JSON}" ]; then
  UNSEAL_KEY=$(grep -o '"keys_base64":\[[^]]*\]' "${INIT_JSON}" | sed 's/"keys_base64":\[\([^]]*\)\]/\1/' | cut -d',' -f1 | tr -d ' "')
  ROOT_TOKEN=$(grep -o '"root_token":"[^"]*"' "${INIT_JSON}" | cut -d'"' -f4)
else
  wget -qO- --post-data='{"secret_shares":1,"secret_threshold":1}' \
    --header='Content-Type: application/json' \
    "${BAO_ADDR}/v1/sys/init" > "${INIT_JSON}"
  UNSEAL_KEY=$(grep -o '"keys_base64":\[[^]]*\]' "${INIT_JSON}" | sed 's/"keys_base64":\[\([^]]*\)\]/\1/' | cut -d',' -f1 | tr -d ' "')
  ROOT_TOKEN=$(grep -o '"root_token":"[^"]*"' "${INIT_JSON}" | cut -d'"' -f4)
fi

SEALED=$(wget -qO- "${BAO_ADDR}/v1/sys/seal-status" 2>/dev/null | grep -o '"sealed":[^,]*' | cut -d':' -f2)
if [ "${SEALED}" = "true" ]; then
  wget -qO- --post-data="{\"key\":\"${UNSEAL_KEY}\"}" \
    --header='Content-Type: application/json' \
    "${BAO_ADDR}/v1/sys/unseal" >/dev/null
fi

export BAO_TOKEN="${ROOT_TOKEN}"

if ! bao auth list 2>/dev/null | grep -q "approle/"; then
  bao auth enable approle >/dev/null 2>&1 || true
fi

cat >/tmp/apikeys-policy.hcl <<'EOF'
path "apikeys/data/*" {
  capabilities = ["create", "update", "read"]
}

path "apikeys/metadata/*" {
  capabilities = ["create", "update", "delete", "list"]
}

path "apikeys/delete/*" {
  capabilities = ["update"]
}
EOF
bao policy write apikeys-policy /tmp/apikeys-policy.hcl >/dev/null
bao write "auth/approle/role/${ROLE_NAME}" token_policies=apikeys-policy >/dev/null

if ! bao secrets list 2>/dev/null | grep -q "^apikeys/$"; then
  bao secrets enable -path=apikeys kv-v2 >/dev/null 2>&1 || true
fi

ROLE_ID=$(bao read -field=role_id "auth/approle/role/${ROLE_NAME}/role-id")
SECRET_ID=$(bao write -field=secret_id -f "auth/approle/role/${ROLE_NAME}/secret-id")

cat >"${CREDS_FILE}" <<EOF
VAULT_ROLE_ID=${ROLE_ID}
VAULT_SECRET_ID=${SECRET_ID}
EOF
chmod 600 "${CREDS_FILE}"

wait "${SERVER_PID}"
