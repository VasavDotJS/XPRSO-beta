import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XPRSO — Modern Café Order & POS Platform',
  description: 'Touch-first, deployment-ready café ordering, tax calculation, and deterministic sales analytics.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A0C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas-light dark:bg-canvas-dark text-gray-900 dark:text-gray-100 antialiased selection:bg-brand selection:text-white">
        {children}
      </body>
    </html>
  );
}
