// 统一的数据层入口：
// 1) 检测到 SUPABASE_URL + SUPABASE_ANON_KEY → 走 Supabase 云端数据库
// 2) 本地开发且没配环境变量 → 退化成本地 JSON 文件存储，方便先看效果
// 3) 线上（Vercel）却没配环境变量 → 直接报错提示，绝不静默丢数据

import { createSupabaseStore } from './supabase.js';
import { createLocalStore } from './local.js';

export function getStore() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (url && key) {
    return createSupabaseStore({ url, key });
  }

  if (process.env.VERCEL) {
    return null; // 交给上层返回 503 + 明确提示
  }

  return createLocalStore();
}

export function describeConfig() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();
  return {
    supabaseUrl: url ? url.replace(/\/\/[^.]+/, '//') : '',
    urlLooksValid: /^https:\/\/[a-z0-9-]+\.supabase\.(co|com)$/i.test(url),
    keyPresent: Boolean(key),
    keyPrefixValid: key ? /^sb_publishable_/.test(key) || /^eyJ/.test(key) : false
  };
}
