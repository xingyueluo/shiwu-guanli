# 部署指南（免费云服务）

目标：让网站拥有一个公网可访问的 URL，答辩时现场打开演示。

## 方案对比

| 方案 | 费用 | 需要信用卡 | 数据持久化 | 难度 |
|---|---|---|---|---|
| **Koyeb（当前使用）** | 免费 | ❌ 不需要 | 无磁盘，闲置会重置 | ★★ |
| Render | 免费 | ⚠️ 需要（$1 预授权验证） | 付费档才有磁盘 | ★★ |
| 校园网/本机 + 内网穿透（cpolar/花生壳） | 免费 | ❌ | 本地文件，完全持久 | ★★★ |

> ⚠️ 免费档的共同限制：一段时间无访问会休眠，冷启动约 30-60 秒。演示前先访问一次唤醒。

## Koyeb 部署步骤（约 8 分钟，当前方案）

1. **把代码推上 GitHub**（已完成：仓库 `xingyueluo/shiwu-guanli`）
   ```bash
   git add .
   git commit -m "事务管理系统更新"
   git push
   ```

2. **注册并创建服务**
   - 打开 https://app.koyeb.com → Sign Up → **Continue with GitHub** 授权登录
   - Create → **Web Service**
   - Source 选 **GitHub** → 仓库 `shiwu-guanli`，分支 `main`
   - Build configuration 选 **Docker**（自动识别仓库里的 Dockerfile）
   - Instance type 选 **Free**，Region 选带 Free 标记的（`sin` 新加坡国内较快）
   - Environment variables 添加：`JWT_SECRET` = 任意随机长字符串
   - 点 **Deploy**

3. **等待构建**（2-4 分钟），状态变 **Running** 后
   访问 `https://<服务名>.koyeb.app` —— 这就是上线的网站首页。

4. **验证**：打开地址，注册账号、建任务、跑一个番茄。

## Render 部署步骤（备用，需信用卡）

1. https://render.com → Sign Up（GitHub 登录）→ New → Web Service → 选仓库
2. 自动读取 `render.yaml`（Docker + 持久磁盘 + JWT_SECRET），Instance 选 Free
3. **注意**：新用户需绑一张 Visa/Mastercard 做 $1 预授权验证（不扣费），没有国际卡则无法使用
4. 构建 3-5 分钟变 Live，得到 `https://<服务名>.onrender.com`

## 常见问题

- **构建失败 "npm install"**：确认推上去的代码不含 `node_modules`（.gitignore 已处理）。
- **访问 502/转圈**：免费实例冷启动中，等 1 分钟刷新即可。
- **数据哪去了**：免费容器无持久磁盘，长期闲置会重置——答辩前一两天部署即可，重新部署就是干净环境。
- **想要正式数据库**：可把 `db.js` 里的 `node:sqlite` 换成 Turso/Neon 的 HTTP 驱动——接口层已封装好 `all/get/run` 三个函数，改动集中在一处。

## 本地局域网演示（备用方案）

若现场断网：`npm start` 后查本机 IPv4（`ipconfig`），
同学访问 `http://<你的IP>:3000` 即可（需放行防火墙 3000 端口入站）。
