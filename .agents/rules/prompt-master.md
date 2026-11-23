# Project-Local: Self-Refining Task Execution with Prompt Master

## 1. Project Implementation & Coding Tasks
When given a new feature, refactoring, bug fix, or complex implementation task in this project:
- **Prompt Master Refinement Step**: Before mutating files or running multi-step implementations, deconstruct the task using the installed `prompt-master` skill (`~/.gemini/config/skills/prompt-master/SKILL.md`). Silently extract the 9 intent dimensions (task, target runtime, inputs, outputs, constraints, context, audience, success criteria, examples).
- **QualCount Constraints**: Pure TS in `src/engine/*`, `WorkspaceRepository` boundaries, offline-first execution.
- **Display Refined Spec & Execute**: Briefly state the refined execution contract (🎯 Objective, 🔒 Constraints & Scope Boundaries, ✅ Definition of Done), then immediately proceed with implementation.
- **Exceptions**: Skip refinement for quick one-off lookups, reading files, simple conversational questions, or trivial single-command tasks.

## 2. Prompt Writing & Optimization Requests
Whenever asked in natural language to write, fix, or improve a prompt for an AI tool, automatically use `prompt-master` without requiring a slash command.
