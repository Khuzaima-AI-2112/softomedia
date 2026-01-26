import { useState } from 'react';

/**
 * StarRating Component
 * Reusable 5-star rating with optional text feedback
 *
 * @param {Object} props
 * @param {function} props.onSubmit - Callback with { rating: number, feedback?: string }
 * @param {boolean} props.disabled - Disable interaction after submission
 * @param {boolean} props.showFeedback - Show optional feedback text input (default: true)
 * @param {string} props.className - Additional CSS classes
 */
const StarRating = ({ onSubmit, disabled = false, showFeedback = true, className = '' }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleStarClick = (starIndex) => {
        if (disabled || isSubmitted) return;
        setRating(starIndex);
    };

    const handleSubmit = async () => {
        if (rating === 0 || isSubmitted || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                rating,
                feedback: feedback.trim() || undefined
            });
            setIsSubmitted(true);
        } catch (err) {
            console.error('[StarRating] Submit failed:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submitted state - show thank you message
    if (isSubmitted) {
        return (
            <div className={`flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 ${className}`}>
                <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                <span className="text-sm text-green-700 dark:text-green-300">Thanks for your feedback!</span>
                <div className="ml-auto flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <span
                            key={star}
                            className={`material-symbols-outlined text-sm ${
                                star <= rating
                                    ? 'text-amber-400'
                                    : 'text-slate-300 dark:text-slate-600'
                            }`}
                            style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
                        >
                            star
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}>
            {/* Rating Label */}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                How helpful was this response?
            </div>

            {/* Stars */}
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= (hoverRating || rating);
                    return (
                        <button
                            key={star}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleStarClick(star)}
                            onMouseEnter={() => !disabled && setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className={`p-0.5 transition-all duration-150 ${
                                disabled
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'cursor-pointer hover:scale-110 active:scale-95'
                            }`}
                            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                        >
                            <span
                                className={`material-symbols-outlined text-2xl transition-colors ${
                                    isFilled
                                        ? 'text-amber-400'
                                        : 'text-slate-300 dark:text-slate-600 hover:text-amber-200'
                                }`}
                                style={{ fontVariationSettings: isFilled ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                star
                            </span>
                        </button>
                    );
                })}

                {/* Rating text hint */}
                {(hoverRating || rating) > 0 && (
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        {getRatingText(hoverRating || rating)}
                    </span>
                )}
            </div>

            {/* Optional Feedback Input */}
            {showFeedback && rating > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Any additional feedback? (optional)"
                        className="w-full p-2 text-sm border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none h-16"
                        maxLength={500}
                    />
                    <div className="text-right text-[10px] text-slate-400 mt-1">
                        {feedback.length}/500
                    </div>
                </div>
            )}

            {/* Submit Button */}
            {rating > 0 && (
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            Submitting...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-sm">send</span>
                            Submit Rating
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

// Helper function for rating text
function getRatingText(rating) {
    const texts = {
        1: 'Poor',
        2: 'Fair',
        3: 'Good',
        4: 'Very Good',
        5: 'Excellent'
    };
    return texts[rating] || '';
}

export default StarRating;
