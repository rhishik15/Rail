import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Railway Supervisor Dashboard',
  description: 'Supervisor dashboard for railway inspections',
};

const bodyStyle = {
  margin: 0,
  fontFamily: 'sans-serif',
  backgroundColor: '#f5f5f5',
  color: '#111111',
} satisfies CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}
