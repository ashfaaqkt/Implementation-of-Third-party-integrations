#!/usr/bin/env bash
# /**
#  * Fleet Management System – Third-party Integrations, API Gateway
#  * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
#  * Course : Backend and API Development – BITS Pilani
#  * File   : scripts/demo.sh – curl walkthrough of every feature through the API Gateway (for screenshots)
#  */
#
# Usage:   npm run seed && npm run dev      (terminal 1)
#          bash scripts/demo.sh             (terminal 2)
# Options: --no-stop   skip the last step (which stops the telemetry service to show a 503)
#          --pause     wait for Enter after each step (handy while taking screenshots)
#          GATEWAY=http://host:port bash scripts/demo.sh   to target a deployed gateway

set -uo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
API_KEY="${API_KEY:-devkey123}"
DEMO_KEY="${DEMO_KEY:-demokey789}"
STOP_SERVICE=1
PAUSE=0
for arg in "$@"; do
  case "$arg" in
    --no-stop) STOP_SERVICE=0 ;;
    --pause) PAUSE=1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pretty() { node "$ROOT/scripts/lib/pretty.js" "$@"; }

if [ -t 1 ]; then
  B=$'\033[1m'; DIM=$'\033[2m'; NAVY=$'\033[38;5;17m'; AMBER=$'\033[38;5;214m'; GREEN=$'\033[32m'; RED=$'\033[31m'; CYAN=$'\033[36m'; R=$'\033[0m'
else
  B=''; DIM=''; NAVY=''; AMBER=''; GREEN=''; RED=''; CYAN=''; R=''
fi

STEP=0
step() {
  STEP=$((STEP + 1))
  if [ "$PAUSE" = 1 ] && [ "$STEP" -gt 1 ]; then read -r -p "${DIM}↵ Enter for the next step…${R}" _; fi
  echo
  echo "${AMBER}${B}━━━ Step ${STEP}: $1 ${R}"
}
show() { echo "${CYAN}\$ $1${R}"; }

# call METHOD PATH [JSON_BODY] [extra curl args...]  → prints status + pretty body, stores body in $BODY
call() {
  local method="$1" path="$2" data="${3:-}"; shift 3 2>/dev/null || shift $#
  local args=(-s -X "$method" "$GATEWAY$path" -H "x-api-key: $API_KEY" -w '\n%{http_code}')
  [ -n "${TOKEN:-}" ] && args+=(-H "Authorization: Bearer $TOKEN")
  [ -n "$data" ] && args+=(-H 'Content-Type: application/json' -d "$data")
  show "curl -X $method $path${data:+ -d '$data'}"
  local out; out=$(curl "${args[@]}" "$@")
  STATUS="${out##*$'\n'}"; BODY="${out%$'\n'*}"
  local color=$GREEN; [ "${STATUS:0:1}" != "2" ] && color=$RED
  echo "${color}${B}HTTP $STATUS${R}"
  echo "$BODY" | pretty
}

# ------------------------------------------------------------------ banner
cat <<EOF
${AMBER}╔══════════════════════════════════════════════════════════════════╗${R}
${AMBER}║${R} ${B}🚚  FLEET MANAGEMENT SYSTEM – API GATEWAY DEMO${R}                   ${AMBER}║${R}
${AMBER}║${R}     Third-party Integrations, API Gateway                        ${AMBER}║${R}
${AMBER}║${R}                                                                  ${AMBER}║${R}
${AMBER}║${R}     Author : ${B}Ashfaaq Feroz Muhammad${R}                                ${AMBER}║${R}
${AMBER}║${R}     BITS ID: ${B}2023EBCS005${R}                                           ${AMBER}║${R}
${AMBER}║${R}     Course : Backend and API Development – BITS Pilani           ${AMBER}║${R}
${AMBER}╚══════════════════════════════════════════════════════════════════╝${R}
Gateway: $GATEWAY
EOF

