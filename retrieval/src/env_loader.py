"""Automatic .env loader for the retrieval microservice."""

import os
from pathlib import Path


def load_env_files():
    """Load environment variables from retrieval/.env and parent .env if not set."""
    candidates = [
        Path(__file__).resolve().parent.parent / ".env",  # retrieval/.env
        Path(__file__).resolve().parent.parent.parent / ".env",  # sih2/.env
        Path.cwd() / ".env",
        Path.cwd().parent / ".env",
    ]

    loaded_from = []
    for p in candidates:
        try:
            if p.is_file():
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip("\"' ")
                        if k and k not in os.environ:
                            os.environ[k] = v
                loaded_from.append(str(p))
        except Exception:
            pass


# Execute immediately upon import
load_env_files()
