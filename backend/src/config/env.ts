import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다. backend/.env를 확인하세요.`);
  return value;
}

export const env = {
  fssApiKey: required('FSS_API_KEY'),
  port: Number(process.env.PORT) || 4100,
};
