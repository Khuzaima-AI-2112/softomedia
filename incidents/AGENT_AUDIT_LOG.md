# Agent Audit Log

This file permanently logs any attempts to bypass or violate rules established in `AGENTS.md`, along with the explicit user permissions granted or denied when invoking the Absolute Stop Protocol (Rule 14.16).

## Format 
Append new entries at the bottom of this file in the following format:
`## [YYYY-MM-DD HH:MM:SS] Violation Attempt`
- **Rule Violated**: [Rule Number]
- **User Prompt**: [The exact prompt or instruction]
- **Agent Action**: Stopped and requested permission.
- **Permission Result**: [Granted / Denied / Amended `AGENTS.md`]

---
