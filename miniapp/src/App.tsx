import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useBootstrap } from './hooks/useBootstrap';
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
import TrainerConnectionScreen from './screens/coach/TrainerConnectionScreen';
import { api } from './api/client';
import type { AppMode } from './types';

export default function App() {
  const { data: bootstrap, isLoading, error } = useBootstrap();
  const [mode, setMode] = useState<AppMode>('client');

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();

    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam?.startsWith('trf_')) {
      api.referralApply(startParam).catch(() => null);
    } else if (startParam?.startsWith('ref_')) {
      const code = startParam.slice(4);
      api.referralApply(code).catch(() => null);
    } else if (startParam?.startsWith('connect_')) {
      sessionStorage.setItem('pendingConnectCode', startParam.slice(8));
    }
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (error || !bootstrap) {
    return (
      <div className="loading">
        <div>Не удалось загрузить приложение</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>Открой через Telegram</div>
      </div>
    );
  }

  const isVerifiedTrainer = bootstrap.trainerProfile?.verificationStatus === 'verified';
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;

  if (mode === 'coach') {
    if (trainerStatus === 'pending') return <TrainerPendingScreen onBack={() => setMode('client')} />;
    if (trainerStatus === 'rejected') return <TrainerRejectedScreen onBack={() => setMode('client')} />;
    if (trainerStatus === 'blocked') return <TrainerBlockedScreen onBack={() => setMode('client')} />;
    if (!isVerifiedTrainer) {
      setMode('client');
      return null;
    }
  }

  return (
    <BrowserRouter>
      {mode === 'client' ? (
        <Routes>
          <Route element={<ClientLayout />}>
            <Route path="/" element={<HomeScreen bootstrap={bootstrap} />} />
            <Route path="/stats" element={<StatsScreen />} />
            <Route path="/diary" element={<FoodDiaryScreen />} />
            <Route
              path="/profile"
              element={
                <ProfileScreen
                  bootstrap={bootstrap}
                  onSwitchToCoach={isVerifiedTrainer ? () => setMode('coach') : undefined}
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      ) : (
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}
