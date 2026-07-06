"""Run SQL-backed data-quality checkpoints and emit dashboard artifacts."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = ROOT / "sql" / "validations"
REPORT_PATH = ROOT / "reports" / "data_quality" / "results.json"


@dataclass(frozen=True)
class CheckResult:
    file: str
    description: str
    passed: bool
    violation_count: int
    sample: list[dict[str, Any]]

    def as_dict(self) -> dict[str, Any]:
        return {
            "file": self.file,
            "description": self.description,
            "passed": self.passed,
            "violation_count": self.violation_count,
            "sample": self.sample,
        }


def describe(sql: str, fallback: str) -> str:
    for line in sql.splitlines():
        line = line.strip()
        if line.startswith("--"):
            return line.removeprefix("--").strip()
    return fallback.replace("_", " ").removesuffix(".sql").title()


def run_check(conn: psycopg.Connection[Any], path: Path, sample_limit: int) -> CheckResult:
    sql = path.read_text()
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"select * from ({sql.rstrip().removesuffix(';')}) violations")
        rows = cur.fetchall()

    return CheckResult(
        file=path.name,
        description=describe(sql, path.stem),
        passed=len(rows) == 0,
        violation_count=len(rows),
        sample=rows[:sample_limit],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run storefront data-quality SQL checkpoints.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="Postgres connection string")
    parser.add_argument("--sample-limit", default=20, type=int, help="Rows to include in JSON output per failing check")
    parser.add_argument("--report-path", default=REPORT_PATH, type=Path, help="Where to write JSON results")
    args = parser.parse_args()

    if not args.database_url:
        print("DATABASE_URL is required for data-quality checks.", file=sys.stderr)
        return 2

    sql_files = sorted(SQL_DIR.glob("*.sql"))
    if not sql_files:
        print(f"No SQL validations found in {SQL_DIR}", file=sys.stderr)
        return 2

    with psycopg.connect(args.database_url) as conn:
        checks = [run_check(conn, path, args.sample_limit) for path in sql_files]

    payload = {
        "total": len(checks),
        "passed": sum(check.passed for check in checks),
        "failed": sum(not check.passed for check in checks),
        "checks": [check.as_dict() for check in checks],
    }

    args.report_path.parent.mkdir(parents=True, exist_ok=True)
    args.report_path.write_text(json.dumps(payload, indent=2, default=str) + "\n")

    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"[{status}] {check.file}: {check.violation_count} violation(s)")

    return 0 if payload["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

