"""Shared pytest fixtures for SEPA scanner tests."""
import pandas as pd
import numpy as np
import pytest

@pytest.fixture
def sample_ohlcv_uptrend() -> pd.DataFrame:
    np.random.seed(42)
    n = 260
    dates = pd.date_range(end="2024-12-31", periods=n, freq="B")
    trend = np.linspace(100, 200, n)
    noise = np.random.normal(0, 2, n).cumsum() * 0.5
    close = trend + noise
    daily_range = close * 0.02
    high = close + np.abs(np.random.normal(0, daily_range * 0.5, n))
    low = close - np.abs(np.random.normal(0, daily_range * 0.5, n))
    open_price = low + np.random.random(n) * (high - low)
    volume = np.random.uniform(1_000_000, 5_000_000, n)
    return pd.DataFrame({"open": open_price, "high": high, "low": low, "close": close, "volume": volume}, index=dates)

@pytest.fixture
def sample_ohlcv_downtrend() -> pd.DataFrame:
    np.random.seed(99)
    n = 260
    dates = pd.date_range(end="2024-12-31", periods=n, freq="B")
    trend = np.linspace(200, 100, n)
    noise = np.random.normal(0, 2, n).cumsum() * 0.5
    close = trend + noise
    daily_range = close * 0.02
    high = close + np.abs(np.random.normal(0, daily_range * 0.5, n))
    low = close - np.abs(np.random.normal(0, daily_range * 0.5, n))
    open_price = low + np.random.random(n) * (high - low)
    volume = np.random.uniform(1_000_000, 5_000_000, n)
    return pd.DataFrame({"open": open_price, "high": high, "low": low, "close": close, "volume": volume}, index=dates)

@pytest.fixture
def sample_ohlcv_vcp_pattern() -> pd.DataFrame:
    np.random.seed(77)
    n = 120
    dates = pd.date_range(end="2024-12-31", periods=n, freq="B")
    base = np.linspace(90, 100, n)
    close = base.copy()
    vcp_start = 60
    close[vcp_start:vcp_start+5] = 115
    close[vcp_start+5:vcp_start+15] = np.linspace(115, 92, 10)
    close[vcp_start+15:vcp_start+20] = 92
    close[vcp_start+20:vcp_start+25] = np.linspace(92, 108, 5)
    close[vcp_start+25:vcp_start+35] = np.linspace(108, 95, 10)
    close[vcp_start+35:vcp_start+40] = 95
    close[vcp_start+40:vcp_start+45] = np.linspace(95, 105, 5)
    close[vcp_start+45:vcp_start+55] = np.linspace(105, 98, 10)
    close[vcp_start+55:] = np.linspace(98, 110, n - vcp_start - 55)
    close = close + np.random.normal(0, 0.5, n)
    daily_range = close * 0.015
    high = close + np.abs(np.random.normal(0, daily_range * 0.5, n))
    low = close - np.abs(np.random.normal(0, daily_range * 0.5, n))
    open_price = low + np.random.random(n) * (high - low)
    volume = np.ones(n) * 2_000_000
    volume[vcp_start:vcp_start+15] = np.linspace(3_000_000, 1_500_000, 15)
    volume[vcp_start+20:vcp_start+35] = np.linspace(2_000_000, 1_200_000, 15)
    volume[vcp_start+40:vcp_start+55] = np.linspace(1_500_000, 800_000, 15)
    volume[vcp_start+55:] = 2_500_000
    return pd.DataFrame({"open": open_price, "high": high, "low": low, "close": close, "volume": volume}, index=dates)
