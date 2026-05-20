"""Tests for Trend Template conditions."""
from sepa_scanner.trend_template import evaluate_trend_template
import pandas as pd
import numpy as np

class TestTrendTemplate:
    def test_uptrend_passes_all(self, sample_ohlcv_uptrend):
        result = evaluate_trend_template("TEST", sample_ohlcv_uptrend, rs_rating=85.0)
        assert result.passes_all

    def test_downtrend_fails(self, sample_ohlcv_downtrend):
        result = evaluate_trend_template("TEST", sample_ohlcv_downtrend, rs_rating=30.0)
        assert not result.passes_all
        assert not result.cond5_price_above_50

    def test_rs_threshold_failure(self, sample_ohlcv_uptrend):
        result = evaluate_trend_template("TEST", sample_ohlcv_uptrend, rs_rating=50.0)
        assert not result.cond8_rs_above_threshold
        assert not result.passes_all

    def test_insufficient_data(self):
        df = pd.DataFrame({"open": [10]*10, "high": [11]*10, "low": [9]*10, "close": [10.5]*10, "volume": [1000]*10})
        result = evaluate_trend_template("SHORT", df, rs_rating=80.0)
        assert not result.passes_all
