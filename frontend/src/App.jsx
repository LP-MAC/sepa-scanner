import { useState } from 'react';
import RegimeIndicator from './components/RegimeIndicator';
import TickerPicker from './components/TickerPicker';
import ScanConfig from './components/ScanConfig';
import ProgressView from './components/ProgressView';
import ResultsTable from './components/ResultsTable';
import MethodologyGuide from './components/MethodologyGuide';
import ColdStartBanner from './components/ColdStartBanner';

export default function App() {
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [scanState, setScanState] = useState({ status: 'idle' });
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [lastScanTimestamp, setLastScanTimestamp] = useState(null);

  return (
    <div className="min-h-screen flex flex-col safe-top">
      <ColdStartBanner />
      
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          {/* Row 1: Title + Regime (always visible) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-400 truncate">
                SEPA Scanner
              </h1>
              <button
                onClick={() => setShowGuide(true)}
                className="hidden sm:flex px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-lg text-xs hover:bg-blue-800/50 transition-colors items-center gap-1 flex-shrink-0"
                aria-label="Open methodology guide"
              >
                📖 Guide
              </button>
            </div>
            <RegimeIndicator />
          </div>
          
          {/* Row 2: Timestamp + Mobile Guide button (below on small screens) */}
          <div className="flex items-center justify-between mt-1 sm:hidden">
            {lastScanTimestamp && (
              <span className="text-xs text-gray-500">
                Last scan: {lastScanTimestamp}
              </span>
            )}
            <button
              onClick={() => setShowGuide(true)}
              className="px-2 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-lg text-xs flex items-center gap-1"
              aria-label="Open methodology guide"
            >
              📖 Guide
            </button>
          </div>
          {lastScanTimestamp && (
            <div className="hidden sm:block mt-0.5">
              <span className="text-xs text-gray-500">
                Last scan: {lastScanTimestamp}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {scanState.status === 'idle' && (
          <>
            <TickerPicker selectedTickers={selectedTickers} setSelectedTickers={setSelectedTickers} />
            <ScanConfig selectedTickers={selectedTickers} onScanStart={(state) => { setScanState(state); setJobId(state.jobId); }} />
          </>
        )}

        {scanState.status === 'running' && (
          <ProgressView jobId={jobId} onCancel={() => setScanState({ status: 'idle' })} onComplete={(res) => { setResults(res); setScanState({ status: 'complete' }); setLastScanTimestamp(new Date().toLocaleString()); }} />
        )}

        {scanState.status === 'complete' && (
          <ResultsTable results={results} jobId={jobId} onNewScan={() => { setScanState({ status: 'idle' }); setResults([]); setJobId(null); }} />
        )}
      </main>

      <MethodologyGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
