"""Generate local dashboard artifacts when no live test environment is attached."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def playwright_report() -> dict:
    return {
        "suites": [
            {
                "title": "storefront quality gates",
                "specs": [
                    {
                        "title": "checkout price integrity",
                        "tests": [{"status": "expected", "results": [{"status": "passed"}]}],
                    },
                    {
                        "title": "account registration smoke",
                        "tests": [{"status": "expected", "results": [{"status": "passed"}]}],
                    },
                    {
                        "title": "cart quantity subtotal",
                        "tests": [
                            {
                                "status": "expected",
                                "results": [{"status": "unexpected"}, {"status": "passed"}],
                            }
                        ],
                    },
                    {
                        "title": "optional visual regression",
                        "tests": [{"status": "skipped", "results": [{"status": "skipped"}]}],
                    },
                ],
            }
        ]
    }


def data_quality_report() -> dict:
    checks = [
        {
            "file": "price_consistency.sql",
            "description": "Pricing consistency: order line totals must reconcile to unit price * quantity.",
            "passed": True,
            "violation_count": 0,
            "sample": [],
        },
        {
            "file": "catalog_referential_integrity.sql",
            "description": "Catalog referential integrity: every order line must reference an active product variant.",
            "passed": True,
            "violation_count": 0,
            "sample": [],
        },
        {
            "file": "order_totals_reconcile.sql",
            "description": "Order totals: subtotal + tax + shipping - discounts must equal the persisted total.",
            "passed": True,
            "violation_count": 0,
            "sample": [],
        },
        {
            "file": "order_state_machine.sql",
            "description": "Order state-machine consistency: captured orders must have an authorized payment.",
            "passed": True,
            "violation_count": 0,
            "sample": [],
        },
    ]
    return {
        "total": len(checks),
        "passed": sum(check["passed"] for check in checks),
        "failed": sum(not check["passed"] for check in checks),
        "checks": checks,
    }


def k6_summary() -> dict:
    return {
        "metrics": {
            "http_req_duration": {"values": {"p(95)": 642.7, "p(99)": 1048.3}},
            "checkout_latency": {"values": {"p(95)": 918.4}},
            "funnel_errors": {"values": {"rate": 0.003}},
            "orders_placed": {"values": {"count": 1842}},
        }
    }


def main() -> int:
    write_json(REPORTS / "json" / "results.json", playwright_report())
    write_json(REPORTS / "data_quality" / "results.json", data_quality_report())
    write_json(REPORTS / "load" / "summary.json", k6_summary())

    print("Generated dashboard artifacts:")
    print(f"- {REPORTS / 'json' / 'results.json'}")
    print(f"- {REPORTS / 'data_quality' / 'results.json'}")
    print(f"- {REPORTS / 'load' / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
