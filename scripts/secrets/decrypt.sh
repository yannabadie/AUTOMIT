#!/bin/bash
# Decrypt .env.encrypted back to .env
# Requires the age private key in ~/.config/sops/age/keys.txt

set -e

if [ ! -f .env.encrypted ]; then
    echo "ERROR: .env.encrypted not found"
    exit 1
fi

if ! command -v sops &> /dev/null; then
    echo "ERROR: sops not installed"
    echo "  Windows: scoop install sops age"
    echo "  Linux:   apt install age && go install github.com/getsops/sops/v3/cmd/sops@latest"
    exit 1
fi

sops decrypt .env.encrypted > .env
echo "Decrypted .env.encrypted -> .env"
