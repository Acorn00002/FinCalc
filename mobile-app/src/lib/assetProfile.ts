import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgeBracketId } from './calc/netWorthBenchmark';

const STORAGE_KEY = 'assetpilot_asset_profile';

export type AssetProfile = {
  ageBracket: AgeBracketId;
  totalAssets: number;
  totalDebt: number;
};

// 자산 비교/점수 카드 전용의 가벼운 자기입력값이라, 로그인 계정과 무관하게 기기에만 저장한다
// (users/{uid} Firestore 스키마에 이 필드가 없고, 로그인 없이도 이 기능을 써볼 수 있어야 한다).
export async function getAssetProfile(): Promise<AssetProfile | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssetProfile;
  } catch {
    return null;
  }
}

export async function saveAssetProfile(profile: AssetProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
