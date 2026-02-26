"""
Seed script: pricing rules + material norms + test order.
Run from container: python -m app.scripts.seed_test_data
Or directly: python backend/app/scripts/seed_test_data.py
"""
import urllib.request
import urllib.error
import json
import sys

BASE = "http://localhost:8000/api/v1"


def api(method: str, path: str, token: str, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ✗ {method} {path} → {e.code}: {err[:200]}")
        return None


def main():
    # ── Login ──────────────────────────────────────────────────────────────────
    print("🔐 Logging in as owner...")
    data = json.dumps({"username": "owner", "password": "ChangeMe123!"}).encode()
    req = urllib.request.Request(
        BASE + "/auth/login", data=data,
        headers={"Content-Type": "application/json"}
    )
    resp = urllib.request.urlopen(req)
    TOKEN = json.loads(resp.read())["access_token"]
    print("  ✓ Token obtained")

    # ── Check existing pricing rules ──────────────────────────────────────────
    existing_rules = api("GET", "/configurator/pricing-rules", TOKEN) or []
    existing_norms = api("GET", "/configurator/material-norms", TOKEN) or []
    print(f"\n📊 Existing: {len(existing_rules)} pricing rules, {len(existing_norms)} material norms")

    # ── Pricing Rules ─────────────────────────────────────────────────────────
    print("\n💰 Creating pricing rules...")

    pricing_rules = [
        # door_type_sub pricing
        {"field_code": "door_type_sub", "field_value": "fire_ei30",         "price_component": "18500", "cost_component": "11200", "notes": "Противопожарная EI30"},
        {"field_code": "door_type_sub", "field_value": "fire_ei60",         "price_component": "24000", "cost_component": "15500", "notes": "Противопожарная EI60"},
        {"field_code": "door_type_sub", "field_value": "technical_plain",   "price_component": "12000", "cost_component": "7800",  "notes": "Техническая без отделки"},
        {"field_code": "door_type_sub", "field_value": "apartment",         "price_component": "22000", "cost_component": "13500", "notes": "Квартирная"},
        {"field_code": "door_type_sub", "field_value": "cottage",           "price_component": "28000", "cost_component": "17000", "notes": "Коттеджная, усиленная"},

        # finish_ext_type pricing
        {"field_code": "finish_ext_type", "field_value": "powder_coat",    "price_component": "2500",  "cost_component": "1400",  "notes": "Порошковая покраска внешняя"},
        {"field_code": "finish_ext_type", "field_value": "mdf_smooth",     "price_component": "4500",  "cost_component": "2800",  "notes": "МДФ гладкий внешний"},
        {"field_code": "finish_ext_type", "field_value": "mdf_molded",     "price_component": "6500",  "cost_component": "4200",  "notes": "МДФ фигурный внешний"},
        {"field_code": "finish_ext_type", "field_value": "veneer",         "price_component": "9500",  "cost_component": "6200",  "notes": "Шпон натуральный внешний"},
        {"field_code": "finish_ext_type", "field_value": "pvc_film",       "price_component": "3200",  "cost_component": "1900",  "notes": "ПВХ-плёнка внешняя"},

        # finish_int_type pricing
        {"field_code": "finish_int_type", "field_value": "powder_coat",    "price_component": "1800",  "cost_component": "1000",  "notes": "Порошковая покраска внутренняя"},
        {"field_code": "finish_int_type", "field_value": "mdf_smooth",     "price_component": "3500",  "cost_component": "2100",  "notes": "МДФ гладкий внутренний"},
        {"field_code": "finish_int_type", "field_value": "mdf_molded",     "price_component": "5200",  "cost_component": "3300",  "notes": "МДФ фигурный внутренний"},
        {"field_code": "finish_int_type", "field_value": "veneer",         "price_component": "7500",  "cost_component": "4800",  "notes": "Шпон натуральный внутренний"},
        {"field_code": "finish_int_type", "field_value": "pvc_film",       "price_component": "2400",  "cost_component": "1400",  "notes": "ПВХ-плёнка внутренняя"},

        # access_control pricing
        {"field_code": "access_control", "field_value": "none",            "price_component": "0",     "cost_component": "0",     "notes": "Без контроля доступа"},
        {"field_code": "access_control", "field_value": "card_reader",     "price_component": "3500",  "cost_component": "2200",  "notes": "Считыватель RFID"},
        {"field_code": "access_control", "field_value": "keypad",          "price_component": "2800",  "cost_component": "1700",  "notes": "Кодовая панель"},
        {"field_code": "access_control", "field_value": "fingerprint",     "price_component": "7500",  "cost_component": "4800",  "notes": "Биометрия"},
        {"field_code": "access_control", "field_value": "video_domophone", "price_component": "12000", "cost_component": "7500",  "notes": "Видеодомофон"},
    ]

    created_rules = 0
    for rule in pricing_rules:
        # Skip if already exists (same field_code + field_value)
        exists = any(
            r["field_code"] == rule["field_code"] and r["field_value"] == rule["field_value"]
            for r in existing_rules
        )
        if exists:
            print(f"  ⏭  Skip {rule['field_code']}={rule['field_value']} (exists)")
            continue
        result = api("POST", "/configurator/pricing-rules", TOKEN, rule)
        if result:
            created_rules += 1
            print(f"  ✓ {rule['field_code']}={rule['field_value']} → {rule['price_component']} ₽")

    print(f"\n  Created {created_rules} pricing rules")

    # ── Material Norms ────────────────────────────────────────────────────────
    print("\n🧱 Creating material norms...")

    material_norms = [
        # Steel sheet for door type
        {
            "field_code": "door_type_sub", "field_value": "fire_ei30",
            "material_name": "Лист стальной 2мм (EI30)", "material_code": "ST-2.0-EI30",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 2.1",
            "notes": "Два листа 2мм + 5% запас на раскрой"
        },
        {
            "field_code": "door_type_sub", "field_value": "fire_ei60",
            "material_name": "Лист стальной 3мм (EI60)", "material_code": "ST-3.0-EI60",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 2.1",
            "notes": "Два листа 3мм + 5% запас"
        },
        {
            "field_code": "door_type_sub", "field_value": "technical_plain",
            "material_name": "Лист стальной 2мм (тех)", "material_code": "ST-2.0",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 2.1",
            "notes": "Стандартная техническая дверь"
        },
        {
            "field_code": "door_type_sub", "field_value": "apartment",
            "material_name": "Лист стальной 2мм (квартира)", "material_code": "ST-2.0-APT",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 2.15",
            "notes": "Квартирная дверь + усиленная рама"
        },
        {
            "field_code": "door_type_sub", "field_value": "cottage",
            "material_name": "Лист стальной 3мм (коттедж)", "material_code": "ST-3.0-COT",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 2.2",
            "notes": "Усиленная коттеджная дверь"
        },

        # MDF for finish
        {
            "field_code": "finish_ext_type", "field_value": "mdf_smooth",
            "material_name": "МДФ листовой 8мм (гладкий)", "material_code": "MDF-8-SM",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 1.1",
            "notes": "10% запас на раскрой"
        },
        {
            "field_code": "finish_ext_type", "field_value": "mdf_molded",
            "material_name": "МДФ листовой 16мм (фигурный)", "material_code": "MDF-16-FG",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 1.15",
            "notes": "15% запас на фрезеровку"
        },
        {
            "field_code": "finish_int_type", "field_value": "mdf_smooth",
            "material_name": "МДФ листовой 8мм (гладкий, внутр)", "material_code": "MDF-8-SM-INT",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 1.1",
            "notes": "Внутренняя отделка МДФ"
        },

        # Basalt wool for fireproof
        {
            "field_code": "door_type_sub", "field_value": "fire_ei30",
            "material_name": "Базальтовая вата 50мм", "material_code": "BASALT-50",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 1.05",
            "notes": "Огнезащитный наполнитель EI30"
        },
        {
            "field_code": "door_type_sub", "field_value": "fire_ei60",
            "material_name": "Базальтовая вата 100мм", "material_code": "BASALT-100",
            "unit": "м²", "quantity_formula": "height * width / 1000000 * 1.05",
            "notes": "Огнезащитный наполнитель EI60"
        },
    ]

    created_norms = 0
    for norm in material_norms:
        exists = any(
            n["field_code"] == norm["field_code"] and
            n["field_value"] == norm["field_value"] and
            n["material_name"] == norm["material_name"]
            for n in existing_norms
        )
        if exists:
            print(f"  ⏭  Skip {norm['material_name']} (exists)")
            continue
        result = api("POST", "/configurator/material-norms", TOKEN, norm)
        if result:
            created_norms += 1
            print(f"  ✓ {norm['material_name']} ({norm['unit']})")

    print(f"\n  Created {created_norms} material norms")

    # ── Test Configuration ────────────────────────────────────────────────────
    print("\n🚪 Creating test door configuration...")

    config_payload = {
        "door_type": "finish",
        "name": "ТЗ-001 Квартирная входная (демо)",
        "quantity": 5,
        "notes": "Тестовая конфигурация. Создана автоматически для демонстрации.",
        "values": {
            "height": 2100,
            "width": 960,
            "door_type_sub": "apartment",
            "opening_direction": "right",
            "opening_side": "inward",
            "finish_ext_type": "mdf_smooth",
            "finish_int_type": "mdf_smooth",
            "access_control": "card_reader",
            "frame_type": "standard",
            "threshold_type": "standard",
            "peephole": True,
            "door_closer": False,
        }
    }

    configs = api("GET", "/configurator/configurations", TOKEN) or []
    demo_exists = any("демо" in c.get("name", "").lower() for c in configs)

    if demo_exists:
        print("  ⏭  Demo configuration already exists")
    else:
        result = api("POST", "/configurator/configurations", TOKEN, config_payload)
        if result:
            config_id = result["id"]
            print(f"  ✓ Configuration created: {result['name']} (id={config_id})")

            # Add markings
            print("\n🏷  Adding markings...")
            markings_payload = {
                "prefix": "КВ",
                "start_number": 1,
                "count": 5,
                "zero_pad": 2
            }
            marks = api("POST", f"/configurator/configurations/{config_id}/markings/generate", TOKEN, markings_payload)
            if marks:
                print(f"  ✓ Generated {len(marks)} markings: {[m['marking'] for m in marks]}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 50)
    print("✅ DONE!")
    print(f"   • Pricing rules: {created_rules} new")
    print(f"   • Material norms: {created_norms} new")
    print(f"   • Test configuration: {'created' if not demo_exists else 'already existed'}")
    print("\nOpen http://localhost:3000/settings to check справочники")
    print("Open http://localhost:3000/configurator to see configuration")


if __name__ == "__main__":
    main()
