#!/usr/bin/env python3
"""MiniMax vision helper via minimax-coding-plan-mcp.

Usage:
  vision.py <prompt> <image_path_or_url_or_text>

Behavior:
- Accepts either a direct image path/URL or a free-form text message.
- Extracts the first valid image candidate from text when needed.
- Performs local precheck to avoid unnecessary vision calls.
- Uses a tiny local cache to avoid repeated recognition on the same image.
"""

from __future__ import annotations

import hashlib
import imghdr
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
from typing import Any
from urllib.parse import urlparse

UVX_CMD = ["uvx", "--from", "minimax-coding-plan-mcp", "minimax-coding-plan-mcp"]
DEFAULT_PROXY = "http://127.0.0.1:7890"
DEFAULT_API_HOST = "https://api.minimaxi.com"
DEFAULT_API_KEY = (
    "sk-cp-8o1q6l78OEF_qXFMw-T_OkR_eapd39wlUQPOQmVrSnKbWqIAo9Y-GYMF3ojBYW32"
    "LTvuTJWgXi1R6ZmCJcufGT_vgJ8UmmrNybl1vKwVJGPXlrZOfEjk06I"
)

MAX_LOCAL_BYTES = 10 * 1024 * 1024
CACHE_MAX_ITEMS = 200
CACHE_TTL_SECONDS = 7 * 24 * 3600
CACHE_PATH = os.path.expanduser("~/.openclaw/workspace/.vision_cache.json")

IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tiff",
    ".tif",
    ".heic",
    ".heif",
    ".avif",
}


def _build_env() -> dict[str, str]:
    env = os.environ.copy()
    proxy = env.get("HTTP_PROXY") or env.get("http_proxy") or DEFAULT_PROXY
    env.update(
        {
            "HTTP_PROXY": proxy,
            "HTTPS_PROXY": env.get("HTTPS_PROXY") or env.get("https_proxy") or proxy,
            "ALL_PROXY": env.get("ALL_PROXY") or env.get("all_proxy") or proxy,
            "MINIMAX_API_KEY": env.get("MINIMAX_API_KEY") or DEFAULT_API_KEY,
            "MINIMAX_API_HOST": env.get("MINIMAX_API_HOST") or DEFAULT_API_HOST,
            "FASTMCP_LOG_LEVEL": env.get("FASTMCP_LOG_LEVEL") or "WARNING",
        }
    )
    return env


def _write_jsonl(proc: subprocess.Popen[str], obj: dict[str, Any]) -> None:
    assert proc.stdin is not None
    proc.stdin.write(json.dumps(obj, ensure_ascii=False) + "\n")
    proc.stdin.flush()


def _read_json_response(
    proc: subprocess.Popen[str], *, expected_id: int, timeout_sec: int
) -> dict[str, Any]:
    assert proc.stdout is not None
    deadline = time.time() + timeout_sec

    while time.time() < deadline:
        line = proc.stdout.readline()
        if line == "":
            break
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        if isinstance(obj, dict) and obj.get("id") == expected_id:
            return obj

    stderr_text = ""
    if proc.stderr is not None:
        try:
            stderr_text = proc.stderr.read().strip()
        except Exception:
            stderr_text = ""

    raise RuntimeError(
        "MCP response timeout/closed"
        + (f"; stderr={stderr_text}" if stderr_text else "")
    )


def _extract_text(resp: dict[str, Any]) -> str:
    if "error" in resp:
        return f"API Error: {resp['error']}"

    result = resp.get("result") or {}
    content = result.get("content")
    if isinstance(content, list):
        out: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                txt = item.get("text")
                if isinstance(txt, str) and txt.strip():
                    out.append(txt.strip())
        if out:
            return "\n".join(out)

    return json.dumps(resp, ensure_ascii=False)


def _clean_token(value: str) -> str:
    return value.strip().strip('"\'`<>[](){}')


def _has_image_ext(value: str) -> bool:
    parsed = urlparse(value)
    path = parsed.path if parsed.scheme else value
    _, ext = os.path.splitext(path.lower())
    return ext in IMAGE_EXTS


def _is_http_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def _extract_candidates(text: str) -> list[str]:
    candidates: list[str] = []

    # URLs
    for m in re.findall(r"https?://[^\s\]\[\)\(\"\'<>]+", text):
        token = _clean_token(m)
        if token:
            candidates.append(token)

    # Absolute paths (macOS/Linux)
    for m in re.findall(r"/(?:[^\s\]\[\)\(\"\'<>]|\\ )+", text):
        token = _clean_token(m.replace("\\ ", " "))
        if token:
            candidates.append(token)

    # file:// URL
    for m in re.findall(r"file://[^\s\]\[\)\(\"\'<>]+", text):
        token = _clean_token(m)
        if token:
            candidates.append(token)

    # Keep order + de-dup
    out: list[str] = []
    seen = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        out.append(c)
    return out


