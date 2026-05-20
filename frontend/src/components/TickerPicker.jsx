import { useState, useEffect, useRef, useCallback } from 'react';
import { searchTickers, validateTickers, getUniverses } from '../lib/api';

const SAVED_KEY = 'sepa-saved-selections';
const MAX_TICKERS = 500;
const MOBILE_CHIP_LIMIT = 20; // Collapse chips beyond this on mobile

export default function TickerPicker({ selectedTickers, setSelectedTickers }) {
  const [mode, setMode] = useState('preset');
  const [universes, setUniverses] = useState({});
  const [presetChoice, setPresetChoice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteInvalid, setPasteInvalid] = useState([]);
  const [savedSelections, setSavedSelections] = useState({});
  const [showSaved, setShowSaved] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);
  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => { getUniverses().then(data => setUniverses(data.presets)); }, []);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}'); setSavedSelections(saved); } catch (e) {}
  }, []);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    searchTickers(q).then(data => {
      setSearchResults(data.results);
      setSearchOpen(data.results.length > 0);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, doSearch]);

  const addTicker = (info) => {
    setSelectedTickers(prev => {
      if (prev.find(t => t.symbol === info.symbol)) return prev;
      if (prev.length >= MAX_TICKERS) return prev;
      return [...prev, info];
    });
  };

  const removeTicker = (symbol, e) => {
    if (e) e.stopPropagation(); // Prevent card tap when tapping X
    setSelectedTickers(prev => prev.filter(t => t.symbol !== symbol));
  };

  const handlePresetSelect = async (key) => {
    setPresetChoice(key);
    const resp = await searchTickers('');
    const count = universes[key]?.count || 500;
    const all = resp.results.slice(0, count);
    setSelectedTickers(all);
  };

  const handlePasteParse = async () => {
    const raw = pasteText.split(/[,\n\s]+/).filter(Boolean).map(s => s.trim().toUpperCase());
    const data = await validateTickers(raw);
    setPasteInvalid(data.invalid);
    const newTickers = data.valid.filter(v => !selectedTickers.find(t => t.symbol === v.symbol));
    setSelectedTickers(prev => [...prev, ...newTickers].slice(0, MAX_TICKERS));
  };

  const handleSaveSelection = () => {
    const name = prompt('Name this selection:');
    if (!name) return;
    const updated = { ...savedSelections, [name]: selectedTickers.map(t => t.symbol) };
    setSavedSelections(updated);
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  };

  const handleLoadSelection = (name) => {
    const symbols = savedSelections[name] || [];
    validateTickers(symbols).then(data => setSelectedTickers(data.valid));
    setShowSaved(false);
  };

  const handleDeleteSelection = (name, e) => {
    e.stopPropagation();
    const updated = { ...savedSelections };
    delete updated[name];
    setSavedSelections(updated);
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  };

  // Determine which chips to show
  const displayedTickers = showAllChips 
    ? selectedTickers 
    : selectedTickers.slice(0, MOBILE_CHIP_LIMIT);
  const hiddenCount = selectedTickers.length - MOBILE_CHIP_LIMIT;

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
      <h2 className="text-base sm:text-lg font-semibold">Ticker Selection</h2>

      {/* Mode switcher — horizontal buttons, full width on mobile */}
      <div className="flex gap-1.5 sm:gap-2">
        {['preset', 'search', 'paste'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 px-2 sm:px-3 py-2 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[44px] ${
              mode === m
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
            }`}
            aria-label={`Switch to ${m} mode`}
            aria-pressed={mode === m}
          >
            {m === 'preset' ? 'Presets' : m === 'search' ? 'Search' : 'Paste'}
          </button>
        ))}
      </div>

      {/* Preset mode */}
      {mode === 'preset' && (
        <div className="space-y-1.5">
          {Object.entries(universes).map(([key, info]) => (
            <button
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors min-h-[48px] ${
                presetChoice === key
                  ? 'bg-blue-900/40 border border-blue-700 text-blue-200'
                  : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent text-gray-300'
              }`}
              aria-label={`Select ${info.label} with ${info.count} tickers`}
            >
              <span className="text-sm sm:text-base font-medium">
                {presetChoice === key && '✓ '}{info.label}
              </span>
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                {info.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div className="space-y-2" ref={searchContainerRef}>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="search"
              inputMode="search"
              autoCapitalize="characters"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              placeholder="Search by symbol or company..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-3 pr-10 py-3 text-base focus:outline-none focus:border-blue-500 min-h-[44px]"
              aria-label="Search tickers"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); searchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Search overlay for mobile */}
          {searchOpen && (
            <>
              <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSearchOpen(false)} />
              <div className="absolute left-0 right-0 z-30 bg-gray-800 border border-gray-600 rounded-lg max-h-72 overflow-y-auto shadow-xl mx-0 sm:mx-0">
                {searchResults.map(r => (
                  <button
                    key={r.symbol}
                    onClick={() => { addTicker(r); setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
                    className="w-full text-left px-3 py-3 hover:bg-gray-700 flex items-center gap-2 min-h-[48px] border-b border-gray-700/50 last:border-b-0"
                  >
                    <span className="font-mono text-blue-400 font-bold text-sm w-16 sm:w-20 flex-shrink-0">{r.symbol}</span>
                    <span className="flex-1 truncate text-sm text-gray-200">{r.name}</span>
                    <span className="text-gray-500 text-xs bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">{r.sector}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Paste mode */}
      {mode === 'paste' && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="Paste tickers (comma, space, or newline)..."
            rows={4}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-sm font-mono focus:outline-none focus:border-blue-500 min-h-[100px]"
            aria-label="Paste ticker list"
          />
          <button
            onClick={handlePasteParse}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors min-h-[44px] text-sm"
          >
            Parse & Add
          </button>
          {pasteInvalid.length > 0 && (
            <div className="text-yellow-400 text-xs bg-yellow-900/30 p-2 rounded">
              ⚠ Invalid: {pasteInvalid.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Selected tickers area */}
      <div className="space-y-2">
        {/* Header with count and actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-gray-400">
            <span className="font-bold text-white">{selectedTickers.length}</span> / {MAX_TICKERS} selected
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={handleSaveSelection}
              disabled={selectedTickers.length === 0}
              className="px-2 sm:px-3 py-1.5 bg-gray-700 rounded-lg text-xs hover:bg-gray-600 disabled:opacity-40 min-h-[36px] transition-colors"
              aria-label="Save current selection"
            >
              💾 Save
            </button>
            <button
              onClick={() => setShowSaved(true)}
              disabled={Object.keys(savedSelections).length === 0}
              className="px-2 sm:px-3 py-1.5 bg-gray-700 rounded-lg text-xs hover:bg-gray-600 disabled:opacity-40 min-h-[36px] transition-colors"
              aria-label="Load saved selection"
            >
              📂 Load
            </button>
            <button
              onClick={() => setSelectedTickers([])}
              disabled={selectedTickers.length === 0}
              className="px-2 sm:px-3 py-1.5 bg-red-900/60 text-red-300 rounded-lg text-xs hover:bg-red-800/60 disabled:opacity-40 min-h-[36px] transition-colors"
              aria-label="Clear all tickers"
            >
              Clear
            </button>
          </div>
        </div>

        {selectedTickers.length >= MAX_TICKERS && (
          <div className="text-yellow-400 text-xs bg-yellow-900/30 p-2 rounded">⚠ Max 500 tickers reached</div>
        )}

        {/* Chips */}
        {selectedTickers.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5 min-h-[40px] items-start p-2 bg-gray-900/50 rounded-lg">
              {displayedTickers.map(t => (
                <span
                  key={t.symbol}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-900/60 text-blue-200 rounded-lg text-xs sm:text-sm group"
                >
                  <span className="font-mono font-medium">{t.symbol}</span>
                  <button
                    onClick={(e) => removeTicker(t.symbol, e)}
                    className="ml-0.5 p-1 hover:text-red-400 hover:bg-red-900/40 rounded min-w-[24px] min-h-[24px] flex items-center justify-center transition-colors"
                    aria-label={`Remove ${t.symbol}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {hiddenCount > 0 && !showAllChips && (
                <button
                  onClick={() => setShowAllChips(true)}
                  className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 min-h-[36px]"
                >
                  +{hiddenCount} more
                </button>
              )}
              {showAllChips && hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllChips(false)}
                  className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 min-h-[36px]"
                >
                  Show less
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-xs sm:text-sm p-3 bg-gray-900/50 rounded-lg text-center">
            No tickers selected — choose a preset, search, or paste a list
          </div>
        )}
      </div>

      {/* Saved selections bottom sheet */}
      {showSaved && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowSaved(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-gray-800 rounded-t-2xl max-h-[70vh] overflow-y-auto safe-bottom border-t border-gray-600 shadow-2xl">
            <div className="sticky top-0 bg-gray-800 rounded-t-2xl px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Saved Selections</h3>
              <button
                onClick={() => setShowSaved(false)}
                className="p-2 hover:bg-gray-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close saved selections"
              >
                ✕
              </button>
            </div>
            <div className="p-2">
              {Object.entries(savedSelections).map(([name, symbols]) => (
                <button
                  key={name}
                  onClick={() => handleLoadSelection(name)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700 flex items-center justify-between rounded-lg min-h-[48px] transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-200">{name}</div>
                    <div className="text-xs text-gray-400">{symbols.length} tickers</div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSelection(name, e)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Delete ${name}`}
                  >
                    🗑
                  </button>
                </button>
              ))}
              {Object.keys(savedSelections).length === 0 && (
                <div className="text-gray-500 text-sm text-center py-8">No saved selections</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
