from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from .config import ARCHIVE_DIR, DATABASE_PATH, SIGNATURE_DIR, STORAGE_DIR


LEGACY_PROFILE_ID = "legacy-1"


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_storage() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    SIGNATURE_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                role TEXT NOT NULL,
                signer_name TEXT NOT NULL DEFAULT '',
                signature_path TEXT,
                last_business_unit_id TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                signer_name TEXT NOT NULL DEFAULT '',
                signature_path TEXT,
                last_business_unit_id TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS invitations (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                role TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT
            );

            CREATE TABLE IF NOT EXISTS catalog_versions (
                id TEXT PRIMARY KEY,
                business_unit_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                validation_json TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                candidate_name TEXT NOT NULL,
                business_unit TEXT NOT NULL,
                structural_unit TEXT NOT NULL,
                job TEXT NOT NULL,
                document_date TEXT NOT NULL,
                po_required INTEGER NOT NULL,
                formats_json TEXT NOT NULL,
                files_json TEXT NOT NULL,
                download_name TEXT NOT NULL,
                request_json TEXT NOT NULL
            );

            """
        )
        profile_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(profile)").fetchall()
        }
        if "last_business_unit_id" not in profile_columns:
            connection.execute(
                "ALTER TABLE profile ADD COLUMN last_business_unit_id TEXT NOT NULL DEFAULT ''"
            )
        document_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(documents)").fetchall()
        }
        if "owner_profile_id" not in document_columns:
            connection.execute(
                f"ALTER TABLE documents ADD COLUMN owner_profile_id TEXT NOT NULL DEFAULT '{LEGACY_PROFILE_ID}'"
            )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_owner_created "
            "ON documents(owner_profile_id, created_at DESC)"
        )
        profile_columns_v2 = {
            row[1] for row in connection.execute("PRAGMA table_info(profiles)").fetchall()
        }
        for name, definition in (
            ("email", "TEXT"),
            ("display_name", "TEXT NOT NULL DEFAULT ''"),
            ("password_hash", "TEXT"),
            ("is_active", "INTEGER NOT NULL DEFAULT 1"),
            ("created_at", "TEXT NOT NULL DEFAULT ''"),
        ):
            if name not in profile_columns_v2:
                connection.execute(f"ALTER TABLE profiles ADD COLUMN {name} {definition}")
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email "
            "ON profiles(email COLLATE NOCASE) WHERE email IS NOT NULL"
        )
        connection.execute(
            "UPDATE profiles SET role = 'editor' WHERE role = 'admin' AND password_hash IS NULL"
        )
        legacy = connection.execute("SELECT * FROM profile WHERE id = 1").fetchone()
        if legacy:
            connection.execute(
                """
                INSERT OR IGNORE INTO profiles (
                    id, role, signer_name, signature_path, last_business_unit_id, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    LEGACY_PROFILE_ID,
                    "editor" if legacy["role"] == "admin" else legacy["role"],
                    legacy["signer_name"],
                    legacy["signature_path"],
                    legacy["last_business_unit_id"],
                    legacy["updated_at"],
                ),
            )
        connection.execute(
            "UPDATE profiles SET role = 'editor' WHERE role = 'admin' AND password_hash IS NULL"
        )
    purge_inactive_accounts()
    purge_orphan_signatures()


def get_profile(profile_id: str = LEGACY_PROFILE_ID) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    return dict(row) if row else None


def get_profile_by_email(email: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM profiles WHERE email = ? COLLATE NOCASE AND is_active = 1",
            (email.strip().lower(),),
        ).fetchone()
    return dict(row) if row else None


def count_active_admins() -> int:
    with _connect() as connection:
        row = connection.execute(
            "SELECT COUNT(*) FROM profiles WHERE role = 'admin' AND is_active = 1 AND password_hash IS NOT NULL"
        ).fetchone()
    return int(row[0])


