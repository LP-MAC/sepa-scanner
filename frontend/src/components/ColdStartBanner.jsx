import { useState, useEffect } from 'react';
import { healthCheck } from '../lib/api';

export default function ColdStartBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 2000);

    healthCheck()
      .then(() => {
        setShowBanner(false);
      })
      .catch(() => {
        // Server not reachable — banner already showing
      });

    return () => clearTimeout(timer);
  }, []);

  // Also listen for successful API calls to auto-dismiss
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.ok && showBanner && !dismissed) {
        setShowBanner(false);
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [showBanner, dismissed]);

  if (!showBanner || dismissed) return null;

  return (
    <div className="bg-yellow-900/80 text-yellow-200 px-4 py-3 text-sm flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="animate-pulse">⏳</span>
        <span className="truncate">
          Waking up the server... (this can take up to 30s on first load)
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-3 px-2 py-1 text-yellow-400 hover:text-yellow-200 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Dismiss banner"
      >
        ✕
      </button>
    </div>
  );
}
