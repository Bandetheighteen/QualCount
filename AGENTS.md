# Project-Local Rules: QualCount

This workspace uses Prompt Master for task refinement before code execution and for prompt generation.

## 1. Project Implementation & Coding Tasks
When given a new feature, refactoring, bug fix, or complex implementation task in QualCount:
- **Prompt Master Refinement Step**: Before mutating files or running multi-step implementations, deconstruct the task using the installed `prompt-master` skill. Silently extract the 9 intent dimensions (task, target runtime, inputs, outputs, constraints, context, audience, success criteria, examples).
- **QualCount Architectural Constraints**:
  - Pure TypeScript engines in `src/engine/*` (zero imports from `react`, `window`, `document`, or `localStorage`).
  - State I/O strictly implements `WorkspaceRepository`.
  - Offline-first execution and JSON-serializable state.
- **Display Refined Spec & Execute**: Briefly state the refined execution contract (🎯 Objective, 🔒 Constraints & Scope Boundaries, ✅ Definition of Done), then immediately proceed with implementation and verification against that contract (unless the user explicitly requested approval before execution).
- **Exceptions**: Skip refinement for quick one-off lookups, reading files, simple conversational questions, or trivial single-command tasks.

## 2. Prompt Writing & Optimization Requests
Whenever asked to write, improve, or adapt a prompt for an AI tool (Cursor, Claude Code, etc.), activate and apply `prompt-master` rules automatically without requiring any slash command.
