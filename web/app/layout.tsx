import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://eatlyy.ru'),
  title: {
    template: '%s | EATLYY',
    default: 'EATLYY — Питание под контролем',
  },
  description:
    'EATLYY — платформа для контроля питания с персональным нутрициологом. Найдите своего эксперта и выстройте здоровый рацион.',
  openGraph: {
    siteName: 'EATLYY',
    type: 'website',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
