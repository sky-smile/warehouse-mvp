# 1Panel 部署指南

## 方式一：Docker 容器部署（推荐）

### 1. 上传代码到服务器

```bash
# 将项目文件上传到服务器，例如 /opt/warehouse-mvp/
```

### 2. 使用 1Panel 容器管理

1. 登录 1Panel → **容器** → **Compose**
2. 点击 **创建**
3. 填写：
   - **名称**：`warehouse-mvp`
   - **docker-compose.yml** 路径：选择项目中的 `docker-compose.yml`
4. 点击 **创建并启动**

### 3. 配置反向代理

1. **网站** → **创建网站** → **反向代理**
2. 填写：
   - **域名**：`warehouse.yourdomain.com`（或服务器 IP）
   - **代理地址**：`http://127.0.0.1:3000`
3. 可选：配置 SSL 证书

---

## 方式二：1Panel 应用商店部署（如果支持自定义 Node.js 应用）

1. **应用商店** → **自定义应用**
2. 上传项目文件
3. 设置启动命令：`npm start`
4. 设置端口映射：`3000`

---

## 方式三：手动 Docker 命令

```bash
# 构建镜像
docker build -t warehouse-mvp .

# 运行容器
docker run -d \
  --name warehouse-mvp \
  --restart unless-stopped \
  -p 3000:3000 \
  -v warehouse-data:/app/data \
  -e NODE_ENV=production \
  warehouse-mvp
```

---

## 配置说明

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |
| `JWT_SECRET` | JWT 密钥 | 随机生成（生产环境建议手动设置） |

### 生产环境建议

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - JWT_SECRET=your-secure-random-string-here
```

---

## 数据持久化

数据文件存储在 Docker 卷 `warehouse-data` 中，映射到容器内的 `/app/data/warehouse.db`。
升级或迁移容器时，只需备份此卷即可保留所有数据。

### 备份数据库

```bash
# 进入容器
docker exec -it warehouse-mvp sh

# 复制数据库文件
cp /app/data/warehouse.db /backup/warehouse-$(date +%Y%m%d).db
```

### 恢复数据库

```bash
# 将备份文件复制回容器
docker cp backup/warehouse.db warehouse-mvp:/app/data/warehouse.db

# 重启容器
docker restart warehouse-mvp
```
