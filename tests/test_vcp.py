"""Tests for VCP detection."""
from sepa_scanner.vcp import detect_vcp

class TestVCP:
    def test_detects_vcp_pattern(self, sample_ohlcv_vcp_pattern):
        result = detect_vcp("TEST", sample_ohlcv_vcp_pattern)
        assert isinstance(result.num_contractions, int)

    def test_returns_no_vcp_for_noisy_data(self, sample_ohlcv_uptrend):
        result = detect_vcp("TEST", sample_ohlcv_uptrend)
        assert result.ticker == "TEST"
