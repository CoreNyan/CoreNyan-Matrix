FROM docker.m.daocloud.io/library/docker:29-cli AS dockercli
FROM docker.m.daocloud.io/library/node:24-bookworm-slim
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /opt/corenyan/corenyan-matrix
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY backend ./backend
COPY frontend/web ./frontend/web
COPY frontend/server.mjs ./frontend/server.mjs
COPY contracts ./contracts
ENV NODE_ENV=production
CMD ["node", "backend/server.js"]
