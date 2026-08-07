# agent-browser skill

Use `agent-browser` (Vercel Labs) for browser automation instead of the built-in browser tool.

## Installation

```bash
npm install -g agent-browser
```

This skill uses system Chrome (no extra download needed).

## Configuration

Default to use system Chrome on macOS:
```bash
export AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Or pass `--executable-path` per command.

## Usage

This skill wraps the `agent-browser` CLI. Use it for:
- Web automation tasks
- Taking snapshots of pages
- Clicking, filling forms, scrolling
- Screenshots with annotated elements

## Commands

```bash
# Open a URL (uses system Chrome)
agent-browser open <url>

# Get interactive elements snapshot (AI-friendly)
agent-browser snapshot -i

# Click by ref (from snapshot)
agent-browser click @e1

# Fill input by ref
agent-browser fill @e2 "text"

# Screenshot with labels
agent-browser screenshot --annotate

# Close browser
agent-browser close
```

## Options

- `--headed` - Show browser window (not headless)
- `--session <name>` - Isolated session
- `--executable-path` - Use custom browser (defaults to system Chrome)

## Notes

- Uses refs (@e1, @e2) from snapshot for deterministic element selection
- Compact snapshot (-i) returns only interactive elements
- Annotated screenshot overlays numbered labels on clickable elements
