# Project-Local: Self-Refining Task Execution with Prompt Master

When given a new feature, refactoring, bug fix, or complex implementation task in this project:

1. **Prompt Master Refinement Step**:
   - Before mutating files or running multi-step implementations, deconstruct the task using the installed `prompt-master` skill (`~/.gemini/config/skills/prompt-master/SKILL.md`).
   - Silently extract the 9 intent dimensions (task, target runtime, inputs, outputs, constraints, context, audience, success criteria, examples).
   - Incorporate QualCount architectural invariants:
     - Strict TypeScript; zero runtime dependencies or DOM imports inside `src/engine/*`.
     - Data layer interactions strictly adhere to `WorkspaceRepository`.
     - Offline-first execution and JSON-serializable state.
   - If critical technical constraints or dependencies are ambiguous, ask up to 3 focused clarifying questions.

2. **Display Refined Spec & Execute**:
   - Briefly state the refined execution contract (🎯 Objective, 🔒 Constraints & Scope Boundaries, ✅ Definition of Done).
   - Immediately proceed with implementation and verification against that contract, unless the user explicitly requested approval before execution.

3. **Exceptions**:
   - Skip refinement for quick one-off lookups, reading files, simple questions, or trivial single-command tasks.
