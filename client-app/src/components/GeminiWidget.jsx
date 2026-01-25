
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import useGeminiStore from '../stores/GeminiStore';
import { captureScreen } from '../services/SnapshotService';
import ReactMarkdown from 'react-markdown'; // Ensure this is installed or handle if not

/**
 * GeminiWidget (The Observer)
 * Sprint 2: Recording Implementation
 */
const GeminiWidget = () => {
    // Global State (Zustand)
    const {
        isOpen, toggleOpen,
        isRecording, startRecording, cancelRecording,
        steps, addStep,
        isAnalyzing, response, error
    } = useGeminiStore();

    // Local State (Input)
    const [currentNote, setCurrentNote] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);

    // Safety
    if (typeof document === 'undefined') return null;

    // Actions
    const handleCaptureStep = async () => {
        if (isCapturing) return; // Debounce
        setIsCapturing(true);

        // 1. Capture Screenshot
        const image = await captureScreen();

        // 2. Add to Store
        addStep({
            url: window.location.pathname,
            note: currentNote || 'No specific note provided.',
            image: image,
            capturedAt: new Date().toISOString()
        });

        // 3. Reset Local State
        setCurrentNote('');
        setIsCapturing(false);
    };

    const handleFinish = async () => {
        await useGeminiStore.getState().submitQuery();
    };

    return createPortal(
        <div
            className="gemini-widget-container fixed bottom-6 right-6 z-[9999] font-sans gemini-ignore-capture"
            style={{ isolation: 'isolate' }}
        >
            {/* The Toggle Button */}
            {!isOpen && (
                <button
                    onClick={toggleOpen}
                    className="flex items-center gap-2 px-5 py-3 rounded-full shadow-lg shadow-blue-600/20 bg-gradient-to-r from-violet-600 via-blue-600 to-indigo-600 text-white transition-all duration-300 hover:scale-105 hover:shadow-blue-600/40 active:scale-95 border border-white/10"
                >
                    <span className="material-symbols-outlined text-xl">smart_toy</span>
                    <span className="font-semibold text-sm">Ask Gemini</span>
                </button>
            )}

            {/* The Interface Panel */}
            {isOpen && (
                <div className="w-[450px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-4 duration-300 ring-1 ring-black/5 dark:ring-white/10">

                    {/* Header */}
                    <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800/80 flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">psychology</span>
                                Context Assistant
                            </h3>
                            <div className="flex gap-1 ml-7">
                                <button
                                    onClick={() => useGeminiStore.getState().setPersona('CRM_buyer_persona')}
                                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${useGeminiStore.getState().currentPersona === 'CRM_buyer_persona' ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                                >
                                    Buyer
                                </button>
                                <button
                                    onClick={() => useGeminiStore.getState().setPersona('software_tester_persona')}
                                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${useGeminiStore.getState().currentPersona === 'software_tester_persona' ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-300' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                                >
                                    Tester
                                </button>
                            </div>
                        </div>
                        <button onClick={toggleOpen} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">

                        {/* MODE: LOADING */}
                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-10 flex flex-col items-center justify-center p-6 text-center">
                                <span className="material-symbols-outlined text-4xl text-primary animate-pulse mb-4">memory</span>
                                <h4 className="font-bold text-slate-800 dark:text-white">Analyzing Context...</h4>
                                <p className="text-sm text-slate-500 mt-2">I&apos;m reviewing your screenshots and notes to identify the issue.</p>
                            </div>
                        )}

                        {/* MODE: IDLE */}
                        {!isRecording && !response && !isAnalyzing && (
                            <div className="text-center space-y-4 py-4">
                                <div className="size-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto text-primary">
                                    <span className="material-symbols-outlined text-3xl">videocam</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white">Start a Walkthrough</h4>
                                    <p className="text-sm text-slate-500 mt-1 px-4">
                                        Navigate through the app and record up to 3 steps. I&apos;ll analyze the context to debug your issue.
                                    </p>
                                </div>
                                <button
                                    onClick={startRecording}
                                    className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Start Recording
                                </button>
                            </div>
                        )}

                        {/* MODE: RECORDING */}
                        {isRecording && (
                            <div className="space-y-4">
                                {/* Step Indicator */}
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <span>Recording Context</span>
                                    <span>{steps.length} / 3 Steps</span>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${(steps.length / 3) * 100}%` }}
                                    ></div>
                                </div>

                                {/* Captured Steps List */}
                                <div className="space-y-2">
                                    {steps.map((step, idx) => (
                                        <div key={step.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex gap-3 group relative">
                                            <div className="shrink-0 w-16 h-10 bg-slate-200 rounded overflow-hidden relative">
                                                {step.image ? (
                                                    <img src={step.image} alt="Step" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">N/A</div>
                                                )}
                                                <div className="absolute top-0 left-0 bg-black/50 text-white text-[8px] px-1">#{idx + 1}</div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-mono text-slate-400 truncate">{step.url}</div>
                                                <div className="text-sm text-slate-700 dark:text-slate-300 truncate">{step.note}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Current Step Input */}
                                {steps.length < 3 ? (
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border-2 border-primary/20 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                        <label className="block text-xs font-semibold text-primary mb-2">
                                            Current Screen Note
                                        </label>
                                        <textarea
                                            value={currentNote}
                                            onChange={(e) => setCurrentNote(e.target.value)}
                                            placeholder="Example: 'Values here don't match the summary...'"
                                            className="w-full p-2 text-sm border rounded bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary resize-none h-20"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleCaptureStep}
                                            disabled={isCapturing}
                                            className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded hover:bg-black transition-colors disabled:opacity-50"
                                        >
                                            {isCapturing ? (
                                                <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-sm">center_focus_strong</span>
                                            )}
                                            {isCapturing ? 'Capturing...' : 'Capture Snapshot'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
                                        Max steps reached. Please submit your query.
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={cancelRecording}
                                        className="flex-1 py-2 text-sm text-red-500 hover:bg-red-50 rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        disabled={steps.length === 0}
                                        className="flex-1 py-2 bg-primary text-white text-sm font-medium rounded shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Finish & Ask AI
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* MODE: RESULT */}
                        {response && (
                            <div className="space-y-4">
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>{response}</ReactMarkdown>
                                </div>
                                <button
                                    onClick={startRecording} // Restart
                                    className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 transition-colors text-sm"
                                >
                                    Start New Session
                                </button>
                            </div>
                        )}

                        {/* MODE: ERROR */}
                        {error && (
                            <div className="space-y-4 pt-4">
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <span className="material-symbols-outlined">error</span>
                                        Analysis Failed
                                    </div>
                                    {error}
                                </div>
                                <button
                                    onClick={() => handleFinish()} // Retry
                                    className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded shadow-sm hover:bg-slate-50 transition-colors text-sm"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={cancelRecording}
                                    className="w-full py-2 text-slate-500 text-xs hover:text-slate-700"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {/* Usage Stats */}
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                            <div>
                                <span className="font-bold text-primary">API Usage: </span>
                                Session {useGeminiStore.getState().sessionCount} | Daily {useGeminiStore.getState().dailyCount}
                            </div>
                            <div>v2.0-flash</div>
                        </div>

                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default GeminiWidget;