def save_account(
    *,
    email: str,
    role: str,
    display_name: str,
    signer_name: str,
    signature_path: str | None,
    password_hash: str,
    profile_id: str | None = None,
) -> dict[str, Any]:
    profile_id = profile_id or uuid4().hex
    now = datetime.now().isoformat(timespec="seconds")
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO profiles (
                id, role, signer_name, signature_path, last_business_unit_id,
                updated_at, email, display_name, password_hash, is_active, created_at
            ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, 1, ?)
            """,
            (profile_id, role, signer_name, signature_path, now, email.strip().lower(), display_name.strip(), password_hash, now),
        )
    return get_profile(profile_id) or {}


def upgrade_profile_to_account(
    profile_id: str,
    *,
    email: str,
    role: str,
    display_name: str,
    password_hash: str,
) -> dict[str, Any]:
    now = datetime.now().isoformat(timespec="seconds")
    with _connect() as connection:
        connection.execute(
            """UPDATE profiles SET email = ?, role = ?, display_name = ?,
                   password_hash = ?, is_active = 1, created_at = ?, updated_at = ?
               WHERE id = ?""",
            (email.strip().lower(), role, display_name.strip(), password_hash, now, now, profile_id),
        )
    return get_profile(profile_id) or {}


def create_session(profile_id: str, token_hash: str, days: int = 30) -> None:
    now = datetime.now()
    with _connect() as connection:
        connection.execute(
            "INSERT INTO sessions(token_hash, profile_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token_hash, profile_id, (now + timedelta(days=days)).isoformat(), now.isoformat()),
        )


def get_session_profile(token_hash: str) -> dict[str, Any] | None:
    now = datetime.now().isoformat()
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT p.* FROM sessions s JOIN profiles p ON p.id = s.profile_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND p.is_active = 1
              AND p.password_hash IS NOT NULL
            """,
            (token_hash, now),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token_hash: str) -> None:
    with _connect() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


def create_invitation(email: str, role: str, token_hash: str, created_by: str) -> dict[str, Any]:
    now = datetime.now()
    invitation_id = uuid4().hex
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO invitations(id, email, role, token_hash, created_by, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (invitation_id, email.strip().lower(), role, token_hash, created_by, now.isoformat(), (now + timedelta(days=7)).isoformat()),
        )
    return get_invitation(token_hash) or {}


def get_invitation(token_hash: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM invitations WHERE token_hash = ?", (token_hash,)
        ).fetchone()
    return dict(row) if row else None


def use_invitation(invitation_id: str) -> None:
    with _connect() as connection:
        connection.execute("DELETE FROM invitations WHERE id = ?", (invitation_id,))


def list_invitations() -> list[dict[str, Any]]:
    now = datetime.now().isoformat()
    with _connect() as connection:
        rows = connection.execute(
            """SELECT id, email, role, created_at, expires_at, used_at
               FROM invitations
               WHERE used_at IS NULL AND expires_at > ?
               ORDER BY created_at DESC""",
            (now,),
        ).fetchall()
    return [dict(row) for row in rows]


def refresh_invitation(invitation_id: str, token_hash: str) -> dict[str, Any] | None:
    now = datetime.now()
    with _connect() as connection:
        cursor = connection.execute(
            """UPDATE invitations
               SET token_hash = ?, expires_at = ?
               WHERE id = ? AND used_at IS NULL""",
            (token_hash, (now + timedelta(days=7)).isoformat(), invitation_id),
        )
        if not cursor.rowcount:
            return None
        row = connection.execute(
            "SELECT id, email, role, created_at, expires_at, used_at FROM invitations WHERE id = ?",
            (invitation_id,),
        ).fetchone()
    return dict(row) if row else None


def delete_invitation(invitation_id: str) -> bool:
    with _connect() as connection:
        cursor = connection.execute(
            "DELETE FROM invitations WHERE id = ?",
            (invitation_id,),
        )
    return bool(cursor.rowcount)


def list_accounts() -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """SELECT id, email, role, display_name, signer_name, is_active, created_at
               FROM profiles
               WHERE password_hash IS NOT NULL AND is_active = 1
               ORDER BY created_at DESC"""
        ).fetchall()
    return [dict(row) for row in rows]


