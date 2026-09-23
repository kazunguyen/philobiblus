import argparse
import datetime
import hashlib
import json
import os
import sys
from pathlib import Path

import pandas as pd
from google.cloud import storage
import sqlalchemy

QUERY = """
SELECT
  id AS book_id,
  title,
  author,
  genre,
  tags,
  cover_url,
  created_at,
  updated_at
FROM books
WHERE visibility = 'public'
ORDER BY id ASC;
"""

def hash_file(path: Path) -> str:
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def upload_if_not_exists(bucket: storage.Bucket, blob_name: str, file_path: Path):
    blob = bucket.blob(blob_name)
    try:
        blob.upload_from_filename(str(file_path), if_generation_match=0)
    except Exception as e:
        if "PreconditionFailed" in str(e) or "412" in str(e):
            print(f"Object {blob_name} already exists. Skipping upload.")
        else:
            raise

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-uri", required=True, help="PostgreSQL connection URI")
    parser.add_argument("--bucket", required=True, help="GCS bucket name for MLOps")
    parser.add_argument("--output-dir", required=True, help="Local directory to write output")
    parser.add_argument("--git-sha", default=os.getenv("GIT_SHA", "unknown"))
    parser.add_argument("--image-digest", default=os.getenv("IMAGE_DIGEST", "unknown"))
    args = parser.parse_args()

    engine = sqlalchemy.create_engine(
        args.db_uri,
        isolation_level="REPEATABLE READ"
    )

    extracted_at = datetime.datetime.now(datetime.timezone.utc)
    timestamp_str = extracted_at.strftime("%Y%m%dT%H%M%SZ")
    
    with engine.begin() as conn:
        df = pd.read_sql_query(sqlalchemy.text(QUERY), conn)
        
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    catalog_path = out_dir / "catalog.parquet"
    df.to_parquet(catalog_path, engine="pyarrow", index=False)
    
    file_sha256 = hash_file(catalog_path)
    snapshot_id = f"catalog-{timestamp_str}-{file_sha256[:12]}"
    
    manifest = {
        "schema_version": 1,
        "snapshot_id": snapshot_id,
        "sha256": file_sha256,
        "row_count": len(df),
        "extracted_at": extracted_at.isoformat(),
        "source_query_version": "public-catalog-v1",
        "training_image_digest": args.image_digest,
        "git_sha": args.git_sha
    }
    
    manifest_path = out_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        
    print(json.dumps(manifest, indent=2))
    
    # Upload to GCS
    storage_client = storage.Client()
    bucket = storage_client.bucket(args.bucket)
    
    gcs_catalog_path = f"snapshots/{snapshot_id}/catalog.parquet"
    gcs_manifest_path = f"snapshots/{snapshot_id}/manifest.json"
    
    upload_if_not_exists(bucket, gcs_catalog_path, catalog_path)
    upload_if_not_exists(bucket, gcs_manifest_path, manifest_path)
    
    print(f"Snapshot {snapshot_id} uploaded successfully.")

if __name__ == "__main__":
    main()
