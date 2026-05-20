"""
Relative Strength (RS) Rating: percentile rank of 12-month total return vs universe.
"""
import logging

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


def compute_rs_ratings(
    data: dict[str, pd.DataFrame],
    lookback_months: int = 12,
) -> dict[str, float]:
    """Compute RS rating (0-100) for each ticker based on total return."""
    if not data:
        return {}

    # Use a flexible lookback: 6 months minimum, 12 months ideal
    min_days = 126  # ~6 months
    ideal_days = lookback_months * 21  # ~12 months

    returns: dict[str, float] = {}

    for ticker, df in data.items():
        # Use whatever data is available between min and ideal
        available_days = len(df)
        if available_days < min_days:
            continue
        
        lookback_idx = min(ideal_days, available_days - 1)
        if lookback_idx < min_days:
            lookback_idx = available_days - 1
        
        try:
            start_close = df["close"].iloc[-lookback_idx]
            end_close = df["close"].iloc[-1]
            if start_close > 0 and end_close > 0:
                total_return = (end_close / start_close) - 1.0
                returns[ticker] = total_return
        except (IndexError, KeyError, ZeroDivisionError):
            continue

    if not returns:
        logger.warning("No valid returns computed for RS rating")
        return {}

    return_array = np.array(list(returns.values()))
    ratings = {}

    for ticker, ret in returns.items():
        percentile = stats.percentileofscore(return_array, ret, kind="rank")
        ratings[ticker] = round(percentile, 1)

    logger.info(
        f"RS ratings computed for {len(ratings)} tickers: "
        f"mean={np.mean(list(ratings.values())):.1f}, "
        f"median={np.median(list(ratings.values())):.1f}"
    )
    return ratings