def delete_account(profile_id: str) -> int | None:
    with _connect() as connection:
        profile = connection.execute(
            "SELECT role, signature_path FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not profile or profile["role"] == "admin":
            return None

    deleted_documents = delete_profile_documents(profile_id)

    signature_path = profile["signature_path"]
    if signature_path:
        signature_root = SIGNATURE_DIR.resolve()
        signature = Path(signature_path).resolve()
        if signature.parent == signature_root and signature.is_file():
            signature.unlink()

    with _connect() as connection:
        connection.execute("DELETE FROM sessions WHERE profile_id = ?", (profile_id,))
        connection.execute("DELETE FROM documents WHERE owner_profile_id = ?", (profile_id,))
        connection.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    return deleted_documents


def purge_inactive_accounts() -> int:
    with _connect() as connection:
        profile_ids = [
            row["id"]
            for row in connection.execute(
                "SELECT id FROM profiles WHERE is_active = 0 AND role != 'admin'"
            ).fetchall()
        ]
    for profile_id in profile_ids:
        delete_account(profile_id)
    return len(profile_ids)


def purge_orphan_signatures() -> int:
    with _connect() as connection:
        referenced = {
            Path(row["signature_path"]).resolve()
            for row in connection.execute(
                "SELECT signature_path FROM profiles WHERE signature_path IS NOT NULL"
            ).fetchall()
            if row["signature_path"]
        }
    deleted = 0
    for candidate in SIGNATURE_DIR.iterdir():
        if candidate.is_file() and candidate.resolve() not in referenced:
            candidate.unlink()
            deleted += 1
    return deleted


def save_catalog_version(record: dict[str, Any]) -> None:
    with _connect() as connection:
        connection.execute(
            """INSERT INTO catalog_versions(
                   id, business_unit_id, filename, stored_path, created_by,
                   created_at, validation_json, is_active
               ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                record["id"], record["business_unit_id"], record["filename"],
                record["stored_path"], record["created_by"], record["created_at"],
                json.dumps(record["validation"], ensure_ascii=False),
            ),
        )


def get_catalog_version(version_id: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute("SELECT * FROM catalog_versions WHERE id = ?", (version_id,)).fetchone()
    if not row:
        return None
    item = dict(row)
    item["validation"] = json.loads(item.pop("validation_json"))
    item["is_active"] = bool(item["is_active"])
    return item


def activate_catalog_version(version_id: str, business_unit_id: str) -> None:
    with _connect() as connection:
        connection.execute(
            "UPDATE catalog_versions SET is_active = 0 WHERE business_unit_id = ?",
            (business_unit_id,),
        )
        connection.execute("UPDATE catalog_versions SET is_active = 1 WHERE id = ?", (version_id,))


def list_catalog_versions(business_unit_id: str) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            "SELECT * FROM catalog_versions WHERE business_unit_id = ? ORDER BY created_at DESC",
            (business_unit_id,),
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["validation"] = json.loads(item.pop("validation_json"))
        item["is_active"] = bool(item["is_active"])
        result.append(item)
    return result


def save_profile(
    role: str,
    signer_name: str,
    signature_path: str | None,
    last_business_unit_id: str = "",
    profile_id: str = LEGACY_PROFILE_ID,
) -> dict[str, Any]:
    updated_at = datetime.now().isoformat(timespec="seconds")
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO profiles (
                id, role, signer_name, signature_path, last_business_unit_id, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                role = excluded.role,
                signer_name = excluded.signer_name,
                signature_path = excluded.signature_path,
                last_business_unit_id = excluded.last_business_unit_id,
                updated_at = excluded.updated_at
            """,
            (profile_id, role, signer_name, signature_path, last_business_unit_id, updated_at),
        )
    return get_profile(profile_id) or {}


def create_profile(
    role: str,
    signer_name: str,
    signature_path: str | None,
) -> dict[str, Any]:
    profile_id = uuid4().hex
    return save_profile(role, signer_name, signature_path, profile_id=profile_id)


def save_last_business_unit(
    business_unit_id: str,
    profile_id: str = LEGACY_PROFILE_ID,
) -> dict[str, Any] | None:
    updated_at = datetime.now().isoformat(timespec="seconds")
    with _connect() as connection:
        connection.execute(
            """
            UPDATE profiles
            SET last_business_unit_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (business_unit_id, updated_at, profile_id),
        )
    return get_profile(profile_id)


def save_document(record: dict[str, Any]) -> None:
    owner_profile_id = record["owner_profile_id"]
    if not owner_profile_id:
        raise ValueError("Для документа обязателен владелец")
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO documents (
                id, created_at, candidate_name, business_unit, structural_unit,
                job, document_date, po_required, formats_json, files_json,
                download_name, request_json, owner_profile_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record["created_at"],
                record["candidate_name"],
                record["business_unit"],
                record["structural_unit"],
                record["job"],
                record["document_date"],
                int(record["po_required"]),
                json.dumps(record["formats"], ensure_ascii=False),
                json.dumps(record["files"], ensure_ascii=False),
                record["download_name"],
                json.dumps(record["request"], ensure_ascii=False),
                owner_profile_id,
            ),
        )


def list_documents(
    profile_id: str,
    search_query: str = "",
) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, created_at, candidate_name, business_unit, structural_unit,
                   job, document_date, po_required, formats_json, files_json,
                   download_name, request_json
            FROM documents
            WHERE owner_profile_id = ?
            ORDER BY created_at DESC
            """,
            (profile_id,),
        ).fetchall()
    normalized_query = search_query.strip().casefold().replace("ё", "е")
    result = []
    for row in rows:
        item = dict(row)
        normalized_candidate = item["candidate_name"].casefold().replace("ё", "е")
        normalized_job = item["job"].casefold().replace("ё", "е")
        if normalized_query and normalized_query not in normalized_candidate and normalized_query not in normalized_job:
            continue
        request_data = json.loads(item.pop("request_json"))
        item["business_unit_id"] = request_data.get("business_unit_id", "")
        item["po_required"] = bool(item["po_required"])
        item["formats"] = json.loads(item.pop("formats_json"))
        item["files"] = json.loads(item.pop("files_json"))
        result.append(item)
    return result


def get_document(
    document_id: str,
    profile_id: str,
) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM documents WHERE id = ? AND owner_profile_id = ?",
            (document_id, profile_id),
        ).fetchone()
    if not row:
        return None
    item = dict(row)
    item["po_required"] = bool(item["po_required"])
    item["formats"] = json.loads(item.pop("formats_json"))
    item["files"] = json.loads(item.pop("files_json"))
    item["request"] = json.loads(item.pop("request_json"))
    item.pop("owner_profile_id", None)
    return item


