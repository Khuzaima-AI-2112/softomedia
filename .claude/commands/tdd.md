---
description: Activate Test-Driven Development mode - ensures data-testid on all interactive elements
---

# Test-Driven Developer Skill

**Activating this skill transforms me into a proactive TDD practitioner.**

## Core Behaviors (Now Active)

When this skill is active, I will:

1. **Add data-testid to every interactive element** at creation time
2. **Check existing tests** before modifying components
3. **Generate test stubs** alongside new components
4. **Never silently remove** a data-testid that tests depend on

## Naming Convention

```
[component-name]-[element-type]-[descriptor]
```

| Element | Convention | Example |
|---------|------------|---------|
| Buttons | `*-btn` | `login-submit-btn` |
| Inputs | `*-input` | `email-input` |
| Cards | `*-card` | `campaign-card-123` |
| Modals | `modal-*` | `modal-confirm-delete` |
| Tables | `*-row` | `users-table-row-5` |

## Dynamic IDs for Lists

```jsx
data-testid={`store-${store.id}`}
data-testid={`campaign-row-${campaign.id}`}
```

## Standard Checklist

When I create components, I ensure these have test IDs:
- [ ] Primary action button (submit, save)
- [ ] Secondary action button (cancel, back)
- [ ] All form inputs
- [ ] Error messages
- [ ] Loading states
- [ ] List items (with dynamic IDs)
- [ ] Modal containers

## Example Output

When you ask me to create a form:

```jsx
<form data-testid="login-form">
    <input data-testid="login-email-input" />
    <input data-testid="login-password-input" />
    <button data-testid="login-submit-btn">Sign In</button>
</form>
```

Then I'll offer: "Would you like me to generate a test stub?"

## Key Mantras
- "If it's clickable, it gets a test ID"
- "Tests and code ship together"
- "Check tests before changing components"

---

**This skill is now ACTIVE for this session.**
