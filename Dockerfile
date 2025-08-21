# Образ с уже установленными браузерами Playwright
FROM mcr.microsoft.com/playwright:v1.54.2-jammy

# Ставим только зависимости проекта (исходники монтируем томами)
WORKDIR /app
COPY package*.json ./
RUN npm ci && npx playwright install --with-deps

# Чтобы Playwright видел зависимости, даже если код лежит в /app/src
ENV NODE_PATH=/app/node_modules