def delete_document(
    document_id: str,
    profile_id: str,
) -> bool:
    archive_root = ARCHIVE_DIR.resolve()
    document_path = ARCHIVE_DIR / document_id
    document_dir = document_path.resolve()
    with _connect() as connection:
        cursor = connection.execute(
            "DELETE FROM documents WHERE id = ? AND owner_profile_id = ?",
            (document_id, profile_id),
        )
        if cursor.rowcount != 1:
            return False
        if document_path.is_symlink() or document_dir == archive_root or document_dir.parent != archive_root:
            raise RuntimeError("Недопустимый путь к архиву документа")
        if document_dir.is_dir():
            shutil.rmtree(document_dir)
    return True


def delete_profile_documents(profile_id: str) -> int:
    with _connect() as connection:
        document_ids = [
            row["id"]
            for row in connection.execute(
                "SELECT id FROM documents WHERE owner_profile_id = ?",
                (profile_id,),
            ).fetchall()
        ]
    return sum(delete_document(document_id, profile_id) for document_id in document_ids)


def resolve_archived_file(
    document_id: str,
    filename: str,
    profile_id: str,
) -> Path | None:
    document = get_document(document_id, profile_id)
    if not document or filename not in document["files"]:
        return None
    candidate = (ARCHIVE_DIR / document_id / filename).resolve()
    archive_root = (ARCHIVE_DIR / document_id).resolve()
    if archive_root not in candidate.parents:
        return None
    return candidate if candidate.is_file() else None
