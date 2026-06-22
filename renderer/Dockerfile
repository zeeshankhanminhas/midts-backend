FROM node:22-bookworm

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npx playwright install --with-deps chromium

COPY server.js ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
