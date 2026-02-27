#!/bin/sh
# Import corporate CA bundle into JVM trust store before starting Kestra
# This script wraps the default Kestra entrypoint

CA_FILE="/etc/ssl/certs/corporate-ca.pem"
CACERTS="/opt/java/openjdk/lib/security/cacerts"

if [ -f "$CA_FILE" ]; then
  echo "[AutomIT] Importing corporate CA certificates into JVM trust store..."
  # Split PEM bundle into individual certs
  awk 'BEGIN{n=0} /BEGIN CERTIFICATE/{n++; fn="/tmp/cert-"n".pem"} {print > fn}' "$CA_FILE" 2>/dev/null

  imported=0
  for c in /tmp/cert-*.pem; do
    [ -f "$c" ] || continue
    keytool -import -trustcacerts -alias "corp-ca-${imported}" \
      -file "$c" -keystore "$CACERTS" \
      -storepass changeit -noprompt 2>/dev/null && imported=$((imported+1))
  done
  rm -f /tmp/cert-*.pem
  echo "[AutomIT] Imported $imported corporate CA certs"
fi

# Execute the original entrypoint + command
exec docker-entrypoint.sh "$@"
