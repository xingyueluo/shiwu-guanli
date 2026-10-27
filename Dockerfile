# 事务管理系统 · 部署镜像
# Node 22.5+ 自带 node:sqlite，无需编译任何原生依赖，镜像很小
FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server ./server
COPY public ./public

# SQLite 数据落在 /app/data，云平台可挂载持久卷
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
