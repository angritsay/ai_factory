# Guidelines for Codex Agents

This repository contains a Vite + React frontend and an Express backend. It does not have automated tests yet.

## Validation steps
1. Install dependencies if they are missing:
   ```bash
   npm install
   ```
2. Run the build to ensure TypeScript compiles and the client builds:
   ```bash
   npm run build
   ```
   The command should finish without errors.

## Pull request message
When creating a pull request summarize the changes and include the build output in the **Testing** section. If any command fails because of missing dependencies or network restrictions, mention it.
