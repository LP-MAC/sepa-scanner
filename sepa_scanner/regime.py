"""
Market regime filter. Default: SPY > 200 SMA and SPY 50 SMA > SPY 200 SMA = bullish.
"""
import logging
from abc import ABC, abstractmethod
from typing import Optional

import pandas as pd

from sepa_scanner.data import fetch_ticker_data
from sepa_scanner.trend_template import compute_sma

logger = logging.getLogger(__name__)


class BaseRegimeFilter(ABC):
    """Abstract interface for market regime filters."""

    @abstractmethod
    def is_bullish_regime(self) -> bool:
        ...

    @abstractmethod
    def regime_summary(self) -> dict:
        ...


class SpyRegimeFilter(BaseRegimeFilter):
    """Default Minervini market filter: SPY must be above its 200 SMA."""

    def __init__(self, data: Optional[pd.DataFrame] = None):
        self._spy_data: Optional[pd.DataFrame] = data
        self._bullish: Optional[bool] = None
        self._price: float = 0.0
        self._sma_50: float = 0.0
        self._sma_200: float = 0.0

    def _ensure_data(self):
        if self._spy_data is not None:
            return
        self._spy_data = fetch_ticker_data("SPY")

    def is_bullish_regime(self) -> bool:
        self._ensure_data()
        if self._spy_data is None or len(self._spy_data) < 200:
            logger.warning("SPY data insufficient for regime filter; assuming bullish")
            return True

        closes = self._spy_data["close"]
        self._price = closes.iloc[-1]
        self._sma_50 = compute_sma(closes, 50).iloc[-1]
        self._sma_200 = compute_sma(closes, 200).iloc[-1]

        self._bullish = bool(
            self._price > self._sma_200 and
            self._sma_50 > self._sma_200
        )

        if not self._bullish:
            logger.info("Market regime: CAUTIOUS")
        else:
            logger.info("Market regime: BULLISH")

        return self._bullish

    def regime_summary(self) -> dict:
        if self._bullish is None:
            self.is_bullish_regime()
        return {
            "filter_type": "SPY_50_200_SMA",
            "is_bullish": self._bullish,
            "spy_price": round(self._price, 2) if self._price else None,
            "spy_sma_50": round(self._sma_50, 2) if self._sma_50 else None,
            "spy_sma_200": round(self._sma_200, 2) if self._sma_200 else None,
        }
