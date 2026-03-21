interface Props { status: string; }

const LABELS: Record<string, string> = {
  active: 'Активна', trial: 'Пробный', expired: 'Истекла', past_due: 'Долг', canceled: 'Отменена',
  verified: 'Верифицирован', pending: 'На проверке', rejected: 'Отклонён', blocked: 'Заблокирован',
  free: 'Бесплатно',
};

export default function StatusBadge({ status }: Props) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
