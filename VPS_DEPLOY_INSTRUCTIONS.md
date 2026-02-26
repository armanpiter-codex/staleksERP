# Staleks ERP — Инструкция для деплоя на VPS

## Обзор проекта

Staleks ERP — система управления производством стальных дверей.
Стек: FastAPI (Python 3.12) + Next.js 15 + PostgreSQL 16 + Redis 7 + Nginx.
Всё в Docker. 21 таблица, 13 миграций Alembic.

## Что уже готово

Проект полностью подготовлен к production:
- `docker-compose.prod.yml` — production stack (5 контейнеров: postgres, redis, backend, frontend, nginx)
- `backend/Dockerfile.prod` — uvicorn 2 workers
- `frontend/Dockerfile.prod` — multi-stage build (Next.js standalone)
- `infra/nginx/nginx.prod.conf` — reverse proxy (/ → frontend, /api/ → backend)
- `.env.prod.example` — шаблон переменных окружения
- `Makefile` — все `make prod-*` команды

## Архитектура production

```
Internet → :80 → Nginx
                   ├── /        → Frontend :3000  (Next.js standalone)
                   └── /api/    → Backend  :8000  (Uvicorn 2 workers)
                                    ├── PostgreSQL :5432 (internal only)
                                    └── Redis      :6379 (internal only)
```

PostgreSQL и Redis НЕ имеют открытых портов наружу — только внутренняя сеть Docker.

## Пошаговый деплой

### Шаг 1: Подготовка VPS

Требования: Ubuntu 22.04+, 2+ GB RAM, Docker 24+, Docker Compose v2+.

```bash
# Если Docker не установлен:
curl -fsSL https://get.docker.com | sh
systemctl enable docker
apt install docker-compose-plugin -y
```

### Шаг 2: Загрузить код

```bash
mkdir -p /opt/staleks && cd /opt/staleks
# Вариант A: git clone <repo-url> .
# Вариант B: scp -r с локальной машины
```

### Шаг 3: Настроить окружение

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Что нужно изменить в `.env.prod`:
- `POSTGRES_PASSWORD` → сильный пароль (32+ символов)
- `REDIS_PASSWORD` → сильный пароль (32+ символов)
- `SECRET_KEY` → сгенерировать: `python3 -c "import secrets; print(secrets.token_hex(32))"`
- `DOMAIN` → IP-адрес VPS или домен
- `ALLOWED_ORIGINS` → `http://YOUR_VPS_IP` (или `https://your-domain.com`)
- `NEXT_PUBLIC_API_URL` → `http://YOUR_VPS_IP/api/v1`

### Шаг 4: Собрать и запустить

```bash
make prod-build     # Собрать все Docker images (5-10 мин первый раз)
make prod-up        # Запустить 5 контейнеров
sleep 10            # Подождать пока PostgreSQL стартует
make prod-migrate   # Накатить 13 миграций Alembic
make prod-seed      # Seed: роли, права, пользователи, конфигуратор
```

### Шаг 5: Проверить

```bash
make prod-logs                  # Логи (Ctrl+C для выхода)
curl http://localhost/api/v1/   # Должен ответить backend
```

Открыть в браузере: `http://YOUR_VPS_IP`

Логин: `owner` / `ChangeMe123!`

### Шаг 6 (опционально): SSL

Раскомментировать certbot в `docker-compose.prod.yml` и настроить nginx для HTTPS.

## Команды управления

| Команда | Описание |
|---------|----------|
| `make prod-up` | Запустить все контейнеры |
| `make prod-down` | Остановить все контейнеры |
| `make prod-build` | Пересобрать images |
| `make prod-logs` | Логи backend |
| `make prod-migrate` | Применить миграции |
| `make prod-seed` | Заполнить начальные данные |
| `make prod-reset` | Полный сброс (удалить volumes + пересоздать) |
| `make prod-shell` | Bash внутри backend контейнера |

## Структура данных (seed)

После `make prod-seed` + `make prod-migrate` будут созданы:
- 11 системных ролей (owner, admin, technologist, b2b_manager, ...)
- 34 права доступа
- 5 тестовых пользователей (owner, admin, technologist, b2b_manager, b2c_manager) — пароль: `ChangeMe123!`
- 86 полей конфигуратора, 11 моделей дверей, 13 секций, 17 правил видимости
- 3 типа услуг (замер, доставка, монтаж)

## Если что-то пошло не так

```bash
# Посмотреть логи конкретного контейнера
docker compose -f docker-compose.prod.yml logs backend --tail=50
docker compose -f docker-compose.prod.yml logs frontend --tail=50
docker compose -f docker-compose.prod.yml logs nginx --tail=50
docker compose -f docker-compose.prod.yml logs postgres --tail=50

# Зайти в БД
docker compose -f docker-compose.prod.yml exec postgres psql -U staleks staleks_erp

# Полный сброс если всё сломалось
make prod-down
docker volume rm stalekserp_postgres_data stalekserp_redis_data 2>/dev/null
make prod-build && make prod-up
sleep 15
make prod-migrate && make prod-seed
```

## Ключевые файлы

- `docker-compose.prod.yml` — production stack
- `.env.prod` — секреты (НЕ коммитить в git!)
- `infra/nginx/nginx.prod.conf` — nginx конфиг
- `backend/Dockerfile.prod` — backend image
- `frontend/Dockerfile.prod` — frontend image
- `Makefile` — все команды
- `backend/alembic/` — миграции (0001-0013)
- `backend/app/scripts/seed_db.py` — seed ролей и пользователей
- `backend/app/scripts/seed_configurator.py` — seed полей конфигуратора
