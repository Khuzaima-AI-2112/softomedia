
import { create } from 'zustand';

/**
 * GeminiStore (Ghost State)
 * Manages the state of the context recorder outside of the main React Tree.
 * This prevents re-renders in the main app when the widget updates.
 */
const useGeminiStore = create((set, get) => ({
    isOpen: false,
    isRecording: false,
    steps: [], // Array<{ id, url, note, capturedAt, image? }>
    response: null,
    isAnalyzing: false,
    error: null,
    currentPersona: 'CRM_buyer_persona', // Default persona
    sessionCount: 0,
    dailyCount: 0,

    // Actions
    toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

    startRecording: () => set({ isRecording: true, steps: [], response: null, error: null }),

    cancelRecording: () => set({ isRecording: false, steps: [] }),

    addStep: (stepData) => {
        const currentSteps = get().steps;
        if (currentSteps.length >= 3) {
            console.warn('[GeminiStore] Step limit reached (Max 3)');
            return; // Safety cap
        }
        set((state) => ({
            steps: [...state.steps, { ...stepData, id: Date.now() }]
        }));
    },

    removeStep: (id) => set((state) => ({
        steps: state.steps.filter((s) => s.id !== id)
    })),

    setExceededLimit: () => {
        // Placeholder for UI feedback
    },

    setPersona: (persona) => set({ currentPersona: persona }),

    submitQuery: async () => {
        set({ isRecording: false, isAnalyzing: true, error: null });
        const { steps } = get();

        try {
            // Determine API URL (assuming localhost:8080 for dev based on package.json/index.js)
            // In a real setup, this might come from env var
            const API_URL = 'http://localhost:8080/ghost-api/analyze';

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps, persona: get().currentPersona })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server Error: ${response.status}`);
            }

            const data = await response.json();
            set((state) => ({
                response: data.answer,
                isAnalyzing: false,
                sessionCount: state.sessionCount + 1,
                dailyCount: data.usage?.daily || state.dailyCount
            }));

        } catch (err) {
            console.error('[GeminiStore] Analysis failed:', err);
            set({ error: err.message || 'Failed to connect to the Ghost Brain.', isAnalyzing: false });
        }
    },
}));

export default useGeminiStore;
