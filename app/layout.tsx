import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { ClerkProvider } from '@clerk/nextjs'; // Import ClerkProvider

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RPG Collaboration App',
  description: 'Real-time tabletop RPG collaboration tool for DMs and Players',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider> {/* Wrap the entire application with ClerkProvider */}
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className} suppressHydrationWarning> {/* Added suppressHydrationWarning here */}
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
