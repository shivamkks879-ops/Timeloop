# Timeloop — Project Import and Audit

Bring the uploaded Timeloop project (Timeloop-main.zip) into the workspace exactly as it is, then give a short read-only audit of it.
No features, design or settings change until the user gives a specific task.

## Who it's for
The Timeloop project owner. They want to carry on the existing project with as few credits as possible, and they need a clear picture of its current state first.

## Current state
- The workspace has only the platform's blank starter. Timeloop's code is not in it yet.
- Timeloop-main.zip has been uploaded. It is a compressed file, so it can't be opened in this read-only step. Unpacking it is the first action once this plan is approved.

## Core features and experience
1. **Faithful import:** unpack the zip and put Timeloop's files in the workspace exactly as they are. No renaming, restructuring or rewriting.
2. **Read-only audit (main files and config only):**
   - project name and architecture
   - features that are already done
   - features that are unfinished
   - errors or risks found
   - configuration that is missing (Firebase settings, API keys, environment values)
   - whether the project is ready to continue
3. **Stop and wait:** no edits after the audit until the user approves.

## User flow
1. The user approves this plan.
2. Timeloop is unpacked into the workspace.
3. The main files and config are inspected without running repeated builds.
4. The user gets the concise audit.
5. The user picks the clear bugs they want fixed, or gives a specific task.

## UI/UX feel
- Timeloop's existing look, theme, layouts and navigation are kept exactly as they are.

## Implementation phases
- **Phase 1 (now, MVP):** Unpack Timeloop into the workspace and deliver the audit. No code changes.
- **Phase 2:** Fix only the clear, confirmed bugs the user approves from the audit, with small targeted edits.
- **Phase 3:** Carry out the user's specific tasks one at a time.

## Assumptions
- The zip holds the full, current Timeloop project from GitHub.
- If Timeloop's setup doesn't match the workspace (for example, it uses a different framework or relies on Firebase instead of the workspace database), the mismatch is reported in the audit and not "fixed" on the spot. The user decides how to handle it.
- The starter files are replaced by Timeloop's files wherever both exist. The workspace's own connection settings are not touched.
- Firebase configuration, authentication, environment values, secrets, deployment and domains are kept exactly as they are. Any missing Firebase keys are listed in the audit and requested later through the secure key form, never in chat.
- Nothing new is installed beyond what Timeloop already lists as its own dependencies, and only if inspecting it requires that.
- The user's two answers ("audit only" and "also fix clear bugs") are read together like this: nothing is edited until the user approves, and after that only clear bugs are fixed.
