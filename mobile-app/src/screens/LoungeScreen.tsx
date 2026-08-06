import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  addFirestoreDocument,
  commitFieldTransforms,
  runFirestoreQuery,
  updateFirestoreDocument,
} from '../lib/firestoreRest';
import { LOUNGE_CATEGORIES, LOUNGE_CATEGORY_LABELS, LoungeCategory, formatRelativeTime, getTierInfo } from '../data/loungeCategories';
import type { ThemeColors, RADIUS, SHADOW } from '../constants/theme';

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23e2e5ea'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23aab1bd'/%3E%3Cpath d='M32 40c-14 0-22 8-22 18v6h44v-6c0-10-8-18-22-18Z' fill='%23aab1bd'/%3E%3C/svg%3E";

type PollOption = { text: string; votes: number };
type Poll = { question: string; options: PollOption[]; votedUserIds: string[] };
type Post = {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  authorTier: string;
  title: string;
  content: string;
  category: string;
  postType: string;
  poll: Poll | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  likedUsers: string[];
};
type CommentItem = {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  authorTier: string;
  content: string;
  createdAt: string;
};

type FilterValue = 'all' | LoungeCategory;

// index.html의 #view-lounge(자산 라운지 커뮤니티)를 그대로 이식. Firestore REST는 실시간 구독
// (onSnapshot)이 없어서, 웹처럼 실시간 반영 대신 진입/새로고침 시점마다 다시 불러오는 방식으로
// 대체했다 — 좋아요/댓글수는 원자적 필드 변형(commitFieldTransforms)으로 동시 클릭에도 안전하다.
export default function LoungeScreen() {
  const { colors, radius, shadow } = useAppTheme();
  const { user, signInWithGoogle, getFreshIdToken } = useAuth();
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);

  const [filter, setFilter] = useState<FilterValue>('all');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);

  const loadPosts = useCallback(async () => {
    setError(false);
    try {
      const idToken = user ? await getFreshIdToken() : undefined;
      const rows = await runFirestoreQuery({
        collection: 'posts',
        whereEquals: filter === 'all' ? undefined : { field: 'category', value: filter },
        orderByField: 'createdAt',
        orderDirection: 'DESCENDING',
        idToken: idToken ?? undefined,
      });
      setPosts(rows as unknown as Post[]);
    } catch {
      setError(true);
    }
  }, [filter, user, getFreshIdToken]);

  useEffect(() => {
    setPosts(null);
    loadPosts();
  }, [loadPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  const requireLogin = useCallback(
    (action: () => void) => {
      if (!user) {
        Alert.alert('로그인이 필요해요', '로그인 후 이용 가능합니다.', [
          { text: '취소', style: 'cancel' },
          { text: '로그인', onPress: () => signInWithGoogle() },
        ]);
        return;
      }
      action();
    },
    [user, signInWithGoogle]
  );

  const toggleLike = useCallback(
    async (post: Post) => {
      if (!user) {
        requireLogin(() => {});
        return;
      }
      const idToken = await getFreshIdToken();
      if (!idToken) return;
      const alreadyLiked = post.likedUsers.includes(user.uid);
      // 낙관적 업데이트 — 서버 응답을 기다리지 않고 화면에 바로 반영한다.
      setPosts((prev) =>
        (prev ?? []).map((p) =>
          p.id === post.id
            ? {
                ...p,
                likesCount: p.likesCount + (alreadyLiked ? -1 : 1),
                likedUsers: alreadyLiked ? p.likedUsers.filter((u) => u !== user.uid) : [...p.likedUsers, user.uid],
              }
            : p
        )
      );
      if (detailPost?.id === post.id) {
        setDetailPost((p) =>
          p
            ? {
                ...p,
                likesCount: p.likesCount + (alreadyLiked ? -1 : 1),
                likedUsers: alreadyLiked ? p.likedUsers.filter((u) => u !== user.uid) : [...p.likedUsers, user.uid],
              }
            : p
        );
      }
      try {
        await commitFieldTransforms(
          `posts/${post.id}`,
          [
            { fieldPath: 'likesCount', increment: alreadyLiked ? -1 : 1 },
            alreadyLiked ? { fieldPath: 'likedUsers', removeFromArray: [user.uid] } : { fieldPath: 'likedUsers', appendToArray: [user.uid] },
          ],
          idToken
        );
      } catch {
        // 실패 시 다음 새로고침에서 서버 상태로 자연스럽게 정정된다.
      }
    },
    [user, getFreshIdToken, requireLogin, detailPost]
  );

  return (
    <AppScreen>
      <FlatList
        data={posts ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>실시간 커뮤니티</Text>
            <Text style={styles.pageTitle}>자산 라운지</Text>
            <Text style={styles.pageDesc}>구글 인증된 파일럿들과 자산 현황·절세 노하우를 실시간으로 나눠보세요.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              <Pressable style={[styles.pill, filter === 'all' && styles.pillActive]} onPress={() => setFilter('all')}>
                <Text style={[styles.pillText, filter === 'all' && styles.pillTextActive]}>전체</Text>
              </Pressable>
              {LOUNGE_CATEGORIES.map((c) => (
                <Pressable key={c.value} style={[styles.pill, filter === c.value && styles.pillActive]} onPress={() => setFilter(c.value)}>
                  <Text style={[styles.pillText, filter === c.value && styles.pillTextActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable style={styles.promptBar} onPress={() => requireLogin(() => setWriteOpen(true))}>
              <Ionicons name="pencil-outline" size={16} color={colors.ink3} />
              <Text style={styles.promptText}>금융 이야기를 나눠보세요. (글 작성 시 +200P)</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          posts === null && !error ? (
            <View style={styles.skelWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skelItem} />
              ))}
            </View>
          ) : error ? (
            <Text style={styles.empty}>게시글을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</Text>
          ) : (
            <Text style={styles.empty}>아직 이 카테고리에 글이 없어요. 첫 글을 남겨보세요!</Text>
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            colors={colors}
            styles={styles}
            myUid={user?.uid}
            onPress={() => setDetailPost(item)}
            onLike={() => toggleLike(item)}
          />
        )}
      />

      <Modal visible={!!detailPost} animationType="slide" onRequestClose={() => setDetailPost(null)}>
        {detailPost ? (
          <PostDetailScreen
            post={detailPost}
            myUid={user?.uid}
            colors={colors}
            radius={radius}
            shadow={shadow}
            onClose={() => setDetailPost(null)}
            onLike={() => toggleLike(detailPost)}
            requireLogin={requireLogin}
            getFreshIdToken={getFreshIdToken}
            myName={user?.displayName}
            myPhoto={user?.photoURL}
            onPostUpdated={(updated) => {
              setDetailPost(updated);
              setPosts((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)));
            }}
          />
        ) : null}
      </Modal>

      <Modal visible={writeOpen} animationType="slide" onRequestClose={() => setWriteOpen(false)}>
        <WriteScreen
          colors={colors}
          radius={radius}
          shadow={shadow}
          onClose={() => setWriteOpen(false)}
          onSubmitted={() => {
            setWriteOpen(false);
            loadPosts();
          }}
          getFreshIdToken={getFreshIdToken}
          uid={user?.uid}
          authorName={user?.displayName}
          authorPhoto={user?.photoURL}
        />
      </Modal>
    </AppScreen>
  );
}

function PostCard({
  post,
  colors,
  styles,
  myUid,
  onPress,
  onLike,
}: {
  post: Post;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  myUid?: string;
  onPress: () => void;
  onLike: () => void;
}) {
  const liked = !!(myUid && post.likedUsers.includes(myUid));
  const isPoll = post.postType === 'poll' && post.poll;
  const totalVotes = isPoll ? post.poll!.options.reduce((s, o) => s + o.votes, 0) : 0;
  const voted = !!(myUid && post.poll?.votedUserIds.includes(myUid));

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <Image source={{ uri: post.authorPhoto || DEFAULT_AVATAR }} style={styles.avatarWrap} />
        <View style={styles.authorCol}>
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.authorName || '익명'}
            </Text>
            {post.authorTier ? (
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{post.authorTier}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{LOUNGE_CATEGORY_LABELS[post.category] || post.category}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{post.title}</Text>

      {isPoll ? (
        <View style={styles.pollBlock}>
          {post.poll!.options.map((opt, i) => {
            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
            return (
              <View key={i} style={styles.pollOption}>
                {voted ? <View style={[styles.pollFill, { width: `${pct}%` }]} /> : null}
                <View style={styles.pollOptionRow}>
                  <Text style={styles.pollOptionLabel}>{opt.text}</Text>
                  {voted ? <Text style={styles.pollOptionPct}>{pct}%</Text> : null}
                </View>
              </View>
            );
          })}
          <Text style={styles.pollTotal}>
            총 {totalVotes}표 참여{voted ? '' : ' · 눌러서 투표하기'}
          </Text>
        </View>
      ) : (
        <Text style={styles.cardText} numberOfLines={4}>
          {post.content}
        </Text>
      )}

      <View style={styles.cardBottom}>
        <Pressable style={styles.likeBtn} onPress={onLike} hitSlop={8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? colors.loss : colors.ink3} />
          <Text style={styles.likeCount}>{post.likesCount || 0}</Text>
        </Pressable>
        <View style={styles.commentStat}>
          <Ionicons name="chatbubble-outline" size={15} color={colors.ink3} />
          <Text style={styles.likeCount}>{post.commentsCount || 0}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function PostDetailScreen({
  post,
  myUid,
  colors,
  radius,
  shadow,
  onClose,
  onLike,
  requireLogin,
  getFreshIdToken,
  onPostUpdated,
  myName,
  myPhoto,
}: {
  post: Post;
  myUid?: string;
  colors: ThemeColors;
  radius: typeof RADIUS;
  shadow: typeof SHADOW.light;
  onClose: () => void;
  onLike: () => void;
  requireLogin: (action: () => void) => void;
  getFreshIdToken: () => Promise<string | null>;
  myName?: string;
  myPhoto?: string;
  onPostUpdated: (post: Post) => void;
}) {
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);
  // 이 화면은 AppScreen 없이 Modal 위에 바로 그려지는 전체화면이라, 상태바/제스처 내비게이션 바
  // 안전영역을 직접 챙겨야 한다 — 안 그러면 상단 바가 상태바에 가리거나 댓글 입력창이 하단
  // 내비게이션 바와 겹친다.
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const liked = !!(myUid && post.likedUsers.includes(myUid));
  const isPoll = post.postType === 'poll' && post.poll;
  const totalVotes = isPoll ? post.poll!.options.reduce((s, o) => s + o.votes, 0) : 0;
  const voted = !!(myUid && post.poll?.votedUserIds.includes(myUid));

  const loadComments = useCallback(async () => {
    try {
      const rows = await runFirestoreQuery({
        collection: 'comments',
        whereEquals: { field: 'postId', value: post.id },
        orderByField: 'createdAt',
        orderDirection: 'ASCENDING',
      });
      setComments(rows as unknown as CommentItem[]);
    } catch {
      setComments([]);
    }
  }, [post.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submitVote = async (optionIndex: number) => {
    requireLogin(async () => {
      if (!post.poll || voted) return;
      const idToken = await getFreshIdToken();
      if (!idToken || !myUid) return;
      const nextOptions = post.poll.options.map((o, i) => (i === optionIndex ? { ...o, votes: o.votes + 1 } : o));
      const updated: Post = { ...post, poll: { ...post.poll, options: nextOptions, votedUserIds: [...post.poll.votedUserIds, myUid] } };
      onPostUpdated(updated);
      try {
        await updateFirestoreDocument(`posts/${post.id}`, { poll: updated.poll }, idToken);
      } catch {
        Alert.alert('투표 처리에 실패했어요', '다시 시도해주세요.');
      }
    });
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    requireLogin(async () => {
      const idToken = await getFreshIdToken();
      if (!idToken || !myUid) return;
      setSubmitting(true);
      try {
        await addFirestoreDocument(
          'comments',
          {
            postId: post.id,
            uid: myUid,
            authorName: myName || '익명 파일럿',
            authorPhoto: myPhoto || '',
            authorTier: '',
            content: text,
            createdAt: new Date().toISOString(),
          },
          idToken
        );
        await commitFieldTransforms(`posts/${post.id}`, [{ fieldPath: 'commentsCount', increment: 1 }], idToken);
        onPostUpdated({ ...post, commentsCount: post.commentsCount + 1 });
        setCommentText('');
        await loadComments();
      } catch {
        Alert.alert('댓글 등록에 실패했어요', '다시 시도해주세요.');
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <View style={[styles.detailScreen, { backgroundColor: colors.bg }]}>
      <View style={[styles.detailTopBar, { paddingTop: insets.top + 16 }]}>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{LOUNGE_CATEGORY_LABELS[post.category] || post.category}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close-outline" size={24} color={colors.ink2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.detailBody}>
        <View style={styles.authorNameRow}>
          <Text style={styles.authorName}>{post.authorName || '익명'}</Text>
          {post.authorTier ? (
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{post.authorTier}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
        <Text style={styles.detailTitle}>{post.title}</Text>

        {isPoll ? (
          <View style={styles.pollBlock}>
            {post.poll!.options.map((opt, i) => {
              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
              return (
                <Pressable key={i} style={styles.pollOption} onPress={() => submitVote(i)} disabled={voted}>
                  {voted ? <View style={[styles.pollFill, { width: `${pct}%` }]} /> : null}
                  <View style={styles.pollOptionRow}>
                    <Text style={styles.pollOptionLabel}>{opt.text}</Text>
                    {voted ? <Text style={styles.pollOptionPct}>{pct}%</Text> : null}
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.pollTotal}>
              총 {totalVotes}표 참여{voted ? '' : ' · 눌러서 투표하기'}
            </Text>
          </View>
        ) : post.content ? (
          <Text style={styles.detailContent}>{post.content}</Text>
        ) : null}

        <View style={styles.detailActionsRow}>
          <Pressable style={styles.likeBtn} onPress={onLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.loss : colors.ink3} />
            <Text style={styles.likeCount}>{post.likesCount || 0}</Text>
          </Pressable>
          <View style={styles.commentStat}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.ink3} />
            <Text style={styles.likeCount}>{post.commentsCount || 0}</Text>
          </View>
        </View>

        <View style={styles.commentListWrap}>
          {comments === null ? (
            <Text style={styles.empty}>댓글을 불러오는 중…</Text>
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>아직 댓글이 없어요. 첫 댓글을 남겨보세요!</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentItem}>
                <View style={styles.commentTopRow}>
                  <Text style={styles.commentName}>{c.authorName || '익명'}</Text>
                  <Text style={styles.commentTime}>{formatRelativeTime(c.createdAt)}</Text>
                </View>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.commentInputRow, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
        <TextInput
          style={styles.commentInput}
          placeholder="댓글을 남겨보세요"
          placeholderTextColor={colors.ink3}
          value={commentText}
          onChangeText={setCommentText}
        />
        <Pressable style={styles.commentSendBtn} onPress={submitComment} disabled={submitting}>
          <Text style={styles.commentSendBtnText}>등록</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WriteScreen({
  colors,
  radius,
  shadow,
  onClose,
  onSubmitted,
  getFreshIdToken,
  uid,
  authorName,
  authorPhoto,
}: {
  colors: ThemeColors;
  radius: typeof RADIUS;
  shadow: typeof SHADOW.light;
  onClose: () => void;
  onSubmitted: () => void;
  getFreshIdToken: () => Promise<string | null>;
  uid?: string;
  authorName?: string;
  authorPhoto?: string;
}) {
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<LoungeCategory>('stock');
  const [type, setType] = useState<'text' | 'poll'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!uid) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    let pollPayload: Poll | null = null;
    if (type === 'poll') {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) {
        Alert.alert('투표 선택지를 2개 이상 입력해주세요');
        return;
      }
      pollPayload = { question: trimmedTitle, options: cleaned.map((text) => ({ text, votes: 0 })), votedUserIds: [] };
    } else if (!content.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await getFreshIdToken();
      if (!idToken) throw new Error('no token');
      const tier = getTierInfo(0);
      await addFirestoreDocument(
        'posts',
        {
          uid,
          authorName: authorName || '익명 파일럿',
          authorPhoto: authorPhoto || '',
          authorTier: tier.label,
          title: trimmedTitle,
          content: type === 'poll' ? '' : content.trim(),
          category,
          postType: type,
          poll: pollPayload,
          createdAt: new Date().toISOString(),
          likesCount: 0,
          commentsCount: 0,
          likedUsers: [],
        },
        idToken
      );
      onSubmitted();
    } catch {
      Alert.alert('게시글 등록에 실패했어요', '다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.detailScreen, { backgroundColor: colors.bg }]}>
      <View style={[styles.detailTopBar, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.detailTitle}>글쓰기</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close-outline" size={24} color={colors.ink2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.detailBody, { paddingBottom: Math.max(40, insets.bottom + 24) }]}>
        <View style={styles.writeCatRow}>
          {LOUNGE_CATEGORIES.map((c) => (
            <Pressable
              key={c.value}
              style={[styles.pill, category === c.value && styles.pillActive]}
              onPress={() => setCategory(c.value)}
            >
              <Text style={[styles.pillText, category === c.value && styles.pillTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.writeTypeRow}>
          <Pressable style={[styles.typeBtn, type === 'text' && styles.typeBtnActive]} onPress={() => setType('text')}>
            <Text style={[styles.typeBtnText, type === 'text' && styles.typeBtnTextActive]}>일반 글</Text>
          </Pressable>
          <Pressable style={[styles.typeBtn, type === 'poll' && styles.typeBtnActive]} onPress={() => setType('poll')}>
            <Text style={[styles.typeBtnText, type === 'poll' && styles.typeBtnTextActive]}>투표</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.writeTitleInput}
          placeholder="제목(투표는 질문)을 입력해줘"
          placeholderTextColor={colors.ink3}
          value={title}
          onChangeText={setTitle}
          maxLength={60}
        />
        {type === 'text' ? (
          <TextInput
            style={styles.writeContentInput}
            placeholder="형들의 리얼한 자산 현황이나 절세 꿀팁을 공유해 줘 (글 작성 시 +200P)"
            placeholderTextColor={colors.ink3}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={1000}
          />
        ) : (
          <View>
            {options.map((opt, i) => (
              <TextInput
                key={i}
                style={styles.writeTitleInput}
                placeholder={`선택지 ${i + 1}`}
                placeholderTextColor={colors.ink3}
                value={opt}
                onChangeText={(v) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)))}
              />
            ))}
            <Pressable style={styles.addOptionBtn} onPress={() => setOptions((prev) => [...prev, ''])}>
              <Ionicons name="add-circle-outline" size={16} color={colors.brand} />
              <Text style={styles.addOptionBtnText}>선택지 추가하기</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.submitBtn} onPress={submit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '등록 중…' : '등록'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, shadow: typeof SHADOW.light) {
  return StyleSheet.create({
    content: { padding: 16 },
    eyebrow: { fontSize: 12.5, fontWeight: '700', color: colors.brand, marginBottom: 4 },
    pageTitle: { fontSize: 20, fontWeight: '800', color: colors.ink1, marginBottom: 4 },
    pageDesc: { fontSize: 13, color: colors.ink3, marginBottom: 16 },
    pillsRow: { gap: 8, paddingBottom: 14 },
    pill: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
    pillActive: { backgroundColor: colors.brand, shadowOpacity: 0 },
    pillText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
    pillTextActive: { color: '#fff' },
    promptBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
      ...shadow,
    },
    promptText: { fontSize: 13, color: colors.ink3 },
    skelWrap: { gap: 10 },
    skelItem: { height: 140, borderRadius: 16, backgroundColor: colors.cardSoft },
    empty: { textAlign: 'center', color: colors.ink3, fontSize: 13.5, marginTop: 24, paddingVertical: 12 },
    card: { backgroundColor: colors.card, borderRadius: radius.lg - 4, padding: 16, marginBottom: 12, ...shadow },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    avatarWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardSoft, marginRight: 10 },
    authorCol: { flex: 1 },
    authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    authorName: { fontSize: 13.5, fontWeight: '700', color: colors.ink1 },
    tierBadge: { backgroundColor: colors.cardSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    tierBadgeText: { fontSize: 10, fontWeight: '700', color: colors.ink3 },
    timeText: { fontSize: 11.5, color: colors.ink3, marginTop: 2 },
    catBadge: { backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
    catBadgeText: { fontSize: 11, fontWeight: '700', color: colors.brand },
    cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink1, marginBottom: 6 },
    cardText: { fontSize: 13.5, color: colors.ink2, lineHeight: 20 },
    cardBottom: { flexDirection: 'row', gap: 16, marginTop: 12 },
    likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    likeCount: { fontSize: 12.5, color: colors.ink3, fontWeight: '600' },
    commentStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    pollBlock: { marginTop: 4, marginBottom: 8, gap: 8 },
    pollOption: { borderRadius: 12, backgroundColor: colors.cardSoft, overflow: 'hidden', paddingVertical: 2 },
    pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.brandSoft },
    pollOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
    pollOptionLabel: { fontSize: 13, fontWeight: '600', color: colors.ink1 },
    pollOptionPct: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
    pollTotal: { fontSize: 11.5, color: colors.ink3, marginTop: 2 },
    detailScreen: { flex: 1 },
    detailTopBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 16,
    },
    detailBody: { padding: 20, paddingBottom: 40 },
    detailTitle: { fontSize: 18, fontWeight: '800', color: colors.ink1, marginTop: 12, marginBottom: 14 },
    detailContent: { fontSize: 14.5, color: colors.ink1, lineHeight: 22, marginBottom: 16 },
    detailActionsRow: { flexDirection: 'row', gap: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 16 },
    commentListWrap: { gap: 14 },
    commentItem: { gap: 4 },
    commentTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
    commentName: { fontSize: 13, fontWeight: '700', color: colors.ink1 },
    commentTime: { fontSize: 11, color: colors.ink3 },
    commentText: { fontSize: 13.5, color: colors.ink2, lineHeight: 19 },
    commentInputRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      alignItems: 'center',
    },
    commentInput: { flex: 1, backgroundColor: colors.cardSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13.5, color: colors.ink1 },
    commentSendBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
    commentSendBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    writeCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    writeTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cardSoft, alignItems: 'center' },
    typeBtnActive: { backgroundColor: colors.brand },
    typeBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
    typeBtnTextActive: { color: '#fff' },
    writeTitleInput: {
      backgroundColor: colors.cardSoft,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.ink1,
      marginBottom: 10,
    },
    writeContentInput: {
      backgroundColor: colors.cardSoft,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.ink1,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 10,
    },
    addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    addOptionBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
    submitBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    submitBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  });
}
