# SRE Policy: Zero-Interference AI Integration
**Date**: 2026-01-18
**Type**: Pre-emptive Policy / Guardrail Definition
**Priority**: CRITICAL
**Scope**: All AI-related Features (Gemini Assistant, Context Recording)

## Executive Summary
This document establishes the **"Zero-Interference"** mandate for integrating AI capabilities into the AdManager platform. Given the critical nature of the core application (calculated pricing, campaign management), the AI Assistant must operate as a strictly isolated "Ghost" layer.

**Core Directive**: The AI feature must NEVER cause a crash, performance degradation, or state corruption in the main application. If the AI system fails, it must fail silently and vanish.

## Risk Assessment
The introduction of complex, asynchronous AI features introduces new vectors for instability:
- **Crash Propagation**: Unhandled exceptions in the assistant widget could unmount the entire React tree.
- **Performance Bloat**: Loading large libraries (`html2canvas`, `react-markdown`) could slow down initial page loads.
- **State Pollution**: Shared contexts could accidentally trigger re-renders or unwanted side effects in core business logic.

## The "False-Wall" Architecture
To mitigate these risks, we are enforcing a strict "False-Wall" architecture:

### 1. Visual Isolation (Portals)
- **Requirement**: The `GeminiWidget` must NOT be rendered within the main `App` DOM hierarchy.
- **Implementation**: It will be rendered via `React.createPortal` directly to `document.body` or a dedicated `#ghost-root` div.
- **Benefit**: CSS or layout bugs in the widget cannot "break" the layout of the main dashboard.

### 2. Execution Isolation (Error Boundaries)
- **Requirement**: The entire AI feature must be wrapped in a dedicated, strict `ErrorBoundary`.
- **Behavior**: Upon catching *any* error (network, rendering, logic), the boundary will simply return `null` (rendering nothing), effectively "hiding" the feature rather than showing a crash screen.

### 3. State Isolation (Zustand)
- **Requirement**: DO NOT use React Context providers that wrap the main `App` component.
- **Implementation**: Use `Zustand` for state management. This store exists outside the React component tree and does not trigger re-renders in parents when updated.
- **Benefit**: No risk of "Prop Drilling" or unnecessary re-renders affecting the performance of the main application.

### 4. Network Isolation (Fail-Silent)
- **Requirement**: All backend routes for AI (`/ghost-api/*`) must be independent.
- **Middleware**: A `guardrails` middleware must wrap every handler. It enforces strict timeouts (5s) and catches all exceptions, ensuring the server *never* crashes due to an AI error.
- **IP Restriction**: Access is strictly limited to the development IP (`DEV_ALLOWED_IP`) for both local and cloud environments.

## Verification Protocol
Before any AI feature is merged to `main`, it must pass the **"Chaos Test"**:
1.  **Network Kill**: Disconnect internet while Assistant is processing -> App must function normally.
2.  **Widget Crash**: Intentionally throw error in Widget render -> Widget disappears, App stays.
3.  **Backend Timeout**: Simulate 60s backend delay -> UI handles gracefully (timeout/cancel), App stays responsive.

## Conclusion
The AI Assistant is a guest in this house. It is welcome to observe and assist, but if it causes trouble, it will be ejected immediately without impacting the residents.
