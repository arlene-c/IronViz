from __future__ import annotations

import hashlib
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WATCH_FILES = [
    ROOT / "backend" / "data" / "field_summary.csv",
    ROOT / "backend" / "data" / "forecast.json",
    ROOT / "backend" / "data" / "quadrant.json",
    ROOT / "backend" / "data" / "sankey.json",
    ROOT / "backend" / "data" / "treemap.json",
]


def file_fingerprint(path: Path) -> str:
    if not path.exists():
        return "missing"
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def current_state() -> str:
    h = hashlib.sha256()
    for file in WATCH_FILES:
        h.update(file.as_posix().encode("utf-8"))
        h.update(file_fingerprint(file).encode("utf-8"))
    return h.hexdigest()


def run_step(args: list[str], label: str) -> None:
    print(f"[backend] {label}...")
    result = subprocess.run(args, cwd=ROOT, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"{label} failed with exit code {result.returncode}")
    print(f"[backend] {label} complete.")


def build_and_validate() -> None:
    run_step([sys.executable, "backend/scripts/model_pipeline.py"], "model pipeline")
    run_step([sys.executable, "backend/scripts/validate_model_artifacts.py"], "artifact validation")


def main() -> None:
    print("[backend] Dev runner started. Watching data inputs for changes.")
    build_and_validate()
    last_state = current_state()

    try:
        while True:
            time.sleep(3)
            new_state = current_state()
            if new_state != last_state:
                print("[backend] Input data change detected. Rebuilding model artifacts.")
                build_and_validate()
                last_state = new_state
    except KeyboardInterrupt:
        print("[backend] Dev runner stopped.")


if __name__ == "__main__":
    main()
