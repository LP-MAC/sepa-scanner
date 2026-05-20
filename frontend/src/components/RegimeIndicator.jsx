import { useState, useEffect } from 'react';
import { getRegime } from '../lib/api';

export default function RegimeIndicator() {
  const [regime, setRegime] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getRegime().then(setRegime).catch(() => setRegime({ label: 'Unknown', dot_color: 'yellow' }));
  }, []);

  if (!regime) return <div className="text-gray-500 text-xs sm:text-sm">Loading...</div>;

  const dotColor = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' }[regime.dot_color] || 'bg-gray-500';

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-h-[36px] sm:min-h-[44px] px-2 hover:bg-gray-700/50 rounded-lg transition-colors"
        aria-label={`Market regime: ${regime.label}. Tap for details.`}
        aria-expanded={expanded}
      >
        <span className="text-gray-400 hidden sm:inline">Market:</span>
        <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dotColor}`}></span>
        <span className="font-medium">{regime.label}</span>
        <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-20 md:hidden" onClick={() => setExpanded(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-600 rounded-xl shadow-xl z-30 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">SPY Price</span>
              <span className="font-mono text-white">${regime.spy_price?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">SPY 50 SMA</span>
              <span className="font-mono text-white">${regime.spy_sma_50?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">SPY 200 SMA</span>
              <span className="font-mono text-white">${regime.spy_sma_200?.toFixed(2) || '—'}</span>
            </div>
            <div className="border-t border-gray-700 pt-2">
              <div className="text-gray-500">
                {regime.is_bullish
                  ? 'Price above 200 SMA and 50 SMA above 200 SMA'
                  : 'One or both conditions not met'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
