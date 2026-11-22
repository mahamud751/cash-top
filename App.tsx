import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet as S,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Chart, Icon, IconName, Mark, Orbit } from './src/Visuals';

type Entry = {
  id: number;
  kind: 'trade' | 'deposit' | 'withdraw';
  amount: number;
  stake: number;
  rate: number;
  status: string;
  time: number;
};
type Wallet = {
  events: Entry[];
  balance: number;
  deposit: number;
  profit: number;
  rate: number;
};
type Tab = 'Home' | 'Trade' | 'Activity' | 'Admin';
type Action = 'deposit' | 'withdraw' | 'trade';
let api = 'http://127.0.0.1:4100';
const ink = '#24222b',
  muted = '#716e79',
  purple = '#7952bd',
  lime = '#d9f88c';
const money = (p: number) =>
  '৳' +
  (Math.abs(p) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const pnl = (p: number) => (p < 0 ? '−' : '+') + money(p);
const rateText = (r: number) =>
  (r < 0 ? '−' : '+') + (Math.abs(r) / 100).toFixed(2) + '%';
const day = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const titles = {
  deposit: 'bKash deposit',
  withdraw: 'Withdrawal',
  trade: 'Demo trade',
};
const nav: Record<Tab, IconName> = {
  Home: 'home',
  Trade: 'trade',
  Activity: 'activity',
  Admin: 'admin',
};
async function request(
  route: string,
  body?: object,
  key = '',
): Promise<Wallet> {
  const options = {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': key },
    body: body ? JSON.stringify(body) : undefined,
  };
  let res;
  try {
    res = await fetch(api + route, options);
  } catch (e) {
    if (Platform.OS !== 'android' || body || api.includes('10.0.2.2')) throw e;
    const emulatorApi = 'http://10.0.2.2:4100';
    res = await fetch(emulatorApi + route, options);
    if (res.ok) api = emulatorApi;
  }
  const result = await res.json();
  if (!res.ok) throw Error(result.error);
  return result;
}
function Button({
  label,
  onPress,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={s.primary}
    >
      <Text style={s.primaryText}>{busy ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}
function Row({ e }: { e: Entry }) {
  const positive = e.kind !== 'withdraw' && e.amount >= 0;
  return (
    <View style={s.row}>
      <View style={[s.iconBox, s[e.kind]]}>
        <Icon name={e.kind} size={19} />
      </View>
      <View style={s.grow}>
        <Text style={s.bold}>{titles[e.kind]}</Text>
        <Text style={s.small}>
          {day(e.time)} · {e.status}
        </Text>
      </View>
      <Text style={[s.bold, positive && s.credit]}>
        {e.status === 'declined' ? '' : positive ? '+' : '−'}
        {money(e.amount)}
      </Text>
    </View>
  );
}
function Performance({ wallet }: { wallet: Wallet }) {
  const [days, range] = useState(7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days + 1 + i);
    return d.getTime();
  });
  const trades = wallet.events.filter(
    e => e.kind === 'trade' && e.time >= dates[0],
  );
  let total = 0;
  const values = dates.map((t, i) => {
    total += trades
      .filter(e => e.time >= t && e.time < (dates[i + 1] ?? Infinity))
      .reduce((n, e) => n + e.amount, 0);
    return total;
  });
  return (
    <View style={s.card}>
      <View style={s.between}>
        <Text style={s.bold}>Trading performance</Text>
        <View style={s.segment}>
          {[7, 30].map(d => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: d === days }}
              onPress={() => range(d)}
              style={[s.range, d === days && s.selected]}
            >
              <Text style={s.tiny}>{d}D</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={s.figure}>{pnl(total)}</Text>
      <Text style={s.small}>Net profit / loss</Text>
      <Chart
        values={values}
        labels={[day(dates[0]), day(dates[Math.floor(days / 2)]), 'Today']}
      />
    </View>
  );
}
function Dashboard() {
  const [tab, setTab] = useState<Tab>('Home'),
    [wallet, setWallet] = useState<Wallet | null>(null),
    [problem, setProblem] = useState(''),
    [refreshing, setRefresh] = useState(false),
    [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null),
    [amount, setAmount] = useState('500'),
    [key, setKey] = useState(''),
    [admin, setAdmin] = useState(false),
    [percent, setPercent] = useState(''),
    [filter, setFilter] = useState('All'),
    [hidden, hide] = useState(false),
    [error, setError] = useState('');
  const submission = useRef({ details: '', token: '' });
  const lock = useRef(false),
    epoch = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++epoch.current;
    setRefresh(true);
    try {
      const w = await request('/wallet');
      if (n === epoch.current) {
        setWallet(w);
        setProblem('');
      }
    } catch {
      if (n === epoch.current)
        setProblem(
          'Cannot reach the demo server. Start npm run server and retry.',
        );
    } finally {
      setRefresh(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  async function mutate(route: string, body: object, success: () => void) {
    if (lock.current) return;
    lock.current = true;
    epoch.current++;
    setBusy(true);
    setError('');
    try {
      const w = await request(
        route,
        body,
        route.startsWith('/admin/') ? key : '',
      );
      epoch.current++;
      setWallet(w);
      setProblem('');
      success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function open(a: Action) {
    setError('');
    submission.current.details = '';
    setAmount(a === 'deposit' ? '500' : '');
    setAction(a);
  }
  function submit() {
    if (!action || !wallet) return;
    const p = Math.round(Number(amount) * 100);
    if (
      !/^\d+(\.\d{1,2})?$/.test(amount) ||
      !Number.isSafeInteger(p) ||
      p <= 0
    ) {
      setError('Enter an amount greater than zero, with up to two decimals.');
      return;
    }
    const details = JSON.stringify([action, p, wallet.rate]);
    if (submission.current.details !== details) {
      submission.current = {
        details,
        token:
          Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      };
    }
    mutate(
      '/' + action,
      { amount: p, rate: wallet.rate, requestId: submission.current.token },
      () => {
        setAction(null);
        Alert.alert(
          action === 'withdraw'
            ? 'Withdrawal requested'
            : action === 'deposit'
            ? 'Demo deposit added'
            : 'Demo trade settled',
          action === 'withdraw'
            ? 'Your funds are reserved for admin review.'
            : 'Your wallet and activity are updated.',
        );
      },
    );
  }
  function move(t: Tab) {
    setTab(t);
    setError('');
  }
  const pending =
    wallet?.events.filter(
      e => e.kind === 'withdraw' && e.status === 'pending',
    ) || [];
  const err = error ? (
    <Text accessibilityRole="alert" style={s.error}>
      {error}
    </Text>
  ) : null;
  return (
    <SafeAreaView style={s.app}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <View style={s.brand}>
          <Mark />
          <Text style={s.logo}>Cash</Text>
        </View>
        <View style={s.demo}>
          <View style={s.dot} />
          <Text style={s.tiny}>Demo wallet</Text>
        </View>
      </View>
      <ScrollView
        key={tab}
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <Text style={s.title}>
          {tab === 'Home'
            ? 'Wallet overview'
            : tab === 'Trade'
            ? 'Trade desk'
            : tab === 'Activity'
            ? 'Wallet activity'
            : 'Admin console'}
        </Text>
        {problem ? (
          <View style={s.card}>
            <Text style={s.body}>{problem}</Text>
            <Button label="Retry" onPress={refresh} />
          </View>
        ) : null}
        {!wallet && !problem ? <ActivityIndicator color={purple} /> : null}
        {wallet && (
          <>
            {tab === 'Home' && (
              <>
                <View style={s.hero}>
                  <View pointerEvents="none" style={s.art}>
                    <Orbit />
                  </View>
                  <View style={s.heroLabel}>
                    <Text style={s.light}>Available balance</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Toggle balance visibility"
                      hitSlop={9}
                      onPress={() => hide(!hidden)}
                    >
                      <Icon name="eye" size={17} color="#ded8ed" />
                    </Pressable>
                  </View>
                  <Text
                    style={s.balance}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {hidden ? '••••••' : money(wallet.balance)}
                  </Text>
                  <View style={s.heroBottom}>
                    <View>
                      <Text style={s.light}>Total deposits</Text>
                      <Text style={s.heroValue}>
                        {hidden ? '••••' : money(wallet.deposit)}
                      </Text>
                    </View>
                    <View style={s.rule} />
                    <View>
                      <Text style={s.light}>Trading P/L</Text>
                      <Text style={[s.heroValue, { color: lime }]}>
                        {hidden ? '••••' : pnl(wallet.profit)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={s.actions}>
                  {(['deposit', 'withdraw', 'trade'] as const).map((a, i) => (
                    <Pressable
                      accessibilityRole="button"
                      key={a}
                      onPress={() => (a === 'trade' ? move('Trade') : open(a))}
                      style={[
                        s.quick,
                        {
                          backgroundColor: ['#e5f4c6', '#eae3f7', '#f5e8dd'][i],
                        },
                      ]}
                    >
                      <Icon name={a} />
                      <Text style={s.bold}>
                        {['Deposit', 'Withdraw', 'Trade'][i]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Performance wallet={wallet} />
                <View style={s.between}>
                  <Text style={s.section}>Recent activity</Text>
                  <Pressable onPress={() => move('Activity')}>
                    <Text style={s.link}>View all ›</Text>
                  </Pressable>
                </View>
                <View style={s.list}>
                  {wallet.events.slice(0, 3).map(e => (
                    <Row key={e.id} e={e} />
                  ))}
                </View>
              </>
            )}
            {tab === 'Trade' && (
              <>
                <View style={s.darkCard}>
                  <Text style={s.light}>Admin-set simulation rate</Text>
                  <Text style={s.balance}>{rateText(wallet.rate)}</Text>
                  <Text style={s.light}>
                    Each demo trade settles immediately at the displayed rate.
                  </Text>
                </View>
                <Performance wallet={wallet} />
                <Button
                  label="Place demo trade"
                  onPress={() => open('trade')}
                />
              </>
            )}
            {tab === 'Activity' && (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filters}
                >
                  {['All', 'Deposit', 'Trade', 'Withdraw'].map(f => (
                    <Pressable
                      key={f}
                      onPress={() => setFilter(f)}
                      style={[s.chip, filter === f && s.activeChip]}
                    >
                      <Text style={s.bold}>{f}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.list}>
                  {wallet.events
                    .filter(
                      e => filter === 'All' || e.kind === filter.toLowerCase(),
                    )
                    .map(e => (
                      <Row key={e.id} e={e} />
                    ))}
                  {!wallet.events.some(
                    e => filter === 'All' || e.kind === filter.toLowerCase(),
                  ) && <Text style={s.body}>No transactions yet.</Text>}
                </View>
              </>
            )}
            {tab === 'Admin' &&
              (!admin ? (
                <View style={s.card}>
                  <Icon name="admin" color={purple} size={30} />
                  <Text style={s.section}>Administrator access</Text>
                  <Text style={s.body}>
                    Use the admin key from the demo server to manage rates and
                    withdrawals.
                  </Text>
                  <TextInput
                    accessibilityLabel="Admin key"
                    placeholder="Admin key"
                    secureTextEntry
                    autoCapitalize="none"
                    value={key}
                    onChangeText={setKey}
                    style={s.input}
                  />
                  {err}
                  <Button
                    label="Unlock console"
                    busy={busy}
                    onPress={() =>
                      mutate('/admin/unlock', {}, () => {
                        setAdmin(true);
                        setPercent(String(wallet.rate / 100));
                      })
                    }
                  />
                </View>
              ) : (
                <>
                  <View style={s.card}>
                    <View style={s.between}>
                      <Text style={s.section}>Trade return</Text>
                      <Pressable
                        onPress={() => {
                          setAdmin(false);
                          setKey('');
                        }}
                      >
                        <Text style={s.link}>Lock console</Text>
                      </Pressable>
                    </View>
                    <Text style={s.body}>
                      Current rate {rateText(wallet.rate)}. Enter a positive
                      percentage for profit or a negative percentage for loss.
                    </Text>
                    <TextInput
                      accessibilityLabel="Trade return percentage"
                      style={s.input}
                      value={percent}
                      onChangeText={setPercent}
                      placeholder="e.g. −5"
                    />
                    <Button
                      label="Save rate"
                      busy={busy}
                      onPress={() => {
                        if (!/^[+-]?\d+(\.\d{1,2})?$/.test(percent.trim()))
                          return setError(
                            'Enter a signed rate with up to two decimals.',
                          );
                        mutate(
                          '/admin/rate',
                          { rate: Math.round(Number(percent) * 100) },
                          () => Alert.alert('Demo rate updated'),
                        );
                      }}
                    />
                    {err}
                  </View>
                  <Text style={s.section}>
                    Withdrawal requests · {pending.length}
                  </Text>
                  {pending.length === 0 ? (
                    <Text style={s.body}>No requests awaiting review.</Text>
                  ) : (
                    pending.map(e => (
                      <View style={s.card} key={e.id}>
                        <Row e={e} />
                        <View style={s.actions}>
                          {(['approved', 'declined'] as const).map(status => (
                            <Pressable
                              key={status}
                              disabled={busy}
                              style={s.chip}
                              onPress={() =>
                                mutate(
                                  '/admin/review',
                                  { id: e.id, status },
                                  () => {},
                                )
                              }
                            >
                              <Text style={s.bold}>
                                {status === 'approved' ? 'Approve' : 'Decline'}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </>
              ))}
          </>
        )}
      </ScrollView>
      <View style={s.nav}>
        {(Object.keys(nav) as Tab[]).map(t => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => move(t)}
            style={s.navItem}
          >
            <View style={[s.navIcon, tab === t && s.activeChip]}>
              <Icon
                name={nav[t]}
                color={tab === t ? purple : muted}
                size={20}
              />
            </View>
            <Text style={[s.tiny, { color: tab === t ? purple : muted }]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={action !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setAction(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.overlay}
        >
          <SafeAreaView edges={['bottom']} style={s.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.between}>
                <Text style={s.section}>{action ? titles[action] : ''}</Text>
                <Pressable
                  accessibilityLabel="Close"
                  disabled={busy}
                  onPress={() => setAction(null)}
                >
                  <Icon name="close" />
                </Pressable>
              </View>
              <Text style={s.sheetNote}>
                {action === 'deposit'
                  ? 'Choose a simulated bKash top-up. No payment is collected.'
                  : action === 'trade'
                  ? 'Your demo trade uses the admin-set return shown below.'
                  : 'Funds are held until the admin reviews your demo request.'}
              </Text>
              {action === 'deposit' ? (
                <View style={s.filters}>
                  {[500, 1000, 2000, 3000].map(n => (
                    <Pressable
                      key={n}
                      onPress={() => setAmount(String(n))}
                      style={[s.preset, amount === String(n) && s.activeChip]}
                    >
                      <Text style={s.bold}>৳{n}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <>
                  <Text style={s.bold}>Amount in BDT</Text>
                  <TextInput
                    accessibilityLabel="Amount in taka"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    style={s.input}
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <Text style={s.small}>
                    Available {money(wallet?.balance || 0)}
                  </Text>
                </>
              )}
              {action === 'trade' && wallet && (
                <Text style={s.sheetNote}>
                  Return {rateText(wallet.rate)} · Estimated P/L{' '}
                  {pnl(
                    Math.sign(wallet.rate) *
                      Math.round(
                        ((Number(amount) || 0) * Math.abs(wallet.rate)) / 100,
                      ),
                  )}
                </Text>
              )}
              {err}
              <Button
                label={
                  action === 'deposit'
                    ? 'Add ' + money(Number(amount) * 100) + ' demo funds'
                    : action === 'trade'
                    ? 'Confirm demo trade'
                    : 'Submit request'
                }
                onPress={submit}
                busy={busy}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Dashboard />
    </SafeAreaProvider>
  );
}
const s = S.create({
  trade: { backgroundColor: '#ede7fa' },
  deposit: { backgroundColor: '#eaf3d9' },
  withdraw: { backgroundColor: '#f8e7df' },
  credit: { color: '#416832' },
  app: { flex: 1, backgroundColor: '#faf9f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logo: { color: ink, fontWeight: '900', fontSize: 30, letterSpacing: -1.8 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 6,
    backgroundColor: '#efece5',
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#799354' },
  tiny: { color: ink, fontSize: 11, fontWeight: '600' },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 16 },
  title: { fontSize: 33, letterSpacing: -1.5, fontWeight: '700', color: ink },
  hero: {
    padding: 21,
    borderRadius: 23,
    backgroundColor: '#282530',
    overflow: 'hidden',
  },
  art: { position: 'absolute', top: -28, right: -39, opacity: 0.9 },
  heroLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  light: { color: '#d0cbd6', fontSize: 12, lineHeight: 18 },
  balance: {
    fontSize: 42,
    letterSpacing: -1.9,
    fontWeight: '700',
    color: '#faf9fa',
    marginTop: 6,
  },
  heroBottom: {
    marginTop: 19,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#514b5c',
    flexDirection: 'row',
    gap: 19,
    alignItems: 'center',
  },
  heroValue: { fontSize: 15, fontWeight: '700', color: 'white', marginTop: 2 },
  rule: { width: 1, height: 24, backgroundColor: '#514b5c' },
  actions: { flexDirection: 'row', gap: 9 },
  quick: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
    borderRadius: 16,
  },
  bold: { color: ink, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e5e2e8',
    borderWidth: 1,
    borderRadius: 20,
    padding: 17,
    gap: 8,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 5,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f2f0f4',
    padding: 3,
    borderRadius: 10,
  },
  range: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  selected: { backgroundColor: '#e1d6f6' },
  figure: {
    color: ink,
    fontSize: 28,
    letterSpacing: -1,
    fontWeight: '700',
    marginBottom: -6,
  },
  small: { color: muted, fontSize: 12 },
  section: { color: ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.6 },
  link: { color: purple, fontWeight: '600', fontSize: 13, paddingVertical: 5 },
  list: {
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e2e8',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    paddingVertical: 11,
  },
  iconBox: {
    height: 38,
    width: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, gap: 3 },
  nav: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: '#e6e2e8',
    backgroundColor: '#fff',
    flexDirection: 'row',
  },
  navItem: { alignItems: 'center', flex: 1, gap: 2 },
  navIcon: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  activeChip: { backgroundColor: '#e5d9f7' },
  body: { fontSize: 14, lineHeight: 21, color: muted },
  primary: {
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: ink,
    alignItems: 'center',
    marginTop: 9,
  },
  primaryText: { fontWeight: '700', fontSize: 15, color: 'white' },
  darkCard: { backgroundColor: ink, padding: 22, borderRadius: 20, gap: 5 },
  filters: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#eeecee',
  },
  input: {
    backgroundColor: '#f5f3f5',
    borderWidth: 1,
    borderColor: '#ddd8e3',
    borderRadius: 12,
    padding: 13,
    color: ink,
    fontSize: 17,
    marginVertical: 6,
  },
  error: { color: '#aa3742', fontSize: 13, lineHeight: 19 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#1c192780',
  },
  sheet: {
    backgroundColor: '#faf9f7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
  },
  sheetNote: { fontSize: 14, lineHeight: 21, color: muted, marginVertical: 14 },
  preset: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#eeeaf0',
  },
});
