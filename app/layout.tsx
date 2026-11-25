import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'ProgramFlow', description: 'Run your event program live' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
