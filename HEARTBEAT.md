# HEARTBEAT.md

## OpenClaw Reliability Heartbeat (every 10m)

Goal: keep iMessage/BlueBubbles + OpenClaw gateway responsive, with safe recovery and no data loss.

### 1) Quick health checks
Run:

```bash
openclaw gateway probe
openclaw gateway health
```

Expect:
- `RPC: ok`
- `BlueBubbles: ok`

### 2) If unhealthy, recover safely (one attempt)
Before any restart, capture diagnostics first:

```bash
mkdir -p ~/.openclaw/watchdog/manual-heartbeat
openclaw status --all > ~/.openclaw/watchdog/manual-heartbeat/status-$(date +%Y%m%d-%H%M%S).txt 2>&1
```

Then perform one graceful recovery:

```bash
openclaw gateway restart
sleep 4
openclaw gateway probe
openclaw gateway health
```

### 3) If still unhealthy
- Do NOT use destructive commands.
- Notify user immediately with concrete symptoms.
- Include latest incident path under `~/.openclaw/watchdog/incidents/` if available.

### 4) Data safety rules
- Never delete session files or logs during recovery.
- Restart only gateway first.
- Keep all evidence for postmortem.
