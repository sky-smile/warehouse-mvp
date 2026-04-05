FROM node:22-alpine

WORKDIR /app

# 更新基础镜像中的包并安装构建依赖（用于编译 native modules）
RUN apk update && apk upgrade --no-cache && apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --production
RUN apk del python3 make g++

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
