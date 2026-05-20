import { useState } from 'react';
import RegimeIndicator from './components/RegimeIndicator';
import TickerPicker from './components/TickerPicker';
import ScanConfig from './components/ScanConfig';
import ProgressView from './components/ProgressView';
import ResultsTable from './components/ResultsTable';
import MethodologyGuide from './components/MethodologyGuide';

export default function App() {
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [scanState, setScanState] = useState({ status: 'idle' });
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState([]);
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-blue-400">SEPA Scanner</h1>
            <button
              onClick={() => setShowGuide(true)}
              className="px-3 py-1.5 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-lg text-xs hover:bg-blue-800/50 transition-colors flex items-center gap-1"
            >
              📖 Methodology Guide
            </button>
          </div>
          <RegimeIndicator />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {scanState.status === 'idle' && (
          <>
            <TickerPicker selectedTickers={selectedTickers} setSelectedTickers={setSelectedTickers} />
            <ScanConfig selectedTickers={selectedTickers} onScanStart={(state) => { setScanState(state); setJobId(state.jobId); }} />
          </>
        )}

        {scanState.status === 'running' && (
          <ProgressView jobId={jobId} onCancel={() => setScanState({ status: 'idle' })} onComplete={(res) => { setResults(res); setScanState({ status: 'complete' }); }} />
        )}

        {scanState.status === 'complete' && (
          <ResultsTable results={results} jobId={jobId} onNewScan={() => { setScanState({ status: 'idle' }); setResults([]); setJobId(null); }} />
        )}
      </main>

      <MethodologyGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
