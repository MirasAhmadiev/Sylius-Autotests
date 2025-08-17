FROM mcr.microsoft.com/playwright:v1.54.2-jammy
WORKDIR /tests
COPY package*.json ./
RUN npm ci
# (опционально, но полезно) удостовериться, что нужные браузеры докачаются:
RUN npx playwright install --with-deps
COPY . .
CMD ["npx","playwright","test","--reporter=html"]

