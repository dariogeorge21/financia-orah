import type { Metadata, Viewport } from "next";
import { Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/finance/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BalanceNotificationProvider } from "@/components/finance/BalanceNotificationProvider";

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Orah Financia · Campus Meet 2026",
  description: "Financial management dashboard for Orah – Campus Meet 2026 event by Jesus Youth Pala.",
  applicationName: "Orah Financia",
  keywords: [
    "Orah",
    "Financia",
    "Campus Meet 2026",
    "Jesus Youth",
    "Pala Missionaries",
    "Finance Dashboard",
    "Income Tracker",
    "Expense Manager",
    "Budget Planning",
    "Reimbursement Tracking",
    "Finance Calls"
  ],
  authors: [{ name: "Jesus Youth Pala Missionaries" }],
  creator: "Jesus Youth Pala Missionaries",
  publisher: "Jesus Youth Pala Missionaries",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://financia.orah.in",
    title: "Orah Financia · Campus Meet 2026",
    description: "Financial management dashboard for Orah – Campus Meet 2026 event by Jesus Youth Pala.",
    siteName: "Orah Financia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orah Financia · Campus Meet 2026",
    description: "Financial management dashboard for Orah – Campus Meet 2026 event by Jesus Youth Pala.",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", figtree.variable, geistMono.variable, "font-sans")}
    >
      <head>
        <meta name="apple-mobile-web-app-title" content="Orah Financia" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <BalanceNotificationProvider>
              {children}
            </BalanceNotificationProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
