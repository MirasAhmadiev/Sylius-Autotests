Sylius-Autotests

Автотесты UI и API для демо-магазина Sylius на Playwright.
Поддерживается запуск локально, в Docker Compose и в GitHub Actions (артефакт с HTML-отчётом).

TL;DR
Запуск в Docker
docker compose build --pull
docker compose up --abort-on-container-exit --exit-code-from tests
# открыть отчёт.
# macOS:
open ./playwright-report/index.html
# Windows:
start ./playwright-report/index.html
docker compose down

Запуск локально (без Docker)
npm ci
npx playwright install --with-deps
BASE_URL=https://demo.sylius.com npx playwright test --reporter=html

Что тестируется

UI (E2E): базовые пользовательские сценарии демо-магазина (каталог, поиск, корзина и т.д.).

API: публичные эндпоинты Sylius Shop API.
Swagger: /api/v2/docs (относительно BASE_URL).

Структура проекта
.
├── tests
│   ├── e2e/                 # UI-тесты
│   └── api/                 # API-тесты
├── playwright.config.js     # конфиг Playwright (ESM)
├── docker-compose.yml       # запуск в контейнере
├── Dockerfile               # образ с браузерами
├── .github/workflows/playwright.yml  # CI: GitHub Actions
├── .env.example             # примеры переменных окружения
├── package.json
└── playwright-report/       # HTML-отчёт (генерится на прогоне)

Конфигурация

BASE_URL – базовый URL тестируемого стенда (по умолчанию https://demo.sylius.com).

WORKERS – количество воркеров Playwright (по умолчанию 2).
Можно переопределять из CLI/Compose/CI.

Примеры:

# локально
WORKERS=4 npx playwright test
# в Docker разово
docker compose run --rm -e WORKERS=4 tests bash -lc 'npx playwright test'

Команды

Запуск только UI:

npx playwright test tests/e2e


Запуск только API:

npx playwright test tests/api


Фильтр по тегам (например, @ui, @api):

npx playwright test -g "@ui"

CI (GitHub Actions)

Workflow .github/workflows/playwright.yml:

контейнер mcr.microsoft.com/playwright:v1.54.2-jammy;

npm ci → npx playwright test --reporter=html;

загрузка HTML-отчёта артефактом playwright-report.

Полезно знать

Версии должны совпадать: @playwright/test = 1.54.2 и образ v1.54.2-jammy.
Ошибка вида “Executable doesn’t exist … please update docker image” решается обновлением образа или переустановкой браузеров (npx playwright install --with-deps).

Для стабильности и экономии RAM по умолчанию используется workers=2 и браузер chromium.
Firefox/WebKit можно включить через конфиг/CLI.

Лицензия

ISC
