import { useState, useEffect, useRef } from 'react';
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

  const handleCancel = async () => { try { await cancelScan(jobId); } catch (e) {} onCancel(); };

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if (status === 'failed') {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center space-y-4">
        <div className="text-red-400 text-lg">Scan Failed</div>
        <div className="text-gray-400">{error}</div>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Try Again</button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Scanning...</h2>
      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="flex justify-between text-sm"><span className="text-gray-400">{progress}%</span><span className="text-gray-400">{processed}/{total} tickers</span></div>
      {currentTicker && <div className="text-sm text-gray-400">Processing: <span className="text-blue-400 font-mono">{currentTicker}</span></div>}
      <div className="text-sm text-gray-500">Elapsed: {formatTime(elapsed)}</div>
      <button onClick={handleCancel} className="px-4 py-2 bg-red-900 text-red-300 rounded hover:bg-red-800 text-sm">Cancel Scan</button>
    </div>
  );
}
