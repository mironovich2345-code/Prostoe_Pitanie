import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useBootstrap } from './hooks/useBootstrap';
import { useTelegramReady } from './hooks/useTelegramReady';
import ClientLayout from './layouts/ClientLayout';
import CoachLayout from './layouts/CoachLayout';
import LoadingScreen from './components/LoadingScreen';
import HomeScreen from './screens/client/HomeScreen';
import StatsScreen from './screens/client/StatsScreen';
import FoodDiaryScreen from './screens/client/FoodDiaryScreen';
import ProfileScreen from './screens/client/ProfileScreen';
import SubscriptionScreen from './screens/client/SubscriptionScreen';
import MyTrainerScreen from './screens/client/MyTrainerScreen';
import NotificationSettingsScreen from './screens/client/NotificationSettingsScreen';
import ReminderEditScreen from './screens/client/ReminderEditScreen';
import WeightReminderEditScreen from './screens/client/WeightReminderEditScreen';
import CoachClientsScreen from './screens/coach/CoachClientsScreen';
import CoachClientCardScreen from './screens/coach/CoachClientCardScreen';
import CoachClientStatsScreen from './screens/coach/CoachClientStatsScreen';
import CoachAlertsDashboardScreen from './screens/coach/CoachAlertsDashboardScreen';
import CoachProfileScreen from './screens/coach/CoachProfileScreen';
import CoachReferralsScreen from './screens/coach/CoachReferralsScreen';
import CoachPayoutsScreen from './screens/coach/CoachPayoutsScreen';
import CompanyLayout from './layouts/CompanyLayout';
import CompanyOffersScreen from './screens/company/CompanyOffersScreen';
import CompanyStatsScreen from './screens/company/CompanyStatsScreen';
import CompanyProfileScreen from './screens/company/CompanyProfileScreen';
import CompanyPayoutsScreen from './screens/company/CompanyPayoutsScreen';
import CompanyDocumentsScreen from './screens/company/CompanyDocumentsScreen';
import CompanyRequisitesScreen from './screens/company/CompanyRequisitesScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminApplicationsScreen from './screens/admin/AdminApplicationsScreen';
import AdminExpertsScreen from './screens/admin/AdminExpertsScreen';
import AdminPayoutsScreen from './screens/admin/AdminPayoutsScreen';
import AdminStatsScreen from './screens/admin/AdminStatsScreen';
import AdminRewardsScreen from './screens/admin/AdminRewardsScreen';
import AdminSubscriptionsScreen from './screens/admin/AdminSubscriptionsScreen';
import AdminUserSearchScreen from './screens/admin/AdminUserSearchScreen';
import TrainerPendingScreen from './screens/TrainerPendingScreen';
import TrainerRejectedScreen from './screens/TrainerRejectedScreen';
import TrainerBlockedScreen from './screens/TrainerBlockedScreen';
import ExpertApplicationScreen from './screens/expert/ExpertApplicationScreen';
import ExpertStatusScreen from './screens/expert/ExpertStatusScreen';
import EditProfileDataScreen from './screens/client/EditProfileDataScreen';
import ValuePickerScreen from './screens/client/ValuePickerScreen';
import CityPickerScreen from './screens/client/CityPickerScreen';
import AddMealScreen from './screens/client/AddMealScreen';
import ConnectTrainerScreen from './screens/client/ConnectTrainerScreen';
import TrainerReviewScreen from './screens/client/TrainerReviewScreen';
import ShopScreen from './screens/client/ShopScreen';
import TrainerListScreen from './screens/client/TrainerListScreen';
import TrainerDetailScreen from './screens/client/TrainerDetailScreen';
import DocumentsScreen from './screens/client/DocumentsScreen';
import OnboardingScreen from './screens/client/OnboardingScreen';
import TrainerConnectionScreen from './screens/coach/TrainerConnectionScreen';
import AccountLinkScreen from './screens/client/AccountLinkScreen';
import CoachReviewsScreen from './screens/coach/CoachReviewsScreen';
import PartnershipScreen from './screens/coach/PartnershipScreen';
import CoachRequisitesScreen from './screens/coach/CoachRequisitesScreen';
import { api } from './api/client';
import type { TgDiag } from './hooks/useTelegramReady';
import type { AppMode } from './types';

// Root paths per mode — BackButton is hidden on these (they are tab/home screens)
const ROOT_PATHS: Record<AppMode, string[]> = {
  client:  ['/', '/shop', '/stats', '/profile', '/diary', '/onboarding'],
  coach:   ['/', '/alerts', '/profile'],
  company: ['/', '/stats', '/profile'],
  admin:   ['/'],
};

/**
 * Syncs Telegram native BackButton visibility with the current route.
 * Must be rendered inside <BrowserRouter> so useLocation / useNavigate work.
 */
function TelegramNavSync({ mode }: { mode: AppMode }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const isRoot = ROOT_PATHS[mode].includes(location.pathname);
    if (isRoot) {
      tg.BackButton.hide();
      return;
    }

    const handleBack = () => navigate(-1);
    tg.BackButton.show();
    tg.BackButton.onClick(handleBack);

    return () => {
      tg.BackButton.offClick(handleBack);
    };
  }, [location.pathname, mode, navigate]);

  return null;
}

