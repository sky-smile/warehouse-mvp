FROM node:18-alpine

WORKDIR /app

# 安装构建依赖（用于编译 native modules）
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