if ! curl -s -o /dev/null "$GATEWAY/health"; then
  echo "${RED}✖ Gateway is not reachable at $GATEWAY. Start it first: npm run seed && npm run dev${R}"
  exit 1
fi

# ------------------------------------------------------------------ 1. health
step "Gateway health check (no API key needed)"
show "curl $GATEWAY/health"
curl -s "$GATEWAY/health" | pretty

# ------------------------------------------------------------------ 2. login
step "Log in as the admin through the gateway → JWT"
TOKEN=""
call POST /api/users/login '{"email":"admin@fleet.local","password":"Admin@123"}'
TOKEN=$(echo "$BODY" | pretty get token)
if [ -z "$TOKEN" ]; then echo "${RED}✖ Login failed – did you run npm run seed?${R}"; exit 1; fi
echo "${DIM}JWT stored for the next requests.${R}"

# ------------------------------------------------------------------ 3. register by address
REG="KL-07-DM-$((RANDOM % 9000 + 1000))"
step "Register vehicle $REG by ADDRESS → geocoded by OpenStreetMap Nominatim"
call POST /api/vehicles "{\"registrationNumber\":\"$REG\",\"make\":\"Tata\",\"model\":\"Intra V30\",\"type\":\"truck\",\"address\":\"Marine Drive, Kochi\"}"
VEHICLE_ID=$(echo "$BODY" | pretty get vehicle.id)
echo "${DIM}Geocoded position: $(echo "$BODY" | pretty get vehicle.position)${R}"

# ------------------------------------------------------------------ 4. telemetry
step "Vehicle sends GPS telemetry (stored + vehicle location updated)"
call POST /api/telemetry "{\"vehicleId\":\"$VEHICLE_ID\",\"lat\":9.9816,\"lng\":76.2999,\"speed\":38,\"fuelLevel\":64,\"batteryVoltage\":12.7,\"engineTemp\":86}"

# ------------------------------------------------------------------ 5. nearby
step "Nearby search: vehicles within 3 km of the new position (sorted, with distanceKm)"
call GET "/api/vehicles/nearby?lat=9.9816&lng=76.2999&radiusKm=3"
echo "${DIM}Summary: $(echo "$BODY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);console.log(d.data.map(v=>v.registrationNumber+" "+v.distanceKm+" km").join("  |  "))})')${R}"

step "Nearby search by ADDRESS via the Geolocation Service (/api/maps/nearby)"
call GET "/api/maps/nearby?address=Vyttila,%20Kochi&radiusKm=4"

# ------------------------------------------------------------------ 6. critical event
step "CRITICAL EVENT: low battery (11.1 V) → SMS to every admin (see the notify console)"
call POST /api/telemetry "{\"vehicleId\":\"$VEHICLE_ID\",\"lat\":9.9816,\"lng\":76.2999,\"speed\":0,\"batteryVoltage\":11.1,\"engineTemp\":84}"

