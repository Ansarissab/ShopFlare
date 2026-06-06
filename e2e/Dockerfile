FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /work
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "test:visual"]
