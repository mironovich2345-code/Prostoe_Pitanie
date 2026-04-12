interface Props { status: string; }

const LABELS: Record<string, string> = {
  active: 'Активна', trial: 'Pro Intro', expired: 'Истекла', past_due: 'Не оплачено', canceled: 'Отменена',
  verified: 'Верифицирован', pending: 'На проверке', rejected: 'Отклонён', blocked: 'Заблокирован',
  free: 'Бесплатно',
};

export default function StatusBadge({ status }: Props) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
