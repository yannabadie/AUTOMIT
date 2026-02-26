"""Structured JSON logging for Kestra flows — Loki/Grafana compatible."""

import json
from datetime import datetime, timezone


def log(level: str, msg: str, **kwargs):
    """Emit a structured JSON log line to stdout.

    Compatible with Loki, Grafana, and Kestra log capture.
    Levels: debug, info, warn, error
    """
    entry = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "level": level,
        "msg": msg,
    }
    entry.update(kwargs)
    print(json.dumps(entry, default=str), flush=True)


def log_info(msg: str, **kwargs):
    log("info", msg, **kwargs)


def log_warn(msg: str, **kwargs):
    log("warn", msg, **kwargs)


def log_error(msg: str, **kwargs):
    log("error", msg, **kwargs)
