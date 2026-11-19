FROM node:22-alpine

WORKDIR /app

COPY package.json server.json glama.json LICENSE README.md SKILL.md ./
COPY bin ./bin
COPY src ./src

RUN mkdir -p /vault

ENV NODE_ENV=production
ENV OKF_VAULT_DIR=/vault

ENTRYPOINT ["node", "/app/bin/okf-wiki-mcp.mjs", "--serve"]
