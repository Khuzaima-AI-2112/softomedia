import { useState, useCallback } from 'react';

/**
 * useAsyncAction - A hook for managing async operations with loading/error states
 * 
 * Prevents race conditions in E2E tests by automatically managing loading state
 * and disabling buttons during async operations.
 * 
 * @param {Function} asyncFn - The async function to execute
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Callback when operation succeeds
 * @param {Function} options.onError - Callback when operation fails
 * @returns {Object} { execute, isLoading, error, reset }
 * 
 * @example
 * const { execute, isLoading, error } = useAsyncAction(
 *   async () => await fetch('/api/upload'),
 *   { onSuccess: () => navigate('/next') }
 * );
 * 
 * <button disabled={isLoading} onClick={execute}>
 *   {isLoading ? 'Uploading...' : 'Upload'}
 * </button>
 */
const useAsyncAction = (asyncFn, options = {}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const { onSuccess, onError } = options;

    const execute = useCallback(async (...args) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await asyncFn(...args);
            setData(result);

            if (onSuccess) {
                onSuccess(result);
            }

            return result;
        } catch (err) {
            setError(err);

            if (onError) {
                onError(err);
            }

            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [asyncFn, onSuccess, onError]);

    const reset = useCallback(() => {
        setIsLoading(false);
        setError(null);
        setData(null);
    }, []);

    return {
        execute,
        isLoading,
        error,
        data,
        reset
    };
};

export default useAsyncAction;
