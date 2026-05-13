import pytest

from private_credit_mcp.audit.logger import set_audit_sink_for_tests


@pytest.fixture(scope="session", autouse=True)
def _disable_audit_db_writes() -> None:
    set_audit_sink_for_tests(lambda _r: None)
