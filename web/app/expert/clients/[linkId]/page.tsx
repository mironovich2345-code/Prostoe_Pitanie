import type { Metadata } from 'next';
import ExpertClientCardClient from '@/components/ExpertClientCardClient';

export const metadata: Metadata = {
  title: 'Карточка клиента | EATLYY',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ linkId: string }>;
}

export default async function ExpertClientCardPage({ params }: Props) {
  const { linkId } = await params;
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <ExpertClientCardClient botUsername={botUsername} linkId={linkId} />
      </div>
    </section>
  );
}
