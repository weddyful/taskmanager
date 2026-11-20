import { createClient } from '@supabase/supabase-js';

// 把 Supabase / PostgREST 的英文报错翻译成学生看得懂的中文提示
function translate(error) {
  const msg = error?.message || 'Unknown error';
  if (/row-level security|RLS/i.test(msg)) {
    return {
      message: '数据库拒绝了这次写入（RLS 行级安全策略没开全）',
      hint: '去 Supabase → SQL Editor 重新执行 4.3 节的 4 条 create policy 语句',
      code: 'RLS_BLOCKED'
    };
  }
  if (/relation .*tasks.* does not exist/i.test(msg)) {
    return {
      message: 'tasks 表不存在',
      hint: '去 Supabase → SQL Editor 执行 4.2 节建表 SQL',
      code: 'TABLE_MISSING'
    };
  }
  if (/invalid api key|Invalid API key|JWT/i.test(msg)) {
    return {
      message: 'Supabase 密钥无效',
      hint: '检查 SUPABASE_ANON_KEY 是否为 sb_publishable_ 开头的最新 key，不要用 sb_secret_ 开头的密钥',
      code: 'BAD_KEY'
    };
  }
  if (/fetch failed|ENOTFOUND|network/i.test(msg)) {
    return {
      message: '连不上 Supabase',
      hint: '检查 SUPABASE_URL 是否写成 https://<项目ID>.supabase.co，以及网络是否可访问',
      code: 'NETWORK'
    };
  }
  return { message: msg, hint: error?.hint || '', code: error?.code || 'SUPABASE_ERROR' };
}

export function createSupabaseStore({ url, key }) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'task-manager' } }
  });

  return {
    mode: 'supabase',
    label: 'Supabase 云端数据库',
    async list(priority) {
      let query = client.from('tasks').select('*').order('created_at', { ascending: false });
      if (priority) query = query.eq('priority', priority);
      const { data, error } = await query;
      if (error) throw translate(error);
      return data || [];
    },
    async create({ title, priority }) {
      const { data, error } = await client
        .from('tasks')
        .insert({ title, priority })
        .select()
        .single();
      if (error) throw translate(error);
      return data;
    },
    async update(id, patch) {
      const { data, error } = await client
        .from('tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw translate(error);
      return data;
    },
    async remove(id) {
      const { error } = await client.from('tasks').delete().eq('id', id);
      if (error) throw translate(error);
    }
  };
}
