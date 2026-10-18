import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '../lib/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Internal Tools Platform',
  description: 'Internal tools built on a shared, audited platform.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
