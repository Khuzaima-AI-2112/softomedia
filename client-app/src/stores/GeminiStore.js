
import { create } from 'zustand';
import { API_URL } from '../config';

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
    // New State for Multi-Model & Custom Persona
    currentModel: 'gemini-2.0-flash',
    customInstructions: {}, // { personaKey: "instruction text" }

    sessionCount: 0,
    dailyCount: 0,
    // Rating state
    currentTicketId: null,
    hasRated: false,
    // Conversation state
    conversationId: null,
    messages: [], // Array<{ role: 'user'|'assistant', content: string, timestamp: string, steps?: array }>
    isFollowUp: false,
    followUpText: '',
    
    // Section label overlay toggle for Super Admin debugging
    showSectionLabels: false,

    // Actions
    toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
    
    // Section label overlay toggle for Super Admin debugging
    toggleSectionLabels: () => set((state) => ({ showSectionLabels: !state.showSectionLabels })),

    startRecording: () => set({
        isRecording: true,
        steps: [],
        response: null,
        error: null,
        currentTicketId: null,
        hasRated: false,
        isFollowUp: false,
        followUpText: ''
    }),

    cancelRecording: () => set({ isRecording: false, steps: [], isFollowUp: false, followUpText: '' }),

    // Conversation actions
    startNewConversation: () => set({
        isRecording: true,
        steps: [],
        response: null,
        error: null,
        currentTicketId: null,
        hasRated: false,
        conversationId: null,
        messages: [],
        isFollowUp: false,
        followUpText: ''
    }),

    continueConversation: () => set({
        isFollowUp: true,
        followUpText: '',
        hasRated: false
    }),

    setFollowUpText: (text) => set({ followUpText: text }),

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

    // New Actions
    setModel: (model) => set({ currentModel: model }),

    setCustomInstruction: (persona, instruction) => set((state) => ({
        customInstructions: {
            ...state.customInstructions,
            [persona]: instruction
        }
    })),

    submitQuery: async () => {
        set({ isRecording: false, isAnalyzing: true, error: null });
        const { steps, conversationId, messages, currentPersona, isFollowUp, followUpText, currentModel, customInstructions } = get();

        try {
            // Use centralized API URL
            const apiUrl = `${API_URL}/ghost-api/analyze`;

            // Build user message for conversation history
            const userMessage = {
                role: 'user',
                content: isFollowUp ? followUpText : (steps[0]?.note || 'Analysis request'),
                timestamp: new Date().toISOString(),
                steps: isFollowUp ? null : steps
            };

            // Build request payload
            const payload = {
                steps: isFollowUp ? [] : steps,
                persona: currentPersona,
                conversationId: conversationId,
                // Include previous messages for context (text only, no images)
                conversationHistory: messages.map(m => ({
                    role: m.role,
                    content: m.role === 'user' ? (m.steps ? `[Screenshots + Note: ${m.content}]` : m.content) : m.content
                })),
                followUpText: isFollowUp ? followUpText : null,
                // New Fields
                model: currentModel,
                systemInstruction: customInstructions[currentPersona] || null
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server Error: ${response.status}`);
            }

            const data = await response.json();

            // Build assistant message
            const assistantMessage = {
                role: 'assistant',
                content: data.answer,
                timestamp: new Date().toISOString(),
                ticketId: data.ticketId
            };

            set((state) => ({
                response: data.answer,
                isAnalyzing: false,
                sessionCount: state.sessionCount + 1,
                dailyCount: data.usage?.daily || state.dailyCount,
                currentTicketId: data.ticketId || null,
                hasRated: false,
                // Update conversation state
                conversationId: data.conversationId || state.conversationId || `conv-${Date.now()}`,
                messages: [...state.messages, userMessage, assistantMessage],
                isFollowUp: false,
                followUpText: ''
            }));

        } catch (err) {
            console.error('[GeminiStore] Analysis failed:', err);
            set({ error: err.message || 'Failed to connect to the Ghost Brain.', isAnalyzing: false });
        }
    },

    submitRating: async ({ rating, feedback }) => {
        const { currentTicketId } = get();
        if (!currentTicketId) {
            console.warn('[GeminiStore] No ticket ID to rate');
            return false;
        }

        try {
            const apiUrl = `${API_URL}/ghost-api/tickets/${currentTicketId}/rate`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, feedback })
            });

            if (!response.ok) {
                throw new Error(`Rating failed: ${response.status}`);
            }

            set({ hasRated: true });
            console.log(`[GeminiStore] Rated ticket ${currentTicketId}: ${rating} stars`);
            return true;

        } catch (err) {
            console.error('[GeminiStore] Rating failed:', err);
            return false;
        }
    },
}));

export default useGeminiStore;
