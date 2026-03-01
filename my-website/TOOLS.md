# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

### Browser

- Default: agent-browser (Vercel Labs) with system Chrome
- Config: AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

### Vision Fallback (Main Agent)

- When an image is attached and visual understanding is required, call:
  `/Users/ella/.openclaw/workspace/vision.py "<prompt>" "<image_path_or_url>"`
- Do **not** call `python3 /Users/ella/.openclaw/workspace/vision.py ...`.
- Use this as fallback when direct model image interpretation is uncertain or inconsistent.

### Vision Fallback (Override - Text Path Safe)

- For image attachments, rely on `tools.media.image` first (wired to `/Users/ella/.openclaw/workspace/vision.py`).
- For plain text messages that may contain image paths/URLs (e.g. `.jpg`, `.png`), call:
  `/Users/ella/.openclaw/workspace/vision.py "<prompt>" "<raw_user_text_or_path>"`
- `vision.py` prechecks locally (exists + image mime/extension + size) before any model call.
- Invalid candidates return `SKIP:*` and consume no vision tokens.
- Repeated recognition on same image+prompt uses local cache.
