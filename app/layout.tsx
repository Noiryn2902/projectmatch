import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProjectMatch — describe your project, get a team',
  description:
    'Team formation scored on what a person adds to the team, not how good they look alone. Write a two-line brief and get a full roster back, with an honest list of what it is still missing.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1311' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
