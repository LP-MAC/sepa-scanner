import { useState, useEffect } from 'react';
import { getRegime } from '../lib/api';

export default function RegimeIndicator() {
  const [regime, setRegime] = useState(null);

  useEffect(() => {
    getRegime().then(setRegime).catch(() => setRegime({ label: 'Unknown', dot_color: 'yellow' }));
  }, []);

  if (!regime) return <div className="text-gray-500 text-sm">Loading regime...</div>;

  const dotColor = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' }[regime.dot_color] || 'bg-gray-500';

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">Market:</span>
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      <span className="font-medium">{regime.label}</span>
    </div>
  );
}
