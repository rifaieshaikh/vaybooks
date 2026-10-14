from datetime import date, datetime
from typing import List, Optional

from pymongo.database import Database

from vaybooks.bms.domain.finance.accounting.entities import Account, Voucher, VoucherLine
from vaybooks.bms.domain.identity.location_access import merge_mongo_filters
from vaybooks.bms.domain.shared.enums import AccountType, VoucherType
from vaybooks.bms.infrastructure.db.bson_utils import from_bson_date, to_bson_value


class MongoAccountRepository:
    def __init__(self, db: Database):
        self._collection = db.accounts

    def _to_doc(self, account: Account) -> dict:
        return {
            "_id": account.id,
            "account_name": account.account_name,
            "account_type": account.account_type.value,
            "linked_customer_id": account.linked_customer_id,
            "linked_vendor_id": account.linked_vendor_id,
            "linked_delivery_partner_id": account.linked_delivery_partner_id,
            "linked_worker_id": account.linked_worker_id,
            "linked_agent_id": account.linked_agent_id,
            "opening_balance": account.opening_balance,
            "current_balance": account.current_balance,
            "is_store_account": account.is_store_account,
            "is_salary_account": account.is_salary_account,
            "is_active": account.is_active,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        }

    def _from_doc(self, doc: dict) -> Account:
        return Account(
            id=doc["_id"],
            account_name=doc["account_name"],
            account_type=AccountType(doc["account_type"]),
            linked_customer_id=doc.get("linked_customer_id"),
            linked_vendor_id=doc.get("linked_vendor_id"),
            linked_delivery_partner_id=doc.get("linked_delivery_partner_id"),
            linked_worker_id=doc.get("linked_worker_id"),
            linked_agent_id=doc.get("linked_agent_id"),
            opening_balance=doc.get("opening_balance", 0),
            current_balance=doc.get("current_balance", 0),
            is_store_account=doc.get("is_store_account", False),
            is_salary_account=doc.get("is_salary_account", False),
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    def save(self, account: Account) -> Account:
        self._collection.replace_one(
            {"_id": account.id}, self._to_doc(account), upsert=True
        )
        return account

    def find_by_id(self, account_id: str) -> Optional[Account]:
        doc = self._collection.find_one({"_id": account_id})
        return self._from_doc(doc) if doc else None

    def find_by_name(self, name: str) -> Optional[Account]:
        doc = self._collection.find_one({"account_name": name})
        return self._from_doc(doc) if doc else None

    def find_customer_account(self, customer_id: str) -> Optional[Account]:
        doc = self._collection.find_one({"linked_customer_id": customer_id})
        return self._from_doc(doc) if doc else None

    def customer_balances_by_customer(self) -> dict:
        """Map of customer_id -> current_balance, one query."""
        cursor = self._collection.find(
            {"linked_customer_id": {"$type": "string"}},
            {"linked_customer_id": 1, "current_balance": 1},
        )
        return {
            str(doc["linked_customer_id"]): doc.get("current_balance", 0.0)
            for doc in cursor
        }

    def find_vendor_account(self, vendor_id: str) -> Optional[Account]:
        doc = self._collection.find_one({"linked_vendor_id": vendor_id})
        return self._from_doc(doc) if doc else None

    def find_worker_account(self, worker_id: str) -> Optional[Account]:
        doc = self._collection.find_one({"linked_worker_id": worker_id})
        return self._from_doc(doc) if doc else None

    def find_agent_account(self, agent_id: str) -> Optional[Account]:
        doc = self._collection.find_one({"linked_agent_id": agent_id})
        return self._from_doc(doc) if doc else None

    def find_delivery_partner_account(self, partner_id: str) -> Optional[Account]:
        doc = self._collection.find_one({"linked_delivery_partner_id": partner_id})
        return self._from_doc(doc) if doc else None

    def list_all(self, active_only: bool = True) -> List[Account]:
        query = {"is_active": True} if active_only else {}
        return [self._from_doc(d) for d in self._collection.find(query)]

    def update_balance(self, account_id: str, debit: float, credit: float) -> None:
        self._collection.update_one(
            {"_id": account_id},
            {
                "$inc": {"current_balance": debit - credit},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )

    def delete(self, account_id: str) -> None:
        self._collection.delete_one({"_id": account_id})


class MongoVoucherRepository:
    def __init__(self, db: Database):
        self._collection = db.vouchers

    def _line_to_doc(self, line: VoucherLine) -> dict:
        return {
            "voucher_line_id": line.voucher_line_id,
            "account_id": line.account_id,
            "account_name": line.account_name,
            "debit_amount": line.debit_amount,
            "credit_amount": line.credit_amount,
            "description": line.description,
        }

    def _line_from_doc(self, doc: dict) -> VoucherLine:
        return VoucherLine(
            voucher_line_id=doc["voucher_line_id"],
            account_id=doc["account_id"],
            account_name=doc["account_name"],
            debit_amount=doc.get("debit_amount", 0),
            credit_amount=doc.get("credit_amount", 0),
            description=doc.get("description", ""),
        )

    def _to_doc(self, voucher: Voucher) -> dict:
        due = getattr(voucher, "due_date", None)
        return {
            "_id": voucher.id,
            "voucher_number": voucher.voucher_number,
            "voucher_type": voucher.voucher_type.value,
            "voucher_date": voucher.voucher_date,
            "description": voucher.description,
            "financial_year": voucher.financial_year or "",
            "reference_order_id": voucher.reference_order_id,
            "reference_invoice_id": voucher.reference_invoice_id,
            "reference_service_id": voucher.reference_service_id,
            "reference_po_id": voucher.reference_po_id,
            "reference_grn_id": voucher.reference_grn_id,
            "reference_so_id": voucher.reference_so_id,
            "reference_dn_id": voucher.reference_dn_id,
            "delivery_status": getattr(voucher, "delivery_status", "") or "",
            "reference_project_id": voucher.reference_project_id,
            "reference_activity_id": voucher.reference_activity_id,
            "reference_production_batch_id": voucher.reference_production_batch_id,
            "location_id": voucher.location_id,
            "location_name": voucher.location_name,
            "due_date": to_bson_value(due) if due else None,
            "lines": [self._line_to_doc(l) for l in voucher.lines],
            "created_at": voucher.created_at,
            "updated_at": voucher.updated_at,
        }

    def _from_doc(self, doc: dict) -> Voucher:
        due_raw = doc.get("due_date")
        due_date = None
        if due_raw:
            if isinstance(due_raw, str):
                due_date = date.fromisoformat(due_raw[:10])
            else:
                due_date = from_bson_date(due_raw)
                if isinstance(due_date, datetime):
                    due_date = due_date.date()
        return Voucher(
            id=doc["_id"],
            voucher_number=doc["voucher_number"],
            voucher_type=VoucherType(doc["voucher_type"]),
            voucher_date=doc["voucher_date"],
            description=doc.get("description", ""),
            financial_year=doc.get("financial_year", "") or "",
            reference_order_id=doc.get("reference_order_id"),
            reference_invoice_id=doc.get("reference_invoice_id"),
            reference_service_id=doc.get("reference_service_id"),
            reference_po_id=doc.get("reference_po_id"),
            reference_grn_id=doc.get("reference_grn_id"),
            reference_so_id=doc.get("reference_so_id"),
            reference_dn_id=doc.get("reference_dn_id"),
            delivery_status=doc.get("delivery_status", "") or "",
            reference_project_id=doc.get("reference_project_id"),
            reference_activity_id=doc.get("reference_activity_id"),
            reference_production_batch_id=doc.get(
                "reference_production_batch_id"
            ),
            location_id=str(doc.get("location_id") or ""),
            location_name=str(doc.get("location_name") or ""),
            due_date=due_date,
            lines=[self._line_from_doc(l) for l in doc.get("lines", [])],
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    def save(self, voucher: Voucher) -> Voucher:
        self._collection.replace_one(
            {"_id": voucher.id}, self._to_doc(voucher), upsert=True
        )
        return voucher

    def find_by_id(self, voucher_id: str) -> Optional[Voucher]:
        doc = self._collection.find_one({"_id": voucher_id})
        return self._from_doc(doc) if doc else None

    def delete(self, voucher_id: str) -> None:
        self._collection.delete_one({"_id": voucher_id})

    def find_by_invoice(self, invoice_id: str) -> Optional[Voucher]:
        doc = self._collection.find_one({"reference_invoice_id": invoice_id})
        return self._from_doc(doc) if doc else None

    def find_by_number(self, voucher_number: str) -> Optional[Voucher]:
        doc = self._collection.find_one({"voucher_number": voucher_number})
        return self._from_doc(doc) if doc else None

    def list_by_account(
        self, account_id: str, location_filter: dict | None = None
    ) -> List[Voucher]:
        query = merge_mongo_filters(
            {"lines.account_id": account_id}, location_filter or {}
        )
        docs = self._collection.find(query)
        return [self._from_doc(d) for d in docs]

    def count_by_type_and_account(
        self, voucher_type: VoucherType, account_id: str
    ) -> int:
        if not account_id:
            return 0
        return self._collection.count_documents(
            {
                "voucher_type": voucher_type.value,
                "lines.account_id": account_id,
            }
        )

    def list_by_order(self, order_id: str) -> List[Voucher]:
        docs = self._collection.find({"reference_order_id": order_id})
        return [self._from_doc(d) for d in docs]

    def list_by_project(self, project_id: str) -> List[Voucher]:
        docs = self._collection.find({"reference_project_id": project_id})
        return [self._from_doc(d) for d in docs]

    def list_all(self, location_filter: dict | None = None) -> List[Voucher]:
        query = merge_mongo_filters(location_filter or {})
        return [self._from_doc(d) for d in self._collection.find(query)]

    def list_by_type(
        self,
        voucher_type: str | VoucherType,
        *,
        location_filter: dict | None = None,
        extra_filter: dict | None = None,
    ) -> List[Voucher]:
        vt = voucher_type.value if hasattr(voucher_type, "value") else str(voucher_type)
        base: dict = {"voucher_type": vt}
        if extra_filter:
            base = {"$and": [base, extra_filter]}
        query = merge_mongo_filters(base, location_filter or {})
        return [self._from_doc(d) for d in self._collection.find(query)]

    def list_by_types(
        self,
        voucher_types: list[str | VoucherType],
        *,
        location_filter: dict | None = None,
        extra_filter: dict | None = None,
    ) -> List[Voucher]:
        values = [
            vt.value if hasattr(vt, "value") else str(vt) for vt in voucher_types
        ]
        if not values:
            return []
        base: dict = {"voucher_type": {"$in": values}}
        if extra_filter:
            base = {"$and": [base, extra_filter]}
        query = merge_mongo_filters(base, location_filter or {})
        return [self._from_doc(d) for d in self._collection.find(query)]

    def query_by_type(
        self,
        voucher_type: str | VoucherType,
        *,
        extra_filter: dict | None = None,
        sort_by: str = "voucher_date",
        sort_desc: bool = True,
        page: int = 1,
        page_size: int = 12,
        location_filter: dict | None = None,
    ) -> dict:
        from packages.services_kit.paging import query_mongo_page

        vt = voucher_type.value if hasattr(voucher_type, "value") else str(voucher_type)
        base: dict = {"voucher_type": vt}
        if extra_filter:
            base = {"$and": [base, extra_filter]}
        query = merge_mongo_filters(base, location_filter or {})
        return query_mongo_page(
            self._collection,
            query,
            sort_by=sort_by,
            sort_desc=sort_desc,
            page=page,
            page_size=page_size,
            map_doc=self._from_doc,
        )

    def query_page(
        self,
        query: dict | None = None,
        *,
        sort_by: str = "",
        sort_desc: bool = True,
        page: int = 1,
        page_size: int = 12,
        location_filter: dict | None = None,
    ) -> dict:
        from packages.services_kit.paging import query_mongo_page

        q = merge_mongo_filters(query or {}, location_filter or {})
        return query_mongo_page(
            self._collection,
            q,
            sort_by=sort_by,
            sort_desc=sort_desc,
            page=page,
            page_size=page_size,
            map_doc=self._from_doc,
        )


class MongoAccountingRepository:
    """Facade combining account and voucher repos."""

    def __init__(self, db: Database):
        self.accounts = MongoAccountRepository(db)
        self.vouchers = MongoVoucherRepository(db)
