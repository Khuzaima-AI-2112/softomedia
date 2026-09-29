/**
 * PriceDisplay Component
 * Consistent price formatting with CPM and impression display
 */

import pricingService from '../services/PricingService';

function PriceDisplay({
    price,
    impressions = null,
    showCPM = false,
    size = 'default',
    className = ''
}) {
    const formattedPrice = pricingService.formatPrice(price);
    const formattedImpressions = impressions ? pricingService.formatImpressions(impressions) : null;

    const sizeClasses = {
        small: 'text-sm',
        default: 'text-base',
        large: 'text-lg',
        xl: 'text-2xl'
    };

    return (
        <div className={`inline-flex flex-col ${className}`}>
            <span className={`font-bold text-slate-900 dark:text-white ${sizeClasses[size]}`}>
                {formattedPrice}
                {showCPM && <span className="text-xs font-normal text-slate-500 ml-1">CPM</span>}
            </span>
            {formattedImpressions && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    ~{formattedImpressions} impressions
                </span>
            )}
        </div>
    );
}

export default PriceDisplay;
