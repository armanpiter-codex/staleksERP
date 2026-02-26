"""
QR timesheet handler — Phase 2
Scan QR code at workshop entry → log time via Telegram Bot
"""

# TODO: Phase 2
# Workflow:
# 1. Worker scans QR code at workshop entrance
# 2. QR links to a deep link: t.me/StaleksBot?start=qr_{workshop_id}_{shift_type}
# 3. Bot receives /start with QR payload
# 4. Bot calls backend API: POST /api/v1/timesheet/scan
#    Body: { user_telegram_id, workshop_id, shift_type: "in"|"out" }
# 5. Backend records timestamp, calculates hours
# 6. Bot confirms: "Смена началась в 08:15. Цех: Металл. Позиция: Сварщик."
