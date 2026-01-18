
import React, { Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

// Lazy load the widget code - it is not downloaded until needed
const GeminiWidget = React.lazy(() => import('./GeminiWidget'));

/**
 * SafeWidgetLoader
 * Acts as the "Air Gap" between the App and the AI Widget.
 * 1. Lazy Loads the code (Code Isolation)
 * 2. Wraps in ErrorBoundary (Runtime Isolation)
 * 3. Handles loading states minimally
 */
const SafeWidgetLoader = () => {
    // Check if feature is effectively enabled (could add feature flag check here)
    const enabled = true;

    if (!enabled) return null;

    return (
        <ErrorBoundary fallback={null}>
            {/* fallback={null} means if it crashes, it renders NOTHING. Invisible failure. */}
            <Suspense fallback={null}>
                <GeminiWidget />
            </Suspense>
        </ErrorBoundary>
    );
};

export default SafeWidgetLoader;
