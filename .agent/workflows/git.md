---
description: Stage, commit, and push changes to GitHub with a descriptive message
---

This workflow automates the version control process, ensuring that the latest changes are safely committed and pushed to the remote repository.

### Commit and Push
// turbo
1. Stage all changes, commit with a descriptive message, and push to origin:
   ```powershell
   git add .
   git commit -m "feat: implement pricing robustness, SRE stability report, and governance workflows"
   git push origin main
   ```

### Verification
2. Confirm the push was successful by checking the remote branch status:
   ```powershell
   git status
   git log -n 1
   ```
