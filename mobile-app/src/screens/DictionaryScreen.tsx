import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreen from '../components/AppScreen';
import Card from '../components/ui/Card';
import Section from '../components/ui/Section';
import ListRow from '../components/ui/ListRow';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors, RADIUS } from '../constants/theme';
import { DICTIONARY_TERMS, DictionaryTerm, getTodayTerm } from '../data/dictionaryTerms';

export default function DictionaryScreen() {
  const { colors, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, radius, insets.bottom), [colors, radius, insets.bottom]);
  const todayTerm = useMemo(() => getTodayTerm(), []);
  const [selected, setSelected] = useState<DictionaryTerm | null>(null);

  return (
    <AppScreen>
      <FlatList
        data={DICTIONARY_TERMS}
        keyExtractor={(item) => item.term}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Section title="오늘의 용어">
              <Card>
                <Text style={styles.todayTerm}>{todayTerm.term}</Text>
                <Text style={styles.todayDef}>{todayTerm.def}</Text>
                <Text style={styles.todayExample}>{todayTerm.example}</Text>
              </Card>
            </Section>
            <Text style={styles.listTitle}>전체 용어 모아보기</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <ListRow
            label={item.term}
            showChevron
            last={index === DICTIONARY_TERMS.length - 1}
            onPress={() => setSelected(item)}
          />
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected ? (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{selected.term}</Text>
                  <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                    <Ionicons name="close-outline" size={24} color={colors.ink2} />
                  </Pressable>
                </View>
                <Text style={styles.sheetDef}>{selected.def}</Text>
                <Text style={styles.sheetExample}>{selected.example}</Text>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, bottomInset: number) {
  return StyleSheet.create({
    content: { padding: 16 },
    todayTerm: { fontSize: 18, fontWeight: '800', color: colors.brand, marginBottom: 8 },
    todayDef: { fontSize: 14, color: colors.ink1, lineHeight: 20, marginBottom: 8 },
    todayExample: { fontSize: 13, color: colors.ink3, lineHeight: 19 },
    listTitle: { fontSize: 13, fontWeight: '700', color: colors.ink3, marginBottom: 4, paddingHorizontal: 4 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: 24,
      paddingBottom: Math.max(40, bottomInset + 24),
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink1 },
    sheetDef: { fontSize: 14.5, color: colors.ink1, lineHeight: 22, marginBottom: 12 },
    sheetExample: { fontSize: 13.5, color: colors.ink3, lineHeight: 20 },
  });
}
