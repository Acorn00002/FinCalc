// index.html의 parseNewsPageXml()/splitNewsPageTitle()/formatNewsPageTime()를 그대로 이식.
// RN(Hermes)에는 DOMParser가 없어서 정규식으로 RSS <item> 블록을 직접 파싱한다 —
// /api/news(Google 뉴스 경제 토픽 RSS 프록시, functions/index.js의 newsProxy와 동일)는 신뢰 가능한
// 고정 소스라 정규식 파싱으로 충분하다.
export type NewsItem = { title: string; source: string; time: string; link: string };

// index.html의 #view-news 카테고리 탭(헤드라인/경제/세계/시사/생활)과 1:1 매핑 — 서버 쪽 화이트리스트는
// functions/index.js·api/news.js의 NEWS_CATEGORY_URLS를 참고. 값이 없거나 목록에 없으면 서버가 경제로 기본 처리한다.
export type NewsCategory = 'headline' | 'economy' | 'world' | 'society' | 'life';

export const NEWS_CATEGORIES: { key: NewsCategory; label: string }[] = [
  { key: 'headline', label: '헤드라인' },
  { key: 'economy', label: '경제' },
  { key: 'world', label: '세계' },
  { key: 'society', label: '시사' },
  { key: 'life', label: '생활' },
];

// gofincalc.com(www 없음)은 308로 www.gofincalc.com에 리다이렉트되는데, RN fetch 폴리필이 리다이렉트를
// 안정적으로 따라가지 않는 경우가 있어 처음부터 canonical(www) URL을 직접 호출한다.
const NEWS_API_URL = 'https://www.gofincalc.com/api/news';

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(block);
  if (!m) return '';
  let val = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(val);
  if (cdata) val = cdata[1].trim();
  return val;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function splitNewsTitle(rawTitle: string, sourceText: string): { title: string; source: string } {
  let title = rawTitle || '';
  const source = (sourceText || '').trim();
  if (source) {
    const suffix = ' - ' + source;
    if (title.length > suffix.length && title.slice(-suffix.length) === suffix) {
      title = title.slice(0, -suffix.length);
    }
    return { title: title.trim(), source };
  }
  const idx = title.lastIndexOf(' - ');
  if (idx > -1) return { title: title.slice(0, idx).trim(), source: title.slice(idx + 3).trim() };
  return { title: title.trim(), source: '' };
}

function formatNewsTime(pubDateStr: string): string {
  if (!pubDateStr) return '';
  const parsed = new Date(pubDateStr);
  if (isNaN(parsed.getTime())) return '';
  const diffMin = Math.floor((Date.now() - parsed.getTime()) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

export async function fetchNewsItems(category?: NewsCategory): Promise<NewsItem[]> {
  const url = category ? `${NEWS_API_URL}?category=${encodeURIComponent(category)}` : NEWS_API_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`news fetch failed: ${res.status}`);
  const xml = await res.text();
  const items: NewsItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const rawTitle = decodeEntities(extractTag(block, 'title'));
    if (!rawTitle) continue;
    const link = decodeEntities(extractTag(block, 'link'));
    const pubDate = extractTag(block, 'pubDate');
    const sourceRaw = decodeEntities(extractTag(block, 'source'));
    const { title, source } = splitNewsTitle(rawTitle, sourceRaw);
    items.push({ title, source, time: formatNewsTime(pubDate), link });
  }
  return items;
}
