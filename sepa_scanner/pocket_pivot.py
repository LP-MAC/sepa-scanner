"""
Pocket Pivot detection: an up day where volume exceeds the highest down-day volume
of the prior 10 trading days.
"""
import logging
import pandas as pd

logger = logging.getLogger(__name__)


def detect_pocket_pivot(df: pd.DataFrame) -> bool:
    """Detect if today is a pocket pivot."""
    if len(df) < 12:
        return False

    window = df.iloc[-11:]
    today = window.iloc[-1]
    prior_10 = window.iloc[:-1]

    is_up_day = today["close"] > prior_10.iloc[-1]["close"]
    if not is_up_day:
        return False

    down_days = prior_10[prior_10["close"] < prior_10["open"]]
    if down_days.empty:
        return False

    max_down_volume = down_days["volume"].max()
    return bool(today["volume"] > max_down_volume)