def _normalize_source(raw: str) -> tuple[str | None, str | None]:
    """Return (resolved_source, skip_reason)."""
    value = _clean_token(raw)
    if not value:
        return None, "SKIP:NO_IMAGE_CANDIDATE"

    # Direct url/path fast path
    direct_candidates = [value]
    if _is_http_url(value):
        direct_candidates = [value]
    elif value.startswith("file://"):
        direct_candidates = [value]
    elif os.path.isabs(os.path.expanduser(value)):
        direct_candidates = [os.path.expanduser(value)]
    else:
        # Free-form text input
        direct_candidates = _extract_candidates(value)

    if not direct_candidates:
        return None, "SKIP:NO_IMAGE_CANDIDATE"

    for cand in direct_candidates:
        c = _clean_token(cand)
        if not c:
            continue

        # URL candidate
        if _is_http_url(c):
            if _has_image_ext(c):
                return c, None
            continue

        # file:// candidate
        if c.startswith("file://"):
            path = c[7:]
            path = os.path.expanduser(path)
            if os.path.isfile(path) and _is_local_image(path):
                return path, None
            continue

        # local path candidate
        path = os.path.expanduser(c)
        if os.path.isfile(path) and _is_local_image(path):
            return path, None

    return None, "SKIP:NO_VALID_IMAGE_SOURCE"


def _is_local_image(path: str) -> bool:
    try:
        st = os.stat(path)
    except OSError:
        return False

    if st.st_size <= 0 or st.st_size > MAX_LOCAL_BYTES:
        return False

    guessed, _enc = mimetypes.guess_type(path)
    if guessed and guessed.startswith("image/"):
        return True

    kind = imghdr.what(path)
    if kind:
        return True

    return _has_image_ext(path)


def _cache_load() -> dict[str, Any]:
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {"items": {}}


def _cache_save(cache: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    tmp = CACHE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    os.replace(tmp, CACHE_PATH)


def _cache_key(prompt: str, source: str) -> str:
    h = hashlib.sha256()
    h.update(prompt.encode("utf-8", errors="ignore"))

    if os.path.isfile(source):
        st = os.stat(source)
        h.update(source.encode("utf-8", errors="ignore"))
        h.update(str(st.st_mtime_ns).encode("ascii"))
        h.update(str(st.st_size).encode("ascii"))
    else:
        h.update(source.encode("utf-8", errors="ignore"))

    return h.hexdigest()


def _cache_get(prompt: str, source: str) -> str | None:
    cache = _cache_load()
    items = cache.get("items")
    if not isinstance(items, dict):
        return None

    key = _cache_key(prompt, source)
    entry = items.get(key)
    if not isinstance(entry, dict):
        return None

    ts = entry.get("ts")
    text = entry.get("text")
    if not isinstance(ts, (int, float)) or not isinstance(text, str):
        return None

    if time.time() - float(ts) > CACHE_TTL_SECONDS:
        return None

    return text


def _cache_put(prompt: str, source: str, text: str) -> None:
    cache = _cache_load()
    items = cache.get("items")
    if not isinstance(items, dict):
        items = {}
        cache["items"] = items

    now = time.time()

    # Remove expired first
    for k in list(items.keys()):
        entry = items.get(k)
        if not isinstance(entry, dict):
            items.pop(k, None)
            continue
        ts = entry.get("ts")
        if not isinstance(ts, (int, float)) or now - float(ts) > CACHE_TTL_SECONDS:
            items.pop(k, None)

    key = _cache_key(prompt, source)
    items[key] = {"ts": now, "text": text}

    # Bound size
    if len(items) > CACHE_MAX_ITEMS:
        sorted_keys = sorted(
            items.keys(), key=lambda k: float(items[k].get("ts", 0.0))
        )
        for k in sorted_keys[: len(items) - CACHE_MAX_ITEMS]:
            items.pop(k, None)

    _cache_save(cache)


def _call_vision(prompt: str, image_source: str, env: dict[str, str]) -> str:
    proc = subprocess.Popen(
        UVX_CMD,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        bufsize=1,
    )

    try:
        _write_jsonl(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "vision-cli", "version": "1.1"},
                },
            },
        )
        _ = _read_json_response(proc, expected_id=1, timeout_sec=20)

        _write_jsonl(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "understand_image",
                    "arguments": {
                        "prompt": prompt,
                        "image_source": image_source,
                    },
                },
            },
        )
        resp = _read_json_response(proc, expected_id=2, timeout_sec=90)
        text = _extract_text(resp).strip()
        if not text:
            raise RuntimeError("empty vision response")
        return text
    finally:
        try:
            if proc.stdin:
                proc.stdin.close()
        except Exception:
            pass
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: vision.py <prompt> <image_path_or_url_or_text>", file=sys.stderr)
        return 1

    prompt = sys.argv[1]
    raw_source = sys.argv[2]

    source, skip_reason = _normalize_source(raw_source)
    if not source:
        # SKIP is an expected control result, not an execution failure.
        print(skip_reason or "SKIP:NO_VALID_IMAGE_SOURCE")
        return 0

    # Cache hit returns immediately, no model tokens.
    cached = _cache_get(prompt, source)
    if cached:
        print(cached)
        return 0

    env = _build_env()
    try:
        text = _call_vision(prompt, source, env)
        _cache_put(prompt, source, text)
        print(text)
        return 0
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
