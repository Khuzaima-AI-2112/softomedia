---
description: Clean up temporary logs, debug files, and test artifacts while protecting sacred docs.
---

// turbo-all
1. Terminate all ongoing local or cloud testing processes (Playwright, Puppeteer, Jest):
   ```powershell
   # Gracefully stop known test runners
   Get-Process -Name "node", "playwright", "jest" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*test*" } | Stop-Process -Force -ErrorAction SilentlyContinue
   ```

2. Remove temporary log files from the project root:
   ```powershell
   Remove-Item -Path *.log, telemetry_*.txt, test_output.txt -ErrorAction SilentlyContinue
   ```

2. Remove leftover debug and verification scripts:
   ```powershell
   Remove-Item -Path verify_playlist_api.* -ErrorAction SilentlyContinue
   ```

3. Clean up application-specific lint and test output files:
   ```powershell
   Remove-Item -Path client-app/*.txt, client-app/*.log, ad-server/*.txt, ad-server/*.log -ErrorAction SilentlyContinue
   ```

4. Purge large analysis and reporting directories:
   ```powershell
   Remove-Item -Path client-app/coverage, ad-server/coverage, playwright-report, test-results -Recurse -Force -ErrorAction SilentlyContinue
   ```

5. **Safety Check**: Verify that sacred files remain untouched:
   ```powershell
   Get-Item -Path changelog.md, lessons_learned.md, TODO.md, docs/MVP_SPRINT_PLAN.md
   ```

> [!IMPORTANT]
> **Pre-Cleanup Requirement**: Stop all ongoing local or cloud tests with **Playwright**, **Puppeteer**, **Jest**, or any other testing scripts before running this command to avoid file lock issues and inconsistent states.
> 
> **Data Protection**: This command strictly avoids touching sacred `.md` documentation (changelog, lessons learned, TODO, MVP plans) and `.json` configuration files.
