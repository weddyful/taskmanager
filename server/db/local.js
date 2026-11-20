// 本地演示存储：没有配置 Supabase 时使用，数据写入 data/tasks.json
// 目的只有一个——先让你在本地把界面和功能跑通；部署上线前务必换成 Supabase
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'tasks.json');

function readAll() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

export function createLocalStore() {
  return {
    mode: 'local',
    label: '本地演示存储（data/tasks.json）',
    async list(priority) {
      const rows = readAll()
        .filter((t) => (priority ? t.priority === priority : true))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return rows;
    },
    async create({ title, priority }) {
      const rows = readAll();
      const row = {
        id: rows.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1,
        title,
        priority: priority || '中',
        completed: false,
        created_at: new Date().toISOString()
      };
      rows.push(row);
      writeAll(rows);
      return row;
    },
    async update(id, patch) {
      const rows = readAll();
      const target = rows.find((t) => Number(t.id) === Number(id));
      if (!target) return null;
      Object.assign(target, patch);
      writeAll(rows);
      return target;
    },
    async remove(id) {
      const rows = readAll().filter((t) => Number(t.id) !== Number(id));
      writeAll(rows);
    }
  };
}
