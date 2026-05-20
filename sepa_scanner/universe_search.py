"""
Fast autocomplete index over the Russell 1000 universe.
"""
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from sepa_scanner.universe import build_universe

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent / "data"


@dataclass
class TickerInfo:
    symbol: str
    name: str = ""
    sector: str = ""


class UniverseIndex:
    """In-memory search index for ticker autocomplete."""

    def __init__(self):
        self._tickers: List[TickerInfo] = []
        self._by_symbol: dict[str, TickerInfo] = {}

    def load(self):
        logger.info("Building universe search index...")
        symbols = build_universe("sp500,nasdaq100,russell1000")
        logger.info(f"Universe: {len(symbols)} tickers")

        cache_path = _DATA_DIR / "ticker_info_cache.json"
        cached_info = {}
        if cache_path.exists():
            try:
                with open(cache_path) as f:
                    cached_info = json.load(f)
            except Exception:
                pass

        self._tickers = []
        self._by_symbol = {}
        for sym in symbols:
            info_data = cached_info.get(sym, {})
            info = TickerInfo(
                symbol=sym,
                name=info_data.get("name", ""),
                sector=info_data.get("sector", ""),
            )
            self._tickers.append(info)
            self._by_symbol[sym] = info

        logger.info(f"Universe index ready: {len(self._tickers)} tickers")

    def search(self, query: str, limit: int = 20) -> List[TickerInfo]:
        if not query:
            return self._tickers[:limit]
        q = query.upper().strip()
        results = []
        for info in self._tickers:
            if q in info.symbol or (info.name and q in info.name.upper()):
                results.append(info)
                if len(results) >= limit:
                    break

        def sort_key(info: TickerInfo) -> tuple:
            if info.symbol == q:
                return (0, info.symbol)
            elif info.symbol.startswith(q):
                return (1, info.symbol)
            elif q in info.symbol:
                return (2, info.symbol)
            return (3, info.symbol)

        results.sort(key=sort_key)
        return results[:limit]

    def validate(self, symbol: str) -> Optional[TickerInfo]:
        return self._by_symbol.get(symbol.upper().strip())

    def get_all(self) -> List[TickerInfo]:
        return self._tickers


universe_index = UniverseIndex()
