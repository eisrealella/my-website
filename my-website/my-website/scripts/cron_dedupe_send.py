#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time


def load_state(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--ttl-sec", type=int, default=7200)
    parser.add_argument("--mode", choices=["time", "hash"], default="time")
    parser.add_argument("--channel", default="bluebubbles")
    parser.add_argument("--target", required=True)
    parser.add_argument("--state-path", default="/Users/ella/.openclaw/cron/dedupe.json")
    args = parser.parse_args()

    message = sys.stdin.read()
    if not message or not message.strip():
        print("SKIP: empty message")
        return 2

    msg_hash = hashlib.sha256(message.encode("utf-8")).hexdigest()
    now_ms = int(time.time() * 1000)
    ttl_ms = max(0, args.ttl_sec) * 1000

    state = load_state(args.state_path)
    entry = state.get(args.job_id)
    if entry:
        last_ms = int(entry.get("last_sent_ms", 0))
        last_hash = entry.get("hash")
        if now_ms - last_ms < ttl_ms:
            if args.mode == "time" or last_hash == msg_hash:
                print("SKIP")
                return 0

    cmd = [
        "openclaw",
        "message",
        "send",
        "--channel",
        args.channel,
        "--target",
        args.target,
        "-m",
        message,
    ]
    subprocess.run(cmd, check=True)

    state[args.job_id] = {
        "last_sent_ms": now_ms,
        "hash": msg_hash,
        "len": len(message),
    }
    save_state(args.state_path, state)
    print("SENT")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
