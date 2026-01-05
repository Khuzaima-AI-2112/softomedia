/**
 * PriceDisplay Component
 * Consistent price formatting with CPM and impression display
 */

import React from 'react';
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

// Compact inline version
export function PriceInline({ price, className = '' }) {
    const formattedPrice = pricingService.formatPrice(price);
    return (
        <span className={`font-semibold text-primary ${className}`}>
            {formattedPrice}
        </span>
    );
}

// Total summary version
export function PriceSummary({
    totalPrice,
    totalSlots,
    totalImpressions,
    className = ''
}) {
    const formattedPrice = pricingService.formatPrice(totalPrice);
    const formattedImpressions = pricingService.formatImpressions(totalImpressions);

    return (
        <div className={`rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 ${className}`}>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Campaign Total
                    </p>
                    <p className="text-3xl font-black text-primary mt-1">
                        {formattedPrice}
                    </p>
                </div>
                <div className="text-right">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                            <span className="font-bold">{totalSlots}</span> slots
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                            <span className="font-bold">~{formattedImpressions}</span> impressions
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PriceDisplay;
