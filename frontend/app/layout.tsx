import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import { themeInitScript } from '@/hooks/useTheme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: 'Glyph',
    description: 'Technical documentation versioned by commit, linked to your Git projects.',
    icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className={`${inter.variable} bg-surface text-text-primary antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
