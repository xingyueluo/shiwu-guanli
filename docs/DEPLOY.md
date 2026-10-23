# 部署指南（免费云服务）

目标：让网站拥有一个公网可访问的 URL，答辩时现场打开演示。

## 方案对比

| 方案 | 费用 | 数据持久化 | 难度 |
|---|---|---|---|
| **Render（推荐）** | 免费 | 免费档磁盘 7 天未用会重置（答辩场景够用） | ★★ |
| Railway | 每月 $5 赠金 | 同上 | ★★ |
| 校园网/本机 + 内网穿透（cpolar/花生壳） | 免费 | 本地文件，完全持久 | ★★★ |

> ⚠️ 免费档的共同限制：15 分钟无访问会休眠，冷启动约 30-60 秒。演示前先访问一次唤醒。

## Render 部署步骤（约 10 分钟）

1. **把代码推上 GitHub**
   ```bash
   git init
   git add .
   git commit -m "拾光清单 v1"
   # 在 GitHub 新建仓库后：
   git remote add origin https://github.com/<你的用户名>/shiguang-tasks.git
   git push -u origin main
   ```

2. **注册 Render 并导入仓库**
   - 打开 https://render.com → Sign Up（可用 GitHub 账号直接登录）
   - New → Web Service → 选择刚才的仓库
   - 它会自动读取仓库里的 `render.yaml`（Docker 构建 + /app/data 持久磁盘 + 随机 JWT_SECRET）
   - Instance Type 选 **Free** → Create Web Service

3. **等待构建完成**，得到形如
   `https://shiguang-tasks.onrender.com` 的地址——这就是上线的网站首页。

4. **验证**：浏览器打开该地址，注册一个账号、建几个任务、跑一个番茄。

## 常见问题

- **构建失败 "npm install"**：确认推上去的代码不含 `node_modules`（.gitignore 已处理）。
- **访问 502**：免费实例冷启动中，等 1 分钟刷新即可。
- **数据哪去了**：免费档磁盘 7 天无活动会清空，属正常现象；答辩前一两天部署即可。
- **想要正式数据库**：可把 `db.js` 里的 `node:sqlite` 换成 Turso/Neon 的 HTTP 驱动——接口层已封装好 `all/get/run` 三个函数，改动集中在一处。

## 本地局域网演示（备用方案）

若现场断网：`npm start` 后查本机 IPv4（`ipconfig`），
同学访问 `http://<你的IP>:3000` 即可（需放行防火墙 3000 端口入站）。
