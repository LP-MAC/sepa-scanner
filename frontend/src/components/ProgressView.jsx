import { useState, useEffect } from 'react';
import { getScanStatus, cancelScan } from '../lib/api';

export default function ProgressView({ jobId, onCancel, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [currentTicker, setCurrentTicker] = useState('');
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('running');
  const [error, setError] = useState('');
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getScanStatus(jobId);
        setProgress(data.progress);
        setCurrentTicker(data.current_ticker);
        setProcessed(data.tickers_processed);
        setTotal(data.tickers_total);
        setStatus(data.status);
        if (data.status === 'complete') onComplete(data.results || []);
        else if (data.status === 'failed') setError(data.error);
        else if (data.status === 'cancelled') onCancel();
      } catch (err) { setError('Failed to fetch scan status'); }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, onComplete, onCancel]);

  const handleCancel = async () => {
    try { await cancelScan(jobId); } catch (e) {}
    onCancel();
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (status === 'failed') {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center space-y-4">
        <div className="text-2xl">❌</div>
        <div className="text-red-400 text-lg font-semibold">Scan Failed</div>
        <div className="text-gray-400 text-sm">{error}</div>
        <button onClick={onCancel} className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 min-h-[44px]">Try Again</button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
      <h2 className="text-base sm:text-lg font-semibold text-center">Scanning...</h2>

      {/* Current ticker — large and centered */}
      {currentTicker && (
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">Processing</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-400">{currentTicker}</div>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-400 font-mono">{progress}%</span>
        <span className="text-gray-400">{processed}/{total} tickers</span>
      </div>

      <div className="text-center text-sm text-gray-500">
        ⏱ Elapsed: {formatTime(elapsed)}
      </div>

      <button
        onClick={handleCancel}
        className="w-full py-3 bg-red-900/60 text-red-300 rounded-lg hover:bg-red-800/60 active:bg-red-800 text-sm font-medium min-h-[44px] transition-colors"
      >
        Cancel Scan
      </button>
    </div>
  );
}
