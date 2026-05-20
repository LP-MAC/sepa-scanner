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
      const data = await startScan(selectedTickers.map(t => t.symbol), rsThreshold, runVcp, runPocketPivot, generateCharts);
      onScanStart({ status: 'running', jobId: data.job_id });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold">Scan Configuration</h2>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm text-gray-400">RS Rating Threshold: <span className="text-white font-mono">{rsThreshold}</span></label>
          <input type="range" min="50" max="95" value={rsThreshold} onChange={e => setRsThreshold(Number(e.target.value))} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500"><span>50 (Lenient)</span><span>70 (Default)</span><span>95 (Strict)</span></div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={runVcp} onChange={e => setRunVcp(e.target.checked)} /><span className="text-sm">Run VCP Detection</span></label>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={runPocketPivot} onChange={e => setRunPocketPivot(e.target.checked)} /><span className="text-sm">Run Pocket Pivot Detection</span></label>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={generateCharts} onChange={e => setGenerateCharts(e.target.checked)} /><span className="text-sm">Generate Charts (slower)</span></label>
      </div>
      {error && <div className="text-red-400 text-sm bg-red-900/50 p-2 rounded">{error}</div>}
      <button onClick={handleScan} disabled={selectedTickers.length === 0 || loading}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg">
        {loading ? 'Starting...' : `Run Scan (${selectedTickers.length} tickers)`}
      </button>
    </div>
  );
}
