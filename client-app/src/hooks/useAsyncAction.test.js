import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useAsyncAction from './useAsyncAction';

describe('useAsyncAction', () => {
    it('initial state is correct', () => {
        const { result } = renderHook(() => useAsyncAction(async () => { }));
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
        expect(result.current.data).toBe(null);
    });

    it('manages loading and success state', async () => {
        const mockFn = vi.fn().mockResolvedValue('success-data');
        const { result } = renderHook(() => useAsyncAction(mockFn));

        let promise;
        await act(async () => {
            promise = result.current.execute('arg1');
        });

        const data = await promise;
        expect(data).toBe('success-data');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBe('success-data');
        expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    it('handles errors', async () => {
        const error = new Error('failed');
        const mockFn = vi.fn().mockRejectedValue(error);
        const { result } = renderHook(() => useAsyncAction(mockFn));

        await act(async () => {
            try {
                await result.current.execute();
            } catch (e) {
                // ignore
            }
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(error);
    });

    it('calls onSuccess callback', async () => {
        const onSuccess = vi.fn();
        const mockFn = vi.fn().mockResolvedValue('data');
        const { result } = renderHook(() => useAsyncAction(mockFn, { onSuccess }));

        await act(async () => {
            await result.current.execute();
        });

        expect(onSuccess).toHaveBeenCalledWith('data');
    });
});
