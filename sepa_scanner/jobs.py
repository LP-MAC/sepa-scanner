"""
In-memory job store with TTL-based auto-expiry for async scan jobs.
"""
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sepa_scanner.output import ScanResult

logger = logging.getLogger(__name__)

JOB_TTL_HOURS = 1


@dataclass
class ScanJob:
    job_id: str
    status: str = "pending"
    progress: int = 0
    tickers_total: int = 0
    tickers_processed: int = 0
    current_ticker: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: List[ScanResult] = field(default_factory=list)
    error: str = ""
    charts: Dict[str, bytes] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


class JobStore:
    """In-memory job store."""

    def __init__(self):
        self._jobs: Dict[str, ScanJob] = {}

    def create(self) -> ScanJob:
        job_id = str(uuid.uuid4())[:8]
        job = ScanJob(job_id=job_id)
        self._jobs[job_id] = job
        logger.info(f"Job {job_id}: created")
        self._sweep()
        return job

    def get(self, job_id: str) -> Optional[ScanJob]:
        return self._jobs.get(job_id)

    def update(self, job_id: str, status=None, progress=None, current_ticker=None,
               error=None, results=None, charts=None, tickers_processed=None):
        job = self._jobs.get(job_id)
        if not job:
            return
        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = progress
        if current_ticker is not None:
            job.current_ticker = current_ticker
        if error is not None:
            job.error = error
        if results is not None:
            job.results = results
        if charts is not None:
            job.charts = charts
        if tickers_processed is not None:
            job.tickers_processed = tickers_processed

    def start(self, job_id: str, tickers_total: int):
        job = self._jobs.get(job_id)
        if job:
            job.status = "running"
            job.started_at = datetime.now()
            job.tickers_total = tickers_total

    def complete(self, job_id: str, results: List[ScanResult], charts: Dict[str, bytes]):
        job = self._jobs.get(job_id)
        if job:
            job.status = "complete"
            job.progress = 100
            job.completed_at = datetime.now()
            job.results = results
            job.charts = charts

    def fail(self, job_id: str, error: str):
        job = self._jobs.get(job_id)
        if job:
            job.status = "failed"
            job.error = error
            job.completed_at = datetime.now()

    def cancel(self, job_id: str):
        job = self._jobs.get(job_id)
        if job and job.status in ("pending", "running"):
            job.status = "cancelled"
            job.completed_at = datetime.now()

    def _sweep(self):
        now = datetime.now()
        expired = [
            jid for jid, job in self._jobs.items()
            if now - job.created_at > timedelta(hours=JOB_TTL_HOURS)
        ]
        for jid in expired:
            self._jobs.pop(jid, None)


job_store = JobStore()
