import { useState } from 'react';

export default function FiltersSheet({ isOpen, onClose, filterTrend, setFilterTrend, filterVCP, setFilterVCP, filterSector, setFilterSector, sectors, sortKey, setSortKey, onApply }) {
  if (!isOpen) return null;

  const sortOptions = [
    { key: 'rs_rating', label: 'RS Rating (highest)' },
    { key: 'distance_from_pivot_pct', label: 'Distance from Pivot' },
    { key: 'ticker', label: 'Ticker (A-Z)' },
    { key: 'price', label: 'Price' },
  ];

  const activeFilterCount = (filterTrend ? 1 : 0) + (filterVCP ? 1 : 0) + (filterSector ? 1 : 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-gray-800 rounded-t-2xl max-h-[75vh] overflow-y-auto safe-bottom border-t border-gray-600 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 rounded-t-2xl px-4 py-3 border-b border-gray-700 flex items-center justify-between z-10">
          <h3 className="text-base font-semibold text-white">
            Filters & Sort
            {activeFilterCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Sort */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sort by</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {sortOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`px-3 py-2.5 rounded-lg text-xs text-left min-h-[44px] transition-colors ${
                    sortKey === opt.key
                      ? 'bg-blue-900/40 border border-blue-700 text-blue-200'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Filters</h4>
            <div className="space-y-1.5">
              <label className="flex items-center gap-3 py-3 px-3 bg-gray-700/50 rounded-lg cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={filterTrend}
                  onChange={e => setFilterTrend(e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm text-gray-200">Trend Template passers only</div>
                  <div className="text-xs text-gray-400">Stocks meeting all 8 conditions</div>
                </div>
              </label>
              <label className="flex items-center gap-3 py-3 px-3 bg-gray-700/50 rounded-lg cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={filterVCP}
                  onChange={e => setFilterVCP(e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm text-gray-200">VCP detected only</div>
                  <div className="text-xs text-gray-400">Volatility Contraction Pattern</div>
                </div>
              </label>
            </div>
          </div>

          {/* Sector */}
          {sectors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sector</h4>
              <select
                value={filterSector}
                onChange={e => setFilterSector(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-sm text-white min-h-[44px]"
              >
                <option value="">All Sectors</option>
                {sectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Apply button */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 safe-bottom">
          <button
            onClick={onApply || onClose}
            className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl min-h-[52px] text-base"
          >
            Show Results
          </button>
        </div>
      </div>
    </>
  );
}
