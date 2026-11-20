# 智能任务管理系统

Node.js（Express 后端） + React（Vite 前端） + Supabase（PostgreSQL 云数据库），一条命令本地跑起来，推到 GitHub 后可直接在 Vercel 部署上线。

## 功能

- 输入框 + 优先级下拉（高 / 中 / 低）添加任务
- 任务列表按创建时间倒序显示（最新在最上面）
- 每条任务显示标题、优先级标签、完成状态、创建时间
- 一键切换「完成 / 未完成」，已完成任务自动加删除线、颜色变淡
- 一键删除任务（带二次确认）
- 顶部按优先级筛选：全部 / 高 / 中 / 低，每个筛选标签带数量
- 顶部实时统计：共 N 条 · 已完成 M 条 · 待办 K 条
- 数据写入 Supabase 云端数据库，换浏览器、关电脑都不会丢
- 页面右上角显示当前数据源状态（Supabase 已连接 / 本地演示存储）

## 技术架构

```
浏览器 (React SPA)
   │  fetch /api/tasks
   ▼
Node.js / Express（server/app.js，本地与 Vercel Serverless 共用同一份代码）
   │  @supabase/supabase-js  →  Supabase REST API
   ▼
Supabase PostgreSQL   tasks 表（id / title / priority / completed / created_at）
```

- 前端只通过 `/api` 访问后端，不直接写数据库逻辑
- 同一份 Express 应用既能在本地 `node server/index.js` 启动，也能作为 Vercel Function（`api/index.js`）运行
- 未配置 Supabase 时自动退化为本地 JSON 存储（`data/tasks.json`），方便先看效果；线上缺配置会明确报错，不会静默丢数据

## 目录结构

```
task-manager/
├── api/index.js            Vercel Serverless 入口（复用 server/app.js）
├── server/
│   ├── app.js              Express 应用：REST 接口 + 静态托管 + 统一错误处理
│   ├── index.js            本地启动入口（npm start）
│   └── db/
│       ├── index.js        数据层选择：Supabase / 本地演示
│       ├── supabase.js     Supabase 适配器（含中文报错翻译）
│       └── local.js        本地 JSON 存储（仅开发用）
├── src/
│   ├── App.jsx             页面与交互
│   ├── main.jsx            React 入口
│   └── styles.css          样式
├── supabase/setup.sql      建表 + RLS 策略，一键在 SQL Editor 执行
├── index.html
├── vite.config.js
├── vercel.json
├── .env.example
└── .gitignore
```

## 本地运行

```bash
npm install
cp .env.example .env        # 填入自己的 SUPABASE_URL / SUPABASE_ANON_KEY
npm run build               # 构建前端到 dist/
npm start                   # 启动 http://localhost:3000
```

开发模式（前端热更新）：

```bash
npm run server              # 终端 1：后端 3000
npm run dev                 # 终端 2：前端 5173，/api 自动代理到 3000
```

打开 <http://localhost:3000> 或 <http://localhost:5173> 即可。

## Supabase 配置

1. 在 [supabase.com](https://supabase.com) 新建项目，Region 选 Southeast Asia (Singapore)
2. 打开 SQL Editor → New query，粘贴 `supabase/setup.sql` 全部内容 → Run
3. Project Settings → API Keys 复制两样东西：
   - Project URL：`https://xxxxx.supabase.co`
   - Publishable key：`sb_publishable_...`（**不要**用 `sb_secret_...` 保密密钥）
4. 写进 `.env`

`setup.sql` 做的事：建 `tasks` 表、按 `created_at` 建索引、开启 RLS、创建四条匿名读写策略。教学演示用「任何人可读写」，正式项目请改成「登录用户只能操作自己的数据」。

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，返回当前数据源（supabase / local） |
| GET | `/api/tasks?priority=高` | 任务列表，`priority` 可选 |
| POST | `/api/tasks` | 新增，body：`{ "title": "...", "priority": "高" }` |
| PATCH | `/api/tasks/:id` | 更新，body：`{ "completed": true }` |
| DELETE | `/api/tasks/:id` | 删除 |

返回出错时会带 `error`（中文说明）和 `hint`（该去哪一步修），前端直接展示在页面顶部。

## 部署到 Vercel

1. Vercel → Add New → Project → 选择本仓库 → Import
2. 环境变量（Settings → Environment Variables，Production / Preview / Development 全勾）：
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `sb_publishable_...`
   - `NODE_ENV` = `production`
3. Framework 会自动识别为 Vite，Build Command `npm run build`，Output `dist`
4. Deploy，1～3 分钟拿到 `https://xxx.vercel.app`
5. 打开网址加一条任务，回 Supabase Table Editor 能看到新行，说明全链路通

## 绑定自己的域名

Vercel → 项目 → Settings → Domains → Add，输入 `姓名拼音+序号.rangzijigenghao.online`（例如 `mayuhui01.rangzijigenghao.online`），Vercel 会给出两条要添加的解析记录：

| 类型 | 主机记录 | 值 |
| --- | --- | --- |
| CNAME | 你的子域名前缀 | `cname.vercel-dns.com` |
| TXT | `_vercel` | `vc-domain-verify=...`（Vercel 页面上复制原值） |

两条都添加后回 Vercel 点 Refresh，状态变成 Valid Configuration 即生效（DNS 生效一般 1～10 分钟）。

## 上线前检查清单

- [ ] 页面能添加、完成、删除、按优先级筛选
- [ ] Supabase Table Editor 里能看到 `tasks` 表和新数据
- [ ] 仓库里没有 `.env`（`.gitignore` 已忽略）
- [ ] Vercel 环境变量名称完全一致：`SUPABASE_URL`、`SUPABASE_ANON_KEY`
- [ ] `.vercel.app` 网址可打开，加任务后 Supabase 能看到
- [ ] 关掉浏览器重开，数据还在
- [ ] 自定义域名 Valid Configuration 且能访问

## 常见问题

**添加任务报 `new row violates row-level security policy`**
RLS 策略没开全。重跑 `supabase/setup.sql` 里四条 `create policy`。

**报错 `relation tasks does not exist`**
表没建成功，重跑建表 SQL。

**Vercel 打开报 503 / 服务未配置数据库**
环境变量没配或名字拼错，补上后在 Deployments 里 Redeploy。

**Vercel 上数据为空，本地却有数据**
两边连的不是同一个项目，核对 `SUPABASE_URL` 的项目 ID。

**`git push` 提示 Permission denied**
改用 PAT（Personal Access Token）走 HTTPS，或配置 SSH key；GitHub 已不支持账号密码推送。

**密钥误传到仓库**
立刻去 Supabase 轮换 key，删掉仓库里的 `.env` 并重新提交。
