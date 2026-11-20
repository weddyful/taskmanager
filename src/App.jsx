import { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';

const PRIORITIES = ['高', '中', '低'];
const FILTERS = ['全部', '高', '中', '低'];

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `请求失败（HTTP ${res.status}）`);
    error.hint = data.hint || '';
    throw error;
  }
  return data;
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('中');
  const [filter, setFilter] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/api/tasks');
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      setError({ message: err.message, hint: err.hint });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    request('/api/health')
      .then(setHealth)
      .catch(() => setHealth({ ok: false, mode: 'unreachable', label: '后端未启动或接口不可用' }));
    loadTasks();
  }, [loadTasks]);

  const visibleTasks = useMemo(
    () => (filter === '全部' ? tasks : tasks.filter((t) => t.priority === filter)),
    [tasks, filter]
  );

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.completed).length;
    return { total: tasks.length, done, pending: tasks.length - done };
  }, [tasks]);

  const filteredStats = useMemo(() => {
    const done = visibleTasks.filter((t) => t.completed).length;
    return { total: visibleTasks.length, done };
  }, [visibleTasks]);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      const data = await request('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: trimmed, priority })
      });
      setTasks((prev) => [data.task, ...prev]);
      setTitle('');
      setError(null);
    } catch (err) {
      setError({ message: err.message, hint: err.hint });
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(task) {
    if (busyId) return;
    setBusyId(task.id);
    try {
      const data = await request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed })
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
      setError(null);
    } catch (err) {
      setError({ message: err.message, hint: err.hint });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(task) {
    if (busyId) return;
    if (!window.confirm(`确定删除「${task.title}」吗？`)) return;
    setBusyId(task.id);
    try {
      await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setError(null);
    } catch (err) {
      setError({ message: err.message, hint: err.hint });
    } finally {
      setBusyId(null);
    }
  }

  const dbChip = health?.mode === 'supabase'
    ? { text: 'Supabase 云端数据库', tone: 'ok' }
    : health?.mode === 'local'
      ? { text: '本地演示存储（未接 Supabase）', tone: 'warn' }
      : { text: health?.label || '数据库状态未知', tone: 'bad' };

  return (
    <div className="page">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <main className="app">
        <header className="header">
          <div>
            <h1>智能任务管理系统</h1>
            <p className="subtitle">加任务、定优先级、随手打勾，数据存在云端数据库</p>
          </div>
          <span className={`db-chip ${dbChip.tone}`}>
            <i className="dot" />
            {dbChip.text}
          </span>
        </header>

        <form className="composer" onSubmit={handleAdd}>
          <input
            className="input"
            value={title}
            maxLength={160}
            placeholder="要做什么？例如：复习线性代数第三章"
            onChange={(e) => setTitle(e.target.value)}
            aria-label="任务标题"
          />
          <select
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="优先级"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{`${p}优先级`}</option>
            ))}
          </select>
          <button className="btn primary" type="submit" disabled={adding || !title.trim()}>
            {adding ? '添加中…' : '添加'}
          </button>
        </form>

        <div className="toolbar">
          <div className="filters" role="tablist" aria-label="按优先级筛选">
            {FILTERS.map((f) => {
              const count = f === '全部' ? stats.total : tasks.filter((t) => t.priority === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={`pill ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                  <span className="count">{count}</span>
                </button>
              );
            })}
          </div>
          <p className="stats">
            共 {stats.total} 条 · 已完成 {stats.done} 条 · 待办 {stats.pending} 条
          </p>
        </div>

        {error && (
          <div className="alert" role="alert">
            <strong>{error.message}</strong>
            {error.hint && <span>{error.hint}</span>}
            <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {loading ? (
          <div className="state">加载中…</div>
        ) : visibleTasks.length === 0 ? (
          <div className="state empty">
            <div className="empty-emoji">🗂️</div>
            <p>{filter === '全部' ? '还没有任务，先在上面加一条吧。' : `当前没有「${filter}」优先级的任务。`}</p>
          </div>
        ) : (
          <ul className="list">
            {visibleTasks.map((task) => (
              <li key={task.id} className={`task ${task.completed ? 'done' : ''}`}>
                <button
                  type="button"
                  className={`check ${task.completed ? 'checked' : ''}`}
                  onClick={() => handleToggle(task)}
                  disabled={busyId === task.id}
                  title={task.completed ? '标记为未完成' : '标记为已完成'}
                  aria-label={task.completed ? '标记为未完成' : '标记为已完成'}
                >
                  {task.completed ? '✓' : ''}
                </button>

                <div className="task-main">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    <span className={`tag p-${PRIORITIES.indexOf(task.priority)}`}>{task.priority}</span>
                    <span className={`status ${task.completed ? 'is-done' : ''}`}>
                      {task.completed ? '已完成' : '未完成'}
                    </span>
                    <span className="time">{formatTime(task.created_at)}</span>
                  </div>
                </div>

                <div className="task-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => handleToggle(task)}
                    disabled={busyId === task.id}
                  >
                    {task.completed ? '撤销完成' : '完成'}
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => handleDelete(task)}
                    disabled={busyId === task.id}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="footer">
          <span>
            当前筛选：{filter === '全部' ? '全部' : `${filter}优先级`} · 显示 {filteredStats.total} 条，已完成 {filteredStats.done} 条
          </span>
          <button type="button" className="link" onClick={loadTasks}>刷新</button>
        </footer>
      </main>
    </div>
  );
}
