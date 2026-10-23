# 🗂️ 拾光清单 · 日常事务管理平台

> Web 开发技术 · 期末项目（单人项目，贡献度 100%）
> 前后端分离：原生 HTML/CSS/JS 单页应用 + Node.js/Express REST API + SQLite

## 一、项目简介

「拾光清单」解决的是每个人每天都会遇到的问题：**事情很多，不知道先做哪件，时间不知不觉被刷手机吃掉。**

它把三种经典时间管理方法做进了一个网站：

| 功能 | 解决的问题 |
|---|---|
| 📌 **今日焦点** | 打开就看到今天最该做的事（按象限优先级排序） |
| 🧭 **艾森豪威尔四象限** | 按「重要 × 紧急」两个维度给事务分类，支持**拖拽换象限** |
| 🍅 **番茄专注钟** | 25 分钟专注 + 5 分钟休息，完成的番茄自动关联任务并计入统计 |
| 📊 **数据统计** | 近 7 天完成任务数、专注分钟数、象限分布（纯 Canvas 手绘图表，未用图表库） |

在线地址：`（部署后填写 Render 提供的 URL）`

## 二、技术栈与选型理由

| 层 | 技术 | 为什么 |
|---|---|---|
| 前端 | 原生 HTML / CSS / JavaScript（SPA） | 课程所学即所用，无框架黑盒，答辩可逐行讲 |
| 后端 | Node.js + Express | 前后端同一语言；REST API 与页面完全分离 |
| 数据库 | SQLite（Node 22.5+ 官方内置 `node:sqlite`） | 零安装零配置零原生编译，单文件即数据库 |
| 认证 | 自实现 scrypt 密码散列 + HMAC 签名 Token | 不依赖 bcrypt/jsonwebtoken，全部基于 Node 内置 crypto |
| 图表 | 手写 Canvas 柱状图/环形图 | 体现工作量，深入理解坐标系与绘制 API |

**架构**：浏览器（静态 SPA） ⇄ `fetch /api/*`（JSON） ⇄ Express ⇄ `node:sqlite` ⇄ `data/app.db`

## 三、目录结构

```
待用3/
├── server/                 # 后端（与前端无任何代码耦合，只暴露 JSON API）
│   ├── index.js            # 入口：中间件、路由挂载、静态托管、限流、错误处理
│   ├── db.js               # SQLite 建表与查询封装
│   ├── auth.js             # scrypt 密码散列 + HMAC token 签发/校验
│   └── routes/
│       ├── auth.js         # /api/auth  注册、登录、me
│       ├── tasks.js        # /api/tasks 任务 CRUD + 筛选 + 象限移动
│       └── focus.js        # /api/focus 番茄记录 + 概览 + 周统计
├── public/                 # 前端（纯静态，可单独部署到任意 CDN）
│   ├── index.html          # 单页骨架：5 个视图 + 登录页 + 弹窗
│   ├── css/style.css       # 全部样式（含响应式）
│   └── js/
│       ├── api.js          # fetch 封装（自动带 token、统一错误）
│       ├── app.js          # 视图路由、任务渲染、拖拽、统计接线
│       ├── pomodoro.js     # 番茄钟（时间戳差值防漂移 + WebAudio 提示音）
│       └── charts.js       # Canvas 手绘图表
├── scripts/smoke-test.js   # API 冒烟测试（10 组断言）
├── Dockerfile / render.yaml# 部署配置
└── docs/                   # 部署指南、答辩要点
```

## 四、核心代码讲解（答辩重点）

### 1. 四象限的数据建模（server/routes/tasks.js）
任务用 `importance`、`urgency` 两个 0/1 字段存储，象限编号由两者组合计算：
`重要且紧急=1，重要不紧急=2，紧急不重要=3，都不=4`。
拖拽换象限时前端只需 `PUT /api/tasks/:id { quadrant: n }`，后端反推两个布尔值——**一个接口同时服务表单编辑和拖拽**。

### 2. 不漂移的番茄钟（public/js/pomodoro.js）
不用「每秒减 1」的写法（浏览器后台节流会让计时变慢），而是记录**结束时间戳**，
每次 tick 用 `endAt - Date.now()` 重算剩余秒数——切后台、合盖回来时间依然准确。

### 3. 安全设计
- 密码：`scrypt(密码, 16字节随机盐)`，登录校验用 `timingSafeEqual` 防时序攻击；
- 会话：`header.payload.HMAC-SHA256` 签名 token，服务端无状态、不可篡改；
- 越权：所有任务 SQL 都带 `user_id = ?` 条件，测试用例验证过 A 拿不到 B 的数据；
- 注入：全部使用 prepared statement 参数绑定；前端渲染统一 `esc()` 转义防 XSS；
- 限流：每 IP 每分钟 300 次 API 请求上限。

## 五、本地运行

```bash
node -v          # 需要 ≥ 22.5（推荐 24）
npm install
npm start        # http://localhost:3000
```

## 六、部署上线

见 [docs/DEPLOY.md](docs/DEPLOY.md)（Render 免费云服务，10 分钟完成）。

## 七、贡献度说明

本项目为单人项目：需求分析、数据库设计、前后端开发、测试、部署文档均由本人独立完成，贡献度 100%。
