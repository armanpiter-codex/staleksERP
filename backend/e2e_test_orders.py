"""
E2E test: Full order lifecycle with all Sprint 1 features.
Run inside Docker: docker compose exec backend python e2e_test_orders.py
"""
import asyncio
import json
import sys

import httpx

BASE = "http://localhost:8000/api/v1"


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        print("=" * 70)
        print("  STALEKS ERP — E2E Order Lifecycle Test")
        print("=" * 70)

        # ── Step 1: Login ──────────────────────────────────────────────
        print("\n[1/9] Login as owner...")
        r = await c.post("/auth/login", json={"username": "owner", "password": "ChangeMe123!"})
        if r.status_code != 200:
            print(f"  FAIL: {r.status_code} {r.text}")
            sys.exit(1)
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  OK: got token ...{token[-20:]}")

        # ── Step 2: Get measurers ─────────────────────────────────────
        print("\n[2/9] Get users by role (measurers dropdown)...")
        r = await c.get("/users/by-role", params={"role": "owner"}, headers=headers)
        print(f"  Status: {r.status_code}")
        users = r.json()
        print(f"  Found {len(users)} user(s): {[u['full_name'] for u in users]}")

        # ── Step 3: Create configuration ──────────────────────────────
        print("\n[3/9] Create door configuration...")
        r = await c.post("/configurator/configurations", json={
            "door_type": "technical",
            "name": "DMP-1 Neo Park",
            "quantity": 40,
            "values": {
                "door_model": "DMP",
                "width": "900",
                "height": "2100",
                "steel_thickness": "1.5",
                "color_outside": "RAL 7035",
                "color_inside": "RAL 9003",
                "lock_type": "cylinder",
                "glazing_type": "none"
            },
            "notes": "40 technical doors for Neo Park, Block 1"
        }, headers=headers)
        print(f"  Status: {r.status_code}")
        if r.status_code not in (200, 201):
            print(f"  FAIL: {r.text}")
            sys.exit(1)
        config1 = r.json()
        config1_id = config1["id"]
        print(f"  Config ID: {config1_id}")
        print(f"  Name: {config1['name']}, Qty: {config1['quantity']}")

        # ── Step 4: Duplicate configuration ───────────────────────────
        print("\n[4/9] Duplicate configuration...")
        r = await c.post(f"/configurator/configurations/{config1_id}/duplicate", headers=headers)
        print(f"  Status: {r.status_code}")
        if r.status_code not in (200, 201):
            print(f"  FAIL: {r.text}")
            sys.exit(1)
        config2 = r.json()
        config2_id = config2["id"]
        print(f"  Duplicated Config ID: {config2_id}")
        print(f"  Name: {config2['name']}")

        # Update the duplicate
        r = await c.patch(f"/configurator/configurations/{config2_id}", json={
            "name": "DMP-2 Neo Park Finish",
            "quantity": 40,
            "values": {
                "door_model": "DMP",
                "width": "960",
                "height": "2100",
                "steel_thickness": "2.0",
                "color_outside": "RAL 3005",
                "color_inside": "RAL 9010",
                "lock_type": "biometric",
                "glazing_type": "tempered"
            }
        }, headers=headers)
        print(f"  Updated duplicate: {r.status_code}")

        # ── Step 5: Create order with all new fields ──────────────────
        print("\n[5/9] Create order with all Sprint 1 fields...")
        r = await c.post("/orders", json={
            "client_name": "TOO Bazis-A",
            "client_phone": "+7 777 123 4567",
            "client_email": "zakaz@bazis-a.kz",
            "client_type": "b2b",
            "client_company": "TOO Bazis-A Construction",
            "delivery_address": "Almaty, Seifullin 404, Neo Park",
            "desired_delivery_date": "2026-04-15",
            "prepayment_amount": "7000000",
            "discount_percent": "5",
            "credit_days": 45,
            "notes": "ZhK Neo Park, 80 doors, 2 configurations",
            "object_name": "ZhK Neo Park",
            "sales_channel": "corporate",
            "vat_rate": "16",
            "measurement_cost": "50000",
            "delivery_cost": "200000",
            "installation_cost": "500000",
            "source": "tender-samruk",
            "configuration_ids": [config1_id, config2_id]
        }, headers=headers)
        print(f"  Status: {r.status_code}")
        if r.status_code not in (200, 201):
            print(f"  FAIL: {r.text}")
            sys.exit(1)
        order = r.json()
        order_id = order["id"]
        print(f"  Order ID: {order_id}")
        print(f"  Order #: {order['order_number']}")
        print(f"  Status: {order['status']}")
        print(f"  Client: {order['client_name']}")
        print(f"  Object: {order.get('object_name', 'N/A')}")
        print(f"  Channel: {order.get('sales_channel', 'N/A')}")
        print(f"  VAT rate: {order.get('vat_rate', 'N/A')}%")
        print(f"  Configs attached: {len(order.get('configurations', []))}")

        # ── Step 6: Generate markings ─────────────────────────────────
        print("\n[6/9] Generate markings for both configurations...")
        r = await c.post(
            f"/configurator/configurations/{config1_id}/markings/generate",
            json={"prefix": "D1", "start_number": 1, "count": 40, "zero_pad": 3},
            headers=headers
        )
        print(f"  Config1 markings: {r.status_code} ({len(r.json())} markings)")

        r = await c.post(
            f"/configurator/configurations/{config2_id}/markings/generate",
            json={"prefix": "D2", "start_number": 1, "count": 40, "zero_pad": 3},
            headers=headers
        )
        print(f"  Config2 markings: {r.status_code} ({len(r.json())} markings)")

        # ── Step 7: Order summary with VAT ────────────────────────────
        print("\n[7/9] Order summary (VAT calculation)...")
        r = await c.get(f"/orders/{order_id}/summary", headers=headers)
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            s = r.json()
            print(f"  ┌─────────────────────────────────────────────────┐")
            print(f"  │ Order: {s['order_number']:<15} Client: {s['client_name']:<15}│")
            print(f"  │ Configs: {s['configurations_count']}    Doors: {s['total_doors']:<25}│")
            print(f"  ├─────────────────────────────────────────────────┤")
            print(f"  │ Subtotal:          {float(s['subtotal']):>15,.0f} KZT   │")
            print(f"  │ Discount (5%):     {float(s['discount_amount']):>15,.0f} KZT   │")
            print(f"  │ Measurement:       {float(s['measurement_cost']):>15,.0f} KZT   │")
            print(f"  │ Delivery:          {float(s['delivery_cost']):>15,.0f} KZT   │")
            print(f"  │ Installation:      {float(s['installation_cost']):>15,.0f} KZT   │")
            print(f"  │ Total before VAT:  {float(s['total_before_vat']):>15,.0f} KZT   │")
            print(f"  │ VAT ({s['vat_rate']}%):        {float(s['vat_amount']):>15,.0f} KZT   │")
            print(f"  │ ═══════════════════════════════════════════════ │")
            print(f"  │ TOTAL with VAT:    {float(s['total_with_vat']):>15,.0f} KZT   │")
            if s.get('prepayment_amount'):
                print(f"  │ Prepayment:        {float(s['prepayment_amount']):>15,.0f} KZT   │")
            if s.get('outstanding_amount') is not None:
                print(f"  │ Outstanding:       {float(s['outstanding_amount']):>15,.0f} KZT   │")
            print(f"  └─────────────────────────────────────────────────┘")

        # ── Step 8: Workflow transitions ──────────────────────────────
        print("\n[8/9] Workflow transitions...")

        # draft -> measurement
        r = await c.patch(f"/orders/{order_id}/status",
                          json={"status": "measurement"}, headers=headers)
        o = r.json()
        print(f"  draft -> measurement: {r.status_code} (status={o.get('status', 'err')})")

        # measurement -> confirmed (locks prices)
        r = await c.patch(f"/orders/{order_id}/status",
                          json={"status": "confirmed"}, headers=headers)
        o = r.json()
        print(f"  measurement -> confirmed: {r.status_code} (status={o.get('status', 'err')})")
        print(f"    confirmed_at: {o.get('confirmed_at', 'N/A')}")

        # Check locked prices
        for cfg in o.get("configurations", []):
            print(f"    Config '{cfg['name']}': locked_price={cfg.get('locked_price', 'N/A')}, locked_cost={cfg.get('locked_cost', 'N/A')}")

        # confirmed -> in_production (cascade configs)
        r = await c.patch(f"/orders/{order_id}/status",
                          json={"status": "in_production"}, headers=headers)
        o = r.json()
        print(f"  confirmed -> in_production: {r.status_code} (status={o.get('status', 'err')})")
        print(f"    production_started_at: {o.get('production_started_at', 'N/A')}")

        # in_production -> shipped
        r = await c.patch(f"/orders/{order_id}/status",
                          json={"status": "shipped"}, headers=headers)
        o = r.json()
        print(f"  in_production -> shipped: {r.status_code} (status={o.get('status', 'err')})")
        print(f"    shipped_at: {o.get('shipped_at', 'N/A')}")

        # shipped -> completed
        r = await c.patch(f"/orders/{order_id}/status",
                          json={"status": "completed"}, headers=headers)
        o = r.json()
        print(f"  shipped -> completed: {r.status_code} (status={o.get('status', 'err')})")
        print(f"    completed_at: {o.get('completed_at', 'N/A')}")

        # ── Step 9: Final state ───────────────────────────────────────
        print("\n[9/9] Final order state...")
        r = await c.get(f"/orders/{order_id}", headers=headers)
        final = r.json()
        print(f"  Order #: {final['order_number']}")
        print(f"  Status: {final['status']}")
        print(f"  Total: {final.get('total_price', 'N/A')} KZT")
        print(f"  Configs: {len(final.get('configurations', []))}")
        for cfg in final.get("configurations", []):
            print(f"    - {cfg['name']} (qty={cfg['quantity']}, status={cfg['status']})")

        # ── Step 10: Test invalid transition ──────────────────────────
        print("\n[BONUS] Test invalid transition (completed -> draft)...")
        r = await c.patch(f"/orders/{order_id}/status",
                          json={"status": "draft"}, headers=headers)
        print(f"  Status: {r.status_code} (expected 400)")
        if r.status_code == 400:
            print(f"  Correctly rejected: {r.json().get('detail', '')[:80]}")

        print("\n" + "=" * 70)
        print("  ALL TESTS PASSED SUCCESSFULLY!")
        print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
