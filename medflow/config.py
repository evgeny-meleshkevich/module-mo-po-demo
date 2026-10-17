from __future__ import annotations

import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
SAMPLES_DIR = ROOT_DIR / "samples"
STORAGE_DIR = ROOT_DIR / "storage"
ARCHIVE_DIR = STORAGE_DIR / "archive"
SIGNATURE_DIR = STORAGE_DIR / "signatures"
CATALOG_STORAGE_DIR = STORAGE_DIR / "catalogs"
APPROVED_CATALOG_HASH_PATH = STORAGE_DIR / "approved-catalog.sha256"
TEMPLATE_PATH = Path(
    os.environ.get(
        "MEDFLOW_TEMPLATE",
        DATA_DIR / "Контингенты_РТ.xlsx",
    )
)
DATABASE_PATH = Path(os.environ.get("MEDFLOW_DATABASE", STORAGE_DIR / "app.db"))

BUSINESS_UNITS = [
    {
        "id": "demo-rt",
        "name": "ООО «Ресурс Тест»",
        "short_code": "РТ",
        "template": TEMPLATE_PATH,
        "output_templates": {
            "mo": TEMPLATE_PATH,
            "po": TEMPLATE_PATH,
        },
    }
]