function TgDebugBlock({ diag, bsStatus, bsError }: { diag: TgDiag; bsStatus: string; bsError?: string }) {
  const lines = [
    `tg: ${diag.hasTelegram ? 'yes' : 'NO'}`,
    `webapp: ${diag.hasWebApp ? 'yes' : 'NO'}`,
    `version: ${diag.version ?? '—'}`,
    `tgInitData: ${diag.telegramInitDataLen}`,
    `maxInitData: ${diag.maxInitDataLen}`,
    `hashData: ${diag.hashWebAppData ? 'present' : 'absent'}`,
    `source: ${diag.selectedSource}`,
    `header: ${diag.authHeader}`,
    `user: ${diag.hasUser ? 'yes' : 'no'}`,
    `bootstrap: ${bsStatus}`,
    ...(bsError ? [`error: ${bsError}`] : []),
  ];
  return (
    <pre style={{ marginTop: 16, padding: '8px 12px', background: 'rgba(0,0,0,0.18)', borderRadius: 6, fontSize: 11, textAlign: 'left', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 280 }}>
      {lines.join('\n')}
    </pre>
  );
}

export default function App() {
  const { state: tgState, diag: tgDiag } = useTelegramReady();
  const { data: bootstrap, isLoading, error } = useBootstrap(tgState === 'ready');
  const [mode, setMode] = useState<AppMode>('client');

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    window.WebApp?.ready?.();
    window.WebApp?.expand?.();
    // Pin all Telegram chrome to the app's exact dark background.
    // Use hex directly — 'bg_color' resolves to the user's Telegram theme color (may be purple).
    (window.Telegram?.WebApp as any)?.setHeaderColor?.('#0A0A0A');
    (window.Telegram?.WebApp as any)?.setBackgroundColor?.('#0A0A0A');
    (window.Telegram?.WebApp as any)?.setBottomBarColor?.('#0A0A0A');
    // Prevent Telegram from intercepting vertical swipe gestures on Android
    // (would otherwise compete with in-app scroll and require two-finger scroll)
    (window.Telegram?.WebApp as any)?.disableVerticalSwipes?.();

    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam?.startsWith('trf_') || startParam?.startsWith('crf_')) {
      // trainer offer link (trf_) or company offer link (crf_) — both routed via /api/referral/apply
      api.referralApply(startParam).catch(() => null);
    } else if (startParam?.startsWith('ref_')) {
      const code = startParam.slice(4);
      api.referralApply(code).catch(() => null);
    } else if (startParam?.startsWith('connect_')) {
      sessionStorage.setItem('pendingConnectCode', startParam.slice(8));
    }
  }, []);

  if (tgState === 'waiting' || isLoading) return <LoadingScreen />;

  if (tgState === 'no_bridge') {
    console.error('[TG] no_bridge — WebApp object absent after timeout.', tgDiag);
    return (
      <div className="loading">
        <div>Не удалось загрузить приложение</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>Открой в мессенджере</div>
        <TgDebugBlock diag={tgDiag} bsStatus="idle" />
      </div>
    );
  }

  if (error || !bootstrap) {
    const errMsg = (error as Error | null)?.message ?? 'no data';
    const isExpired = errMsg === 'Expired auth_date';
    const isAuthErr = errMsg === 'Unauthorized' || errMsg === 'Invalid initData' || errMsg === 'Invalid MAX initData' || isExpired;
    const noData = tgDiag.selectedSource === 'none';
    const subtitle = isExpired
      ? 'Сессия устарела — закрой и открой снова'
      : isAuthErr && noData
        ? 'Платформа не передала данные авторизации'
        : isAuthErr
          ? 'Ошибка авторизации'
          : 'Проверь соединение и попробуй снова';
    console.error('[TG] bootstrap_failed:', errMsg, '| diag:', tgDiag);
    return (
      <div className="loading">
        <div>Не удалось загрузить данные</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>{subtitle}</div>
        <button
          style={{ marginTop: 16, padding: '8px 20px', fontSize: 14, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', cursor: 'pointer' }}
          onClick={() => window.location.reload()}
        >
          Повторить
        </button>
        <TgDebugBlock diag={tgDiag} bsStatus="error" bsError={errMsg} />
      </div>
    );
  }

  const isVerifiedTrainer = bootstrap.trainerProfile?.verificationStatus === 'verified';
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isCompany = isVerifiedTrainer && bootstrap.trainerProfile?.specialization === 'Компания';

  const adminIds = (import.meta.env.VITE_ADMIN_USER_IDS ?? '')
    .split(',').map((s: string) => s.trim()).filter(Boolean);
  const isAdmin = adminIds.includes(String(bootstrap.telegramUser?.id ?? ''));

  if (mode === 'coach' || mode === 'company') {
    if (trainerStatus === 'pending') return <TrainerPendingScreen onBack={() => setMode('client')} />;
    if (trainerStatus === 'rejected') return <TrainerRejectedScreen onBack={() => setMode('client')} />;
    if (trainerStatus === 'blocked') return <TrainerBlockedScreen onBack={() => setMode('client')} />;
    if (!isVerifiedTrainer) {
      setMode('client');
      return null;
    }
    // Enforce correct mode for company vs expert
    if (mode === 'coach' && isCompany) { setMode('company'); return null; }
    if (mode === 'company' && !isCompany) { setMode('coach'); return null; }
  }

  const needsOnboarding = mode === 'client' && (
    !bootstrap.profile?.heightCm ||
    !bootstrap.profile?.currentWeightKg ||
    !bootstrap.profile?.sex ||
    !bootstrap.profile?.birthDate ||
    !bootstrap.profile?.activityLevel
  );

  return (
    <BrowserRouter>
      <TelegramNavSync mode={mode} />
      {mode === 'client' ? (
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route element={<ClientLayout />}>
            <Route
              path="/"
              element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <HomeScreen bootstrap={bootstrap} />}
            />
            <Route path="/stats" element={<StatsScreen />} />
            <Route path="/diary" element={<FoodDiaryScreen />} />
            <Route
              path="/profile"
              element={
                <ProfileScreen
                  bootstrap={bootstrap}
                  onSwitchToCoach={isVerifiedTrainer ? () => setMode(isCompany ? 'company' : 'coach') : undefined}
                  onSwitchToAdmin={isAdmin ? () => setMode('admin') : undefined}
                />
              }
            />
            <Route path="/subscription" element={<SubscriptionScreen bootstrap={bootstrap} />} />
            <Route path="/trainer" element={<MyTrainerScreen bootstrap={bootstrap} />} />
            <Route path="/notifications" element={<NotificationSettingsScreen />} />
            <Route path="/notifications/weight/:id" element={<WeightReminderEditScreen />} />
            <Route path="/notifications/:id" element={<ReminderEditScreen />} />
            <Route path="/add" element={<AddMealScreen />} />
            <Route path="/expert/apply" element={<ExpertApplicationScreen />} />
            <Route path="/expert/status" element={<ExpertStatusScreen />} />
            <Route path="/profile/edit-data" element={<EditProfileDataScreen />} />
            <Route path="/profile/pick/:field" element={<ValuePickerScreen />} />
            <Route path="/profile/pick-city" element={<CityPickerScreen />} />
            <Route path="/connect-trainer" element={<ConnectTrainerScreen />} />
            <Route path="/trainer/review" element={<TrainerReviewScreen />} />
            <Route path="/shop" element={<ShopScreen />} />
            <Route path="/trainers" element={<TrainerListScreen />} />
            <Route path="/trainers/:trainerId" element={<TrainerDetailScreen />} />
            <Route path="/documents" element={<DocumentsScreen />} />
            <Route path="/account-link" element={<AccountLinkScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      ) : mode === 'coach' ? (
        <Routes>
          <Route element={<CoachLayout />}>
            <Route path="/" element={<CoachClientsScreen />} />
            <Route path="/client/:clientId" element={<CoachClientCardScreen />} />
            <Route path="/client/:clientId/stats" element={<CoachClientStatsScreen />} />
            <Route path="/alerts" element={<CoachAlertsDashboardScreen />} />
            <Route path="/profile" element={<CoachProfileScreen bootstrap={bootstrap} onSwitchToClient={() => setMode('client')} />} />
            <Route path="/referrals" element={<CoachReferralsScreen />} />
            <Route path="/payouts" element={<CoachPayoutsScreen />} />
            <Route path="/connect-client" element={<TrainerConnectionScreen />} />
            <Route path="/reviews" element={<CoachReviewsScreen />} />
            <Route path="/partnership" element={<PartnershipScreen />} />
            <Route path="/requisites" element={<CoachRequisitesScreen />} />
            <Route path="/account-link" element={<AccountLinkScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      ) : mode === 'admin' ? (
        <Routes>
          <Route path="/" element={<AdminDashboardScreen onBack={() => setMode('client')} />} />
          <Route path="/applications" element={<AdminApplicationsScreen />} />
          <Route path="/experts" element={<AdminExpertsScreen />} />
          <Route path="/payouts" element={<AdminPayoutsScreen />} />
          <Route path="/stats" element={<AdminStatsScreen />} />
          <Route path="/rewards/:trainerId" element={<AdminRewardsScreen />} />
          <Route path="/subscriptions" element={<AdminSubscriptionsScreen />} />
          <Route path="/user-search" element={<AdminUserSearchScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<CompanyLayout />}>
            <Route path="/" element={<CompanyOffersScreen />} />
            <Route path="/stats" element={<CompanyStatsScreen />} />
            <Route path="/profile" element={<CompanyProfileScreen bootstrap={bootstrap} onSwitchToClient={() => setMode('client')} />} />
            <Route path="/payouts" element={<CompanyPayoutsScreen />} />
            <Route path="/documents" element={<CompanyDocumentsScreen />} />
            <Route path="/requisites" element={<CompanyRequisitesScreen />} />
            <Route path="/partnership" element={<PartnershipScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}
