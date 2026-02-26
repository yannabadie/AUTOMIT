#!/bin/bash
# Encrypt .env with SOPS/age for safe git storage
# Prerequisites: install sops and age
#   Windows: scoop install sops age
#   Linux: apt install age && go install github.com/getsops/sops/v3/cmd/sops@latest
# First time: age-keygen -o ~/.config/sops/age/keys.txt
# Then put the public key in .sops.yaml

set -e

if [ ! -f .env ]; then
    echo "ERROR: .env not found"
    exit 1
fi

if ! command -v sops &> /dev/null; then
    echo "ERROR: sops not installed"
    echo "  Windows: scoop install sops age"
    echo "  Linux:   apt install age && go install github.com/getsops/sops/v3/cmd/sops@latest"
    exit 1
fi

sops encrypt .env > .env.encrypted
echo "Encrypted .env -> .env.encrypted"
echo "You can safely commit .env.encrypted to git"
