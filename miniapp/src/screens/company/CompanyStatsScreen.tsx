import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export default function CompanyStatsScreen() {
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['trainer-offer-links'],
    queryFn: api.trainerOfferLinks,
  });
  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ['trainer-rewards'],
    queryFn: api.trainerRewards,
  });

  const isLoading = offersLoading || rewardsLoading;

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const offers = offersData?.offers ?? [];
  const totalUniqueUsers = offersData?.totalUniqueUsers ?? 0;
  const rewards = rewardsData?.summary ?? { total: 0, available: 0, paidOut: 0 };

  const OFFER_EARN_LABEL: Record<string, string> = {
    first_payment: 'Первые оплаты',
    lifetime_20:   'Начислено',
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 20 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={{ color: 'var(--text)' }}>EATL</span>
          <span style={{ color: 'var(--accent)' }}>YY</span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Company</span>
      </div>

      {/* Привлечение */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
        Привлечение
      </div>

      {/* Total users card */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Переходов всего</span>
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: 'var(--accent)', lineHeight: 1 }}>
          {totalUniqueUsers}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 4 }}>чел.</span>
        </span>
      </div>

      {/* Per-offer breakdown */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
        {offers.map((offer, i) => (
          <div
            key={offer.offerId}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              borderBottom: i < offers.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              {offer.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {offer.title}
              </div>
              {offer.earnedRub !== null && offer.earnedRub > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {OFFER_EARN_LABEL[offer.offerKey] ?? 'Начислено'}: {offer.earnedRub.toLocaleString('ru')} ₽
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: offer.invitedCount > 0 ? 'var(--text)' : 'var(--text-3)', letterSpacing: -0.3 }}>
                {offer.invitedCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>чел.</div>
            </div>
          </div>
        ))}
      </div>

      {/* Начисления */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
        Начисления
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>Всего</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
            {rewards.total.toLocaleString('ru')}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>К выводу</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: rewards.available > 0 ? 'var(--accent)' : 'var(--text-3)', lineHeight: 1 }}>
            {rewards.available.toLocaleString('ru')}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>Выплачено</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text-2)', lineHeight: 1 }}>
            {rewards.paidOut.toLocaleString('ru')}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
      </div>
    </div>
  );
}
