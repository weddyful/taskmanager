// Vercel Serverless 入口：所有 /api/* 请求都由这个函数处理
import { createApp } from '../server/app.js';

const app = createApp();

export default app;
