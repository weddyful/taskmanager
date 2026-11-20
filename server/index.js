import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(port, () => {
  const mode = process.env.SUPABASE_URL ? 'Supabase 云端数据库' : '本地演示存储 data/tasks.json';
  console.log(`✅ 任务管理系统已启动: http://localhost:${port}  (数据源: ${mode})`);
});
