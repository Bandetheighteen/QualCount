# Project-Local Rules: QualCount

This workspace uses Prompt Master for task refinement before code execution.

## Self-Refining Task Execution

When given a new feature, refactoring, bug fix, or complex implementation task in QualCount:

1. **Prompt Master Refinement Step**:
   - Before mutating files or running multi-step implementations, deconstruct the task using the installed `prompt-master` skill.
   - Silently extract the 9 intent dimensions (task, target runtime, inputs, outputs, constraints, context, audience, success criteria, examples).
   - Enforce QualCount architectural constraints:
     - Pure TypeScript engines in `src/engine/*` (no React, window, document, or localStorage imports).
     - State I/O strictly implements `WorkspaceRepository`.
     - Offline-first execution and JSON-serializable state.
   - If critical technical constraints or dependencies are ambiguous, ask up to 3 focused clarifying questions.

2. **Display Refined Spec & Execute**:
   - Briefly state the refined execution contract (🎯 Objective, 🔒 Constraints & Scope Boundaries, ✅ Definition of Done).
   - Immediately proceed with implementation and verification against that contract, unless the user explicitly requested approval before execution.

3. **Exceptions**:
   - Skip refinement for quick one-off lookups, reading files, simple questions, or trivial single-command tasks.
