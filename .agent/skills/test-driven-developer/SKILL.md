name: test-driven-developer
description: Enforces Test-Driven Development practices. When creating or modifying UI components, this skill ensures data-testid attributes are added to interactive elements and corresponding test coverage is maintained.

# Test-Driven Developer Skill

## Goal
Transform the agent into a proactive TDD practitioner who **prevents test failures before they happen**. This skill ensures that every UI component is built with testability in mind from the start, eliminating the painful cycle of "write code → tests fail → debug selectors."

## Core Principles
- **Testability First**: Every interactive element gets a `data-testid` attribute at creation time
- **Tests Travel with Code**: When creating a component, generate test stubs alongside it
- **Never Break What Works**: Before removing/renaming a `data-testid`, update the corresponding tests
- **Semantic Naming**: Test IDs should be descriptive and follow a consistent convention
- **Visible Changes**: Document test ID additions in commit messages

## When to Use This Skill
Activate this skill whenever:
- Creating new React/Vue/Svelte components with interactive elements
- Adding buttons, forms, inputs, cards, or clickable elements to existing components
- Modifying component structure in ways that could affect E2E tests
- Refactoring components that are covered by E2E tests
- The user asks for "testable" or "TDD" approach

## Operational Guidelines

### On Component Creation
When creating a new component with interactive elements:

1. **Identify Interactive Elements**
   - Buttons (submit, cancel, action buttons)
   - Form inputs (text fields, selects, checkboxes)
   - Clickable cards or list items
   - Navigation links
   - Modals and dialogs
   - Loading states and error states

2. **Add data-testid Attributes**
   Use this naming convention:
   ```
   [component-name]-[element-type]-[descriptor]
   ```
   Examples:
   - `login-form-submit-btn`
   - `user-profile-avatar`
   - `campaign-card-${campaign.id}`
   - `modal-close-btn`

3. **Dynamic IDs for Lists**
   For dynamically rendered items, use the item's unique identifier:
   ```jsx
   data-testid={`store-${store.name.toLowerCase().replace(/\s+/g, '-')}`}
   data-testid={`campaign-row-${campaign.id}`}
   ```

4. **Generate Test Stub**
   After creating a component, offer to create a corresponding test file:
   ```javascript
   test.describe('ComponentName', () => {
       test('should render correctly', async ({ page }) => {
           await expect(page.locator('[data-testid="component-main"]')).toBeVisible();
       });
       
       test('should handle user interaction', async ({ page }) => {
           await page.locator('[data-testid="component-action-btn"]').click();
           // Assert expected outcome
       });
   });
   ```

### On Component Modification
When modifying an existing component:

1. **Check for Existing Test Coverage**
   Before changing the component, search for E2E tests that reference it:
   ```
   grep -r "data-testid.*component-name" tests/
   ```

2. **Preserve Test IDs**
   If removing or renaming elements with `data-testid`:
   - First, find and update the corresponding tests
   - Never silently remove a `data-testid` that tests depend on
   - If the ID must change, update BOTH the component AND the test in the same commit

3. **Add Missing Test IDs**
   If modifying a component that lacks proper test coverage:
   - Proactively add `data-testid` to interactive elements
   - Offer to generate test stubs for the new functionality

### Test ID Naming Convention
Follow this hierarchy:
```
[page/feature]-[component]-[element]-[action/state]
```

| Element Type | Convention | Example |
|--------------|------------|---------|
| Buttons | `*-btn` or `*-button` | `login-submit-btn` |
| Inputs | `*-input` or `*-field` | `email-input` |
| Cards/Items | `*-card` or `*-item` | `campaign-card-123` |
| Modals | `modal-*` | `modal-confirm-delete` |
| Tables | `table-*` or `*-row` | `users-table-row-5` |
| Forms | `form-*` | `form-create-campaign` |
| Steps/Wizards | `wizard-step-*` or `step-*` | `wizard-next-step` |

### Standard Test IDs Checklist
When creating components, ensure these elements have test IDs:

```markdown
- [ ] Primary action button (submit, save, create)
- [ ] Secondary action button (cancel, back, close)
- [ ] Form inputs (all fields)
- [ ] Error messages
- [ ] Loading states
- [ ] Success confirmations
- [ ] Navigation elements
- [ ] List items (with dynamic IDs)
- [ ] Modal/dialog containers
```

## Example Interactions

### Example 1: New Component Creation
**User**: "Create a login form component."

**Agent Response** (creates component WITH test IDs):
```jsx
const LoginForm = () => {
    return (
        <form data-testid="login-form">
            <input 
                type="email" 
                data-testid="login-email-input"
                placeholder="Email"
            />
            <input 
                type="password" 
                data-testid="login-password-input"
                placeholder="Password"
            />
            <button 
                type="submit" 
                data-testid="login-submit-btn"
            >
                Sign In
            </button>
            <a 
                href="/forgot-password"
                data-testid="login-forgot-password-link"
            >
                Forgot Password?
            </a>
        </form>
    );
};
```

**Agent then offers**:
```text
I've created LoginForm.jsx with 4 test IDs:
- login-form (container)
- login-email-input
- login-password-input
- login-submit-btn
- login-forgot-password-link

Would you like me to generate a test stub file at tests/login.spec.js?
```

### Example 2: Modifying a Component
**User**: "Remove the forgot password link from the login form."

**Agent Response** (checks tests first):
```text
Before removing the forgot password link, I found this test that depends on it:

  tests/auth.spec.js:
    line 45: await page.locator('[data-testid="login-forgot-password-link"]').click();

Options:
A) Remove the link AND update the test to skip/remove that assertion
B) Remove the link and let me help you update the test separately
C) Keep the link and make it conditionally rendered instead

Which approach would you prefer?
```

### Example 3: Component Without Test IDs
**User**: "Add a delete button to the UserCard component."

**Agent Response** (adds with test ID):
```jsx
// Adding delete button with proper test ID
<button
    onClick={onDelete}
    data-testid={`user-card-delete-btn-${user.id}`}
    className="text-red-500 hover:text-red-700"
>
    Delete
</button>
```

**Agent notes**:
```text
Added delete button with data-testid="user-card-delete-btn-{userId}".

The dynamic ID pattern allows E2E tests to target specific users:
  await page.locator('[data-testid="user-card-delete-btn-user_123"]').click();

Would you like me to add a test case for the delete functionality?
```

## Key Phrases to Remember
When operating under this skill, internalize these mantras:
- "If it's clickable, it gets a test ID."
- "Tests and code ship together."
- "Semantic IDs prevent debugging headaches."
- "Check tests before changing components."
- "Proactive coverage, not reactive fixes."

## Integration with Other Skills
This skill works alongside:
- **test-id-guardian**: Validates that test IDs in E2E tests exist in components
- **test-auth-guardian**: Ensures auth setup matches app requirements
- **diligent-coder**: Provides the careful, approval-gated execution model
