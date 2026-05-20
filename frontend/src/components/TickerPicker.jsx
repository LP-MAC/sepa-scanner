import { useState, useEffect, useRef, useCallback } from 'react';
import { searchTickers, validateTickers, getUniverses } from '../lib/api';

const SAVED_KEY = 'sepa-saved-selections';
const MAX_TICKERS = 500;

export default function TickerPicker({ selectedTickers, setSelectedTickers }) {
  const [mode, setMode] = useState('preset');
  const [universes, setUniverses] = useState({});
  const [presetChoice, setPresetChoice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [pasteInvalid, setPasteInvalid] = useState([]);
  const [savedSelections, setSavedSelections] = useState({});
  const [showSaved, setShowSaved] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => { getUniverses().then(data => setUniverses(data.presets)); }, []);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}'); setSavedSelections(saved); } catch (e) {}
  }, []);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    searchTickers(q).then(data => setSearchResults(data.results));
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

  const removeTicker = (symbol) => setSelectedTickers(prev => prev.filter(t => t.symbol !== symbol));

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

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold">Ticker Selection</h2>

      <div className="flex gap-2">
        {['preset', 'search', 'paste'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {m === 'preset' ? 'Presets' : m === 'search' ? 'Search' : 'Paste List'}
          </button>
        ))}
      </div>

      {mode === 'preset' && (
        <div className="space-y-2">
          {Object.entries(universes).map(([key, info]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
              <input type="radio" name="preset" checked={presetChoice === key} onChange={() => handlePresetSelect(key)} className="text-blue-600" />
              <span className="flex-1">{info.label}</span>
              <span className="text-gray-400 text-sm">{info.count} tickers</span>
            </label>
          ))}
        </div>
      )}

      {mode === 'search' && (
        <div className="space-y-2">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by symbol or company name..." autoFocus
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          {searchResults.length > 0 && (
            <div className="border border-gray-700 rounded max-h-64 overflow-y-auto">
              {searchResults.map(r => (
                <button key={r.symbol} onClick={() => { addTicker(r); setSearchQuery(''); setSearchResults([]); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center gap-2 text-sm">
                  <span className="font-mono text-blue-400 w-16">{r.symbol}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-gray-500 text-xs">{r.sector}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'paste' && (
        <div className="space-y-2">
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder="Paste tickers (comma, space, or newline separated)..." rows={4}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
          <button onClick={handlePasteParse} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Parse & Add</button>
          {pasteInvalid.length > 0 && <div className="text-yellow-500 text-sm">⚠ Invalid tickers: {pasteInvalid.join(', ')}</div>}
        </div>
      )}

      <div className="flex flex-wrap gap-1 min-h-[40px] items-start p-2 bg-gray-900 rounded">
        {selectedTickers.map(t => (
          <span key={t.symbol} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900 text-blue-200 rounded text-xs">
            {t.symbol}
            <button onClick={() => removeTicker(t.symbol)} className="hover:text-red-400 ml-0.5">×</button>
          </span>
        ))}
        {selectedTickers.length === 0 && <span className="text-gray-500 text-sm p-1">No tickers selected</span>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2">
          <span className="text-gray-400">{selectedTickers.length} / {MAX_TICKERS} selected</span>
          {selectedTickers.length >= MAX_TICKERS && <span className="text-yellow-500">⚠ Max reached</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveSelection} disabled={selectedTickers.length === 0}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">Save</button>
          <button onClick={() => setShowSaved(!showSaved)} disabled={Object.keys(savedSelections).length === 0}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">Load ▾</button>
          <button onClick={() => setSelectedTickers([])} disabled={selectedTickers.length === 0}
            className="px-3 py-1 bg-red-900 text-red-300 rounded hover:bg-red-800 disabled:opacity-50">Clear All</button>
        </div>
      </div>

      {showSaved && (
        <div className="border border-gray-700 rounded max-h-40 overflow-y-auto">
          {Object.entries(savedSelections).map(([name, symbols]) => (
            <button key={name} onClick={() => handleLoadSelection(name)}
              className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between text-sm">
              <span>{name}</span>
              <span className="text-gray-500">{symbols.length} tickers</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
