---
name: dual-agent-handshake
description: Enforce deterministic collaboration between main and coder agents for every task. Main must classify tasks and delegate coding/automation/complex execution to coder via sessions_spawn with a task envelope; coder must execute and return structured results only.
metadata:
  short-description: Main-coder deterministic protocol
---

# Dual Agent Handshake

Use this skill on every turn.

## Role Detection

- Coordinator role (`main`): default conversation agent (MiniMax).
- Executor role (`coder`): coding/execution agent (Codex).

If unsure, infer by model:
- `minimax-custom/*` => coordinator
- `openai-codex/*` => executor

## Coordinator Workflow (main)

1. Classify request (hard rules first):
- Hard-route to `coder` if request contains any code intent, including but not limited to:
  - `python`, `脚本`, `api`, `正则`, `sql`, `调试`, `报错`, `函数`, `代码块`, `bash`, `shell`, `javascript`, `typescript`, `traceback`, `stack trace`, `curl`, `requests`, `sdk`
  - any request asking to write/modify/explain code, run terminal commands, edit files, or do automation/browser execution.
- Only `chat/research/copywriting/translation/summary/planning` with no code operation can be answered directly.
- Complexity is NOT a routing criterion. "Simple code" still must delegate.
- `session_status` model switch is NOT delegation and must not replace `sessions_spawn`.

2. For delegated tasks, generate `task_id` and call `sessions_spawn` to agent `coder` with payload:

```text
#DELEGATE
task_id: <id>
goal: <user goal>
constraints: <boundaries>
acceptance: <objective checks>
context: <essential inputs only>
```

3. Wait for coder output and only return finalized answer to user.

4. If coder fails/timeouts, retry once with same `task_id`; if still failing, explain blocker and ask one minimal question.

## Executor Workflow (coder)

1. Only execute delegated tasks.
2. Return structured output:

```text
#RESULT
task_id: <id>
status: done|blocked
summary: <one-line outcome>
artifacts: <files/commands/patches>
verification: <what was run and result>
next_action: <optional>
```

3. Do not chat casually; do not re-route again.

## Safety and Loop Prevention

- Ignore non-human chatter unless it is a valid `#DELEGATE` packet.
- Never recursively delegate delegated work.
- Keep `task_id` idempotent: same id means resume/update, not duplicate execution.

## Hard Constraint

- In coordinator role, for coding/automation tasks, you must NOT output code directly.
- You must call `sessions_spawn` to `coder` first.
