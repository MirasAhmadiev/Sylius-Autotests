#!/usr/bin/env bash
set -euo pipefail

# каталоги для отчётов
mkdir -p /app/src/playwright-report /app/src/test-results

# чистим содержимое отчёта (маунт не трогаем)
find /app/src/playwright-report -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true

# прогон тестов
npx playwright test -c /app/src/playwright.config.js --workers="${WORKERS:-2}"

# показать, что отчёт создался
ls -la /app/src/playwright-report
