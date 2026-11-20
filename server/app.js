import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { getStore, describeConfig } from './db/index.js';

const PRIORITIES = ['高', '中', '低'];

function normalizeTitle(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 160);
}

function normalizePriority(value) {
  const p = typeof value === 'string' ? value.trim() : '';
  return PRIORITIES.includes(p) ? p : '中';
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 健康检查：一眼看出当前连的是 Supabase 还是本地演示存储
  app.get('/api/health', (req, res) => {
    const store = getStore();
    res.json({
      ok: Boolean(store),
      mode: store ? store.mode : 'unconfigured',
      label: store ? store.label : '未配置 Supabase 环境变量',
      config: describeConfig(),
      time: new Date().toISOString()
    });
  });

  const requireStore = (req, res, next) => {
    const store = getStore();
    if (!store) {
      return res.status(503).json({
        error: '服务未配置数据库',
        hint: '请在 Vercel 项目 Settings → Environment Variables 里添加 SUPABASE_URL 和 SUPABASE_ANON_KEY，然后 Redeploy',
        code: 'NO_DB_CONFIG'
      });
    }
    req.store = store;
    next();
  };

  // 列表（支持 ?priority=高/中/低 筛选）
  app.get('/api/tasks', requireStore, async (req, res, next) => {
    try {
      const priority = PRIORITIES.includes(req.query.priority) ? req.query.priority : '';
      const tasks = await req.store.list(priority);
      res.json({ tasks });
    } catch (err) {
      next(err);
    }
  });

  // 新增
  app.post('/api/tasks', requireStore, async (req, res, next) => {
    try {
      const title = normalizeTitle(req.body?.title);
      if (!title) {
        return res.status(400).json({ error: '任务标题不能为空', code: 'EMPTY_TITLE' });
      }
      const task = await req.store.create({ title, priority: normalizePriority(req.body?.priority) });
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  });

  // 切换完成状态 / 修改标题、优先级
  app.patch('/api/tasks/:id', requireStore, async (req, res, next) => {
    try {
      const id = req.params.id;
      const patch = {};
      if (typeof req.body?.completed === 'boolean') patch.completed = req.body.completed;
      if (typeof req.body?.title === 'string') {
        const title = normalizeTitle(req.body.title);
        if (!title) return res.status(400).json({ error: '任务标题不能为空', code: 'EMPTY_TITLE' });
        patch.title = title;
      }
      if (req.body?.priority !== undefined) patch.priority = normalizePriority(req.body.priority);
      if (!Object.keys(patch).length) {
        return res.status(400).json({ error: '没有可更新的字段', code: 'EMPTY_PATCH' });
      }
      const task = await req.store.update(id, patch);
      if (!task) return res.status(404).json({ error: '任务不存在', code: 'NOT_FOUND' });
      res.json({ task });
    } catch (err) {
      next(err);
    }
  });

  // 删除
  app.delete('/api/tasks/:id', requireStore, async (req, res, next) => {
    try {
      await req.store.remove(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // 生产环境（本地 npm start）同时托管前端构建产物
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在', code: 'NO_ROUTE' }));

  // 统一错误出口：把数据层的友好提示原样返回给前端
  app.use((err, req, res, next) => {
    const status = err.code === 'RLS_BLOCKED' ? 409 : 500;
    res.status(status).json({
      error: err.message || '服务器内部错误',
      hint: err.hint || '',
      code: err.code || 'INTERNAL'
    });
  });

  return app;
}
