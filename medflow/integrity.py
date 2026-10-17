from __future__ import annotations

import hashlib
from pathlib import Path

from .config import APPROVED_CATALOG_HASH_PATH


# Зафиксированная контрольная сумма предоставленного пользователем справочника.
# Изменение эталона допускается только отдельной, осознанной процедурой обновления.
REFERENCE_TEMPLATE_SHA256 = "5cb9c45ccdcc9fadba0617b89523f1441c02d83ca3b8034ace562a627dd1a99b"
OUTPUT_TEMPLATE_SHA256 = {
    "mo": "5cb9c45ccdcc9fadba0617b89523f1441c02d83ca3b8034ace562a627dd1a99b",
    "po": "5cb9c45ccdcc9fadba0617b89523f1441c02d83ca3b8034ace562a627dd1a99b",
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_reference_template(path: Path) -> None:
    if not path.is_file():
        raise RuntimeError(f"Не найден эталонный справочник: {path}")
    actual = file_sha256(path)
    expected = REFERENCE_TEMPLATE_SHA256
    if APPROVED_CATALOG_HASH_PATH.is_file():
        expected = APPROVED_CATALOG_HASH_PATH.read_text(encoding="utf-8").strip() or expected
    if actual != expected:
        raise RuntimeError(
            "Эталонный Excel-справочник изменён. Работа остановлена, чтобы не использовать "
            "неподтверждённые данные. Восстановите утверждённый файл или выполните отдельную "
            "процедуру обновления справочника."
        )


def verify_output_template(path: Path, document_kind: str) -> None:
    if document_kind not in OUTPUT_TEMPLATE_SHA256:
        raise RuntimeError(f"Неизвестный вид шаблона: {document_kind}")
    # Both output forms live in the active demo catalog workbook.
    verify_reference_template(path)

def ensure_separate_output(reference_path: Path, output_path: Path) -> None:
    if reference_path.resolve() == output_path.resolve():
        raise RuntimeError("Запрещено сохранять готовый документ поверх эталонного справочника.")
