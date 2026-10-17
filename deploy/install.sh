#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
mkdir -p storage/archive storage/signatures storage/catalogs
.venv/bin/python -m pytest -q

printf 'Application prepared in %s\n' "$PROJECT_DIR"
