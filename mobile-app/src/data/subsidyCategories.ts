// index.html의 SUPPORT_CATEGORY_META / 지역·직업 <select> 옵션을 그대로 이식.
export type SubsidyCategoryMeta = { label: string; color: string; bg: string };

export const SUPPORT_CATEGORY_META: Record<string, SubsidyCategoryMeta> = {
  '보육·교육': { label: '보육·교육', color: '#0891b2', bg: 'rgba(8,145,178,0.18)' },
  '주거·자립': { label: '주거·자립', color: '#059669', bg: 'rgba(5,150,105,0.18)' },
  '농림축산어업': { label: '농림축산어업', color: '#65a30d', bg: 'rgba(101,163,13,0.18)' },
  '행정·안전': { label: '행정·안전', color: '#64748b', bg: 'rgba(100,116,139,0.20)' },
  '문화·환경': { label: '문화·환경', color: '#7c3aed', bg: 'rgba(124,58,237,0.18)' },
  '보건·의료': { label: '보건·의료', color: '#e11d48', bg: 'rgba(225,29,72,0.18)' },
  '고용·창업': { label: '고용·창업', color: '#3182f6', bg: 'rgba(49,130,246,0.18)' },
  '생활안정': { label: '생활안정', color: '#db2777', bg: 'rgba(219,39,119,0.18)' },
};

export const SUBSIDY_CATEGORIES = Object.keys(SUPPORT_CATEGORY_META);

export const SUBSIDY_REGIONS = [
  '서울특별시', '경기도', '인천광역시', '부산광역시', '대구광역시', '광주광역시', '대전광역시',
  '울산광역시', '세종특별자치시', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도',
  '전라남도', '경상북도', '경상남도', '제주특별자치도',
];

export const SUBSIDY_EMPLOYMENT_OPTIONS = ['재직자', '자영업자', '프리랜서', '취준생', '대학생', '무직'];
