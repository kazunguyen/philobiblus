import hashlib
import json
import os
import sys
from pathlib import Path

from google.cloud import storage
import joblib

def hash_file(path: Path) -> str:
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def main():
    model_uri = os.environ.get("MODEL_URI")
    model_sha256 = os.environ.get("MODEL_SHA256")
    model_version = os.environ.get("MODEL_VERSION")

    if not model_uri or not model_sha256 or not model_version:
        print("Missing required environment variables (MODEL_URI, MODEL_SHA256, MODEL_VERSION)", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching model version {model_version} from {model_uri}...")

    # gs://bucket_name/path/to/blob
    if not model_uri.startswith("gs://"):
        print("MODEL_URI must start with gs://", file=sys.stderr)
        sys.exit(1)

    parts = model_uri[5:].split("/", 1)
    if len(parts) != 2:
        print("Invalid MODEL_URI format", file=sys.stderr)
        sys.exit(1)
        
    bucket_name, blob_name = parts

    target_dir = Path("/model")
    target_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = target_dir / "model.joblib.tmp"
    final_path = target_dir / "model.joblib"
    meta_path = target_dir / "model.meta.json"

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    
    if not blob.exists():
        print(f"Blob {blob_name} not found in bucket {bucket_name}", file=sys.stderr)
        sys.exit(1)

    blob.download_to_filename(str(tmp_path))

    downloaded_sha256 = hash_file(tmp_path)
    if downloaded_sha256 != model_sha256:
        print(f"Checksum mismatch! Expected: {model_sha256}, Got: {downloaded_sha256}", file=sys.stderr)
        sys.exit(1)

    # Check artifact schema
    try:
        artifact = joblib.load(tmp_path)
        schema_version = artifact.get("schema_version")
        if schema_version != 2:
            print(f"Invalid schema version: {schema_version}. Expected 2.", file=sys.stderr)
            sys.exit(1)
        if "feature_matrix" not in artifact:
            print("Invalid artifact: Missing feature_matrix", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"Failed to load or validate artifact: {e}", file=sys.stderr)
        sys.exit(1)

    # Atomic rename
    tmp_path.rename(final_path)

    # Metadata is only visible after the verified artifact has been made current.
    meta = {
        "model_version": model_version,
        "model_uri": model_uri,
        "model_sha256": model_sha256
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Successfully fetched and validated model {model_version}.")
    sys.exit(0)

if __name__ == "__main__":
    main()