# ------------------------------------------------------------------ 7. status change
step "Status change on KL-07-EF-5678 → SMS to admins, fleet managers and its driver (driver's number ends in 0000 → failed)"
TOKEN_SAVE=$TOKEN
V2_JSON=$(curl -s "$GATEWAY/api/vehicles?limit=100" -H "x-api-key: $API_KEY" -H "Authorization: Bearer $TOKEN")
V2_ID=$(echo "$V2_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s).data.find(x=>x.registrationNumber==="KL-07-EF-5678");process.stdout.write(v?v.id+" "+v.status:"")})')
V2_STATUS=${V2_ID#* }; V2_ID=${V2_ID%% *}
NEW_STATUS=maintenance; [ "$V2_STATUS" = "maintenance" ] && NEW_STATUS=active
call PATCH "/api/vehicles/$V2_ID/status" "{\"status\":\"$NEW_STATUS\",\"reason\":\"Scheduled brake inspection\"}"
TOKEN=$TOKEN_SAVE

# ------------------------------------------------------------------ 8. notifications
step "Notification records: latest SMS with status sent / failed"
call GET "/api/notifications?limit=5"
step "Only the FAILED notifications (retried once, then marked failed)"
call GET "/api/notifications?status=failed&limit=3"
step "Notification stats (sent vs failed)"
call GET /api/notifications/stats

# ------------------------------------------------------------------ 9-10. API keys
step "API key MISSING → 401 API_KEY_MISSING"
show "curl $GATEWAY/api/vehicles   (no x-api-key header)"
out=$(curl -s -w '\n%{http_code}' "$GATEWAY/api/vehicles"); echo "${RED}${B}HTTP ${out##*$'\n'}${R}"; echo "${out%$'\n'*}" | pretty

step "API key WRONG → 403 API_KEY_INVALID"
show "curl -H 'x-api-key: wrong-key' $GATEWAY/api/vehicles"
out=$(curl -s -w '\n%{http_code}' "$GATEWAY/api/vehicles" -H 'x-api-key: wrong-key'); echo "${RED}${B}HTTP ${out##*$'\n'}${R}"; echo "${out%$'\n'*}" | pretty

step "Routing headers: x-request-id added by the gateway, x-served-by names the target service"
show "curl -i -H 'x-api-key: $API_KEY' $GATEWAY/api/maps/distance?from=9.9658,76.2856&to=10.0159,76.3419"
curl -s -i "$GATEWAY/api/maps/distance?from=9.9658,76.2856&to=10.0159,76.3419" -H "x-api-key: $API_KEY" -H "Authorization: Bearer $TOKEN" \
  | grep -iE '^(HTTP|x-request-id|x-served-by|x-developed-by|ratelimit-)|distanceKm'

# ------------------------------------------------------------------ 11. rate limit
step "Rate limiting: demo key '$DEMO_KEY' allows 5 requests per window → the 6th+ get 429"
show "for i in \$(seq 1 7); do curl -s -o /dev/null -w '%{http_code} ' -H 'x-api-key: $DEMO_KEY' $GATEWAY/api/vehicles; done"
for i in $(seq 1 7); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/api/vehicles" -H "x-api-key: $DEMO_KEY" -H "Authorization: Bearer $TOKEN")
  if [ "$code" = 429 ]; then printf "%s#%d→%s%s " "$RED" "$i" "$code" "$R"; else printf "%s#%d→%s%s " "$GREEN" "$i" "$code" "$R"; fi
done
echo
show "curl -i -H 'x-api-key: $DEMO_KEY' $GATEWAY/api/vehicles"
curl -s -i "$GATEWAY/api/vehicles" -H "x-api-key: $DEMO_KEY" | grep -iE '^(HTTP|retry-after|ratelimit-)|RATE_LIMIT'

# ------------------------------------------------------------------ 12. service down
if [ "$STOP_SERVICE" = 1 ]; then
  step "Service unavailable: stop the Telemetry Service (port 4003) → gateway returns 503"
  PID=$(lsof -ti tcp:4003 -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$PID" ]; then
    show "kill $PID   # telemetry-service"
    kill "$PID"; sleep 1
    call POST /api/telemetry "{\"vehicleId\":\"$VEHICLE_ID\",\"lat\":9.98,\"lng\":76.29}"
    echo "${DIM}Gateway /health now shows the service as down:${R}"
    curl -s "$GATEWAY/health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);console.log("status:",d.status,"| telemetry-service:",JSON.stringify(d.services["telemetry-service"]))})'
    echo "${AMBER}↻ Restart it in another terminal with:  npm run start:telemetry${R}"
  else
    echo "${DIM}Telemetry service is not listening on 4003 locally – skipped (stop any service yourself to see a 503).${R}"
  fi
else
  echo; echo "${DIM}(skipped the 503 step because of --no-stop)${R}"
fi

echo
echo "${GREEN}${B}✔ Demo complete${R} – Fleet Management System · Ashfaaq Feroz Muhammad (2023EBCS005)"
echo "  Swagger UI: $GATEWAY/api-docs    Map: $GATEWAY/map"
