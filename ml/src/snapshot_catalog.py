"""Create an immutable, repeatable snapshot of the public book catalog."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
import sqlalchemy
from google.api_core.exceptions import PreconditionFailed
from google.cloud import storage


QUERY = """
SELECT id AS book_id, title, author, genre, tags, cover_url, created_at, updated_at
FROM books
WHERE visibility = 'public'
ORDER BY id ASC;
"""
CATALOG_COLUMNS = [
    "book_id", "title", "author", "genre", "tags", "cover_url", "created_at", "updated_at"
]


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_value(value: Any) -> Any:
    """Convert pandas/DB values into a deterministic JSON-compatible value."""
    # PostgreSQL ARRAY values may be returned as list or numpy.ndarray,
    # depending on the driver and Parquet round-trip.  Recurse so their
    # representation cannot change the logical catalog hash.
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, (list, tuple)):
        return [_canonical_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _canonical_value(item) for key, item in value.items()}
    if value is None:
        return None
    missing = pd.isna(value)
    if getattr(missing, "ndim", 0) == 0 and bool(missing):
        return None
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    return str(value) if not isinstance(value, (int, float, bool)) else value


def canonical_catalog_sha256(catalog: pd.DataFrame) -> str:
    """Hash logical catalog rows, not a parquet encoding with variable metadata."""
    rows: list[dict[str, Any]] = []
    for row in catalog.sort_values("book_id")[CATALOG_COLUMNS].to_dict("records"):
        rows.append({key: _canonical_value(value) for key, value in row.items()})
    payload = "\n".join(
        json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        for row in rows
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def upload_once(bucket: storage.Bucket, blob_name: str, file_path: Path) -> None:
    """Write immutable objects and treat an existing generation as idempotent success."""
    try:
        bucket.blob(blob_name).upload_from_filename(str(file_path), if_generation_match=0)
    except PreconditionFailed:
        return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-uri", required=True, help="read-only PostgreSQL connection URI")
    parser.add_argument("--bucket", required=True, help="GCS bucket name for MLOps artifacts")
    parser.add_argument("--output-dir", required=True, help="local directory for this run")
    parser.add_argument("--git-sha", default=os.getenv("GIT_SHA", "unknown"))
    parser.add_argument("--image-digest", default=os.getenv("IMAGE_DIGEST", "unknown"))
    args = parser.parse_args()

    engine = sqlalchemy.create_engine(args.db_uri, isolation_level="REPEATABLE READ")
    extracted_at = dt.datetime.now(dt.timezone.utc)
    with engine.begin() as connection:
        catalog = pd.read_sql_query(sqlalchemy.text(QUERY), connection)
    if list(catalog.columns) != CATALOG_COLUMNS:
        raise ValueError(f"Unexpected catalog schema: {list(catalog.columns)}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    catalog_path = output_dir / "catalog.parquet"
    catalog.to_parquet(catalog_path, engine="pyarrow", index=False)
    logical_sha256 = canonical_catalog_sha256(catalog)
    snapshot_id = f"catalog-{logical_sha256[:20]}"
    manifest = {
        "schema_version": 2,
        "snapshot_id": snapshot_id,
        "sha256": logical_sha256,
        "catalog_object_sha256": hash_file(catalog_path),
        "row_count": int(len(catalog)),
        "extracted_at": extracted_at.isoformat(),
        "source_query_version": "public-catalog-v1",
        "training_image_digest": args.image_digest,
        "git_sha": args.git_sha,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    bucket = storage.Client().bucket(args.bucket)
    upload_once(bucket, f"snapshots/{snapshot_id}/catalog.parquet", catalog_path)
    upload_once(bucket, f"snapshots/{snapshot_id}/manifest.json", manifest_path)
    print(json.dumps(manifest, sort_keys=True))


if __name__ == "__main__":
    main()
