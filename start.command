#!/bin/zsh
set -e

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

# Keep inherited settings from another installation out of this test copy.
unset MEDFLOW_TEMPLATE MEDFLOW_DATABASE PORT

NEED_VENV=0
if [[ ! -x .venv/bin/python ]]; then
  NEED_VENV=1
elif [[ -f .venv/bin/activate ]] && ! grep -Fq "$PROJECT_DIR" .venv/bin/activate 2>/dev/null; then
  echo "Виртуальное окружение было скопировано из другой папки. Пересоздаем..."
  rm -rf .venv
  NEED_VENV=1
fi

if [[ $NEED_VENV -eq 1 ]]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
fi

echo "=================================================="
echo "Запуск приложения из каталога:"
echo "  $PROJECT_DIR"
echo "=================================================="

exec .venv/bin/python run.py
