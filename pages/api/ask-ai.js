import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "당신은 자산 관리 앱 '자산파일럿'의 금융 전문 AI 비서입니다. 답변은 핵심만 3줄 이내로 정갈하고 간결하게 하세요."
      }
    });

    return res.status(200).json({ answer: response.text });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'AI 요청 중 오류가 발생했습니다.' });
  }
}