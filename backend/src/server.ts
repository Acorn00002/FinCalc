import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { savingsRouter } from './routes/savings.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/savings', savingsRouter);

app.listen(env.port, () => {
  console.log(`[server] http://localhost:${env.port} 에서 대기 중`);
  console.log(`[server] GET http://localhost:${env.port}/api/v1/savings`);
});
