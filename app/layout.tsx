import './globals.css';
import type { ReactNode } from 'react';
import GlobalLivePlayer from '@/components/GlobalLivePlayer';

export const metadata = { title: 'ProgramFlow', description: 'Run your event program live' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;700&family=Noto+Serif+Bengali:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <GlobalLivePlayer />
      </body>
    </html>
  );
}