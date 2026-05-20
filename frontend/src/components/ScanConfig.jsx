import { useState } from 'react';
import { startScan } from '../lib/api';

export default function ScanConfig({ selectedTickers, onScanStart }) {
  const [rsThreshold, setRsThreshold] = useState(70);
  const [runVcp, setRunVcp] = useState(true);
  const [runPocketPivot, setRunPocketPivot] = useState(false);
  const [generateCharts, setGenerateCharts] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (selectedTickers.length === 0) return;
    setError('');
    setLoading(true);
    try {
      const data = await startScan(
        selectedTickers.map(t => t.symbol),
        rsThreshold,
        runVcp,
        runPocketPivot,
        generateCharts
      );
      onScanStart({ status: 'running', jobId: data.job_id });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 space-y-4 sm:space-y-5">
      <h2 className="text-base sm:text-lg font-semibold">Scan Configuration</h2>

      {/* RS Threshold */}
      <div className="space-y-2">
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-300">RS Rating Threshold</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-blue-400">{rsThreshold}</span>
        </label>
        <input
          type="range"
          min="50"
          max="95"
          value={rsThreshold}
          onChange={e => setRsThreshold(Number(e.target.value))}
          className="w-full"
          aria-label={`RS Rating threshold: ${rsThreshold}`}
        />
        <div className="flex justify-between text-xs text-gray-500 px-0.5">
          <span>50 Lenient</span>
          <span>70 Default</span>
          <span>95 Strict</span>
        </div>
      </div>

      {/* Toggles — iOS-style switches */}
      <div className="space-y-1">
        {/* VCP Toggle */}
        <label className="flex items-center justify-between py-3 cursor-pointer min-h-[48px]">
          <div>
            <div className="text-sm font-medium text-gray-200">Run VCP Detection</div>
            <div className="text-xs text-gray-400">Volatility Contraction Pattern</div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={runVcp}
              onChange={e => setRunVcp(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
          </div>
        </label>

        {/* Pocket Pivot Toggle */}
        <label className="flex items-center justify-between py-3 cursor-pointer min-h-[48px]">
          <div>
            <div className="text-sm font-medium text-gray-200">Run Pocket Pivot Detection</div>
            <div className="text-xs text-gray-400">Institutional accumulation signal</div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={runPocketPivot}
              onChange={e => setRunPocketPivot(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
          </div>
        </label>

        {/* Charts Toggle */}
        <label className="flex items-center justify-between py-3 cursor-pointer min-h-[48px]">
          <div>
            <div className="text-sm font-medium text-gray-200">Generate Charts</div>
            <div className="text-xs text-gray-400">Slower — saves PNGs for VCP candidates</div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={generateCharts}
              onChange={e => setGenerateCharts(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
          </div>
        </label>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 p-3 rounded-lg">{error}</div>
      )}

      {/* Scan button — sticky at bottom on mobile */}
      <div className="sticky bottom-0 bg-gray-800 pt-2 pb-2 -mx-3 sm:-mx-4 px-3 sm:px-4 sm:static sm:bg-transparent sm:p-0">
        <button
          onClick={handleScan}
          disabled={selectedTickers.length === 0 || loading}
          className="w-full py-3.5 sm:py-3 bg-blue-600 text-white font-semibold rounded-xl sm:rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-base sm:text-lg min-h-[52px] shadow-lg sm:shadow-none"
          aria-label={loading ? 'Scan starting...' : `Run scan on ${selectedTickers.length} tickers`}
        >
          {loading ? '⏳ Starting...' : `🚀 Run Scan (${selectedTickers.length} tickers)`}
        </button>
      </div>
    </div>
  );
}
