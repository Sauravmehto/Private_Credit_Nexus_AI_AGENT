"""MongoDB access for deals and audit_logs."""

from __future__ import annotations

import os
from typing import Any, Callable

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

client: MongoClient | None = None
db_name = "private_credit"

FindDeals = Callable[..., list[dict[str, Any]]]
FindDeal = Callable[..., dict[str, Any] | None]
Aggregate = Callable[..., list[dict[str, Any]]]
InsertAudit = Callable[..., None]


def get_mongo_uri() -> str:
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI is not configured")
    return uri


def resolve_db_name(uri: str) -> str:
    try:
        from urllib.parse import urlparse

        parsed = urlparse(uri)
        path = parsed.path.lstrip("/").strip()
        return path or "private_credit"
    except Exception:
        return "private_credit"


def connect_db() -> MongoClient:
    global client, db_name
    if client is not None:
        return client
    uri = get_mongo_uri()
    db_name = resolve_db_name(uri)
    client = MongoClient(
        uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=10000,
    )
    return client


def get_db() -> Database:
    return connect_db()[db_name]


def _default_find_deals(filter_spec: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    flt = filter_spec or {}
    coll: Collection = get_db()["deals"]
    return list(coll.find(flt))


def _default_find_deal(flt: dict[str, Any]) -> dict[str, Any] | None:
    return get_db()["deals"].find_one(flt)


def _default_aggregate(pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return list(get_db()["deals"].aggregate(pipeline))


def _default_insert_audit(entry: dict[str, Any]) -> None:
    get_db()["audit_logs"].insert_one(entry)


find_deals_executor: FindDeals = _default_find_deals


def _find_deal_wrap(flt: dict[str, Any]) -> dict[str, Any] | None:
    return _default_find_deal(flt)


find_deal_executor: FindDeal = _find_deal_wrap
aggregate_deals_executor: Aggregate = _default_aggregate
insert_audit_executor: InsertAudit = _default_insert_audit


def find_deals(filter_spec: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return find_deals_executor(filter_spec or {})


def find_deal_by_id(deal_id: str) -> dict[str, Any] | None:
    return find_deal_executor({"id": deal_id})


def aggregate_deals(pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return aggregate_deals_executor(pipeline)


def insert_audit_log(entry: dict[str, Any]) -> None:
    insert_audit_executor(entry)


def test_connection() -> None:
    get_db().command("ping")


def set_mongo_executors_for_tests(
    *,
    find_deals: FindDeals | None = None,
    find_deal: FindDeal | None = None,
    aggregate_deals: Aggregate | None = None,
    insert_audit: InsertAudit | None = None,
) -> None:
    global find_deals_executor, find_deal_executor, aggregate_deals_executor, insert_audit_executor
    if find_deals is not None:
        find_deals_executor = find_deals
    if find_deal is not None:
        find_deal_executor = find_deal
    if aggregate_deals is not None:
        aggregate_deals_executor = aggregate_deals
    if insert_audit is not None:
        insert_audit_executor = insert_audit


def close_connection() -> None:
    global client
    if client is not None:
        client.close()
        client = None
