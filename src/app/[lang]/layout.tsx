import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Inter, IBM_Plex_Sans_Arabic, Amiri } from "next/font/google";
import "../globals.css";
import { dirFor, isLocale, locales } from "@/lib/i18n/config";
import { dictionaryFor } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { AppStateProvider } from "@/components/providers/app-state";
import { getCurrentUser } from "@/lib/auth/session";
import { databaseReady } from "@/lib/db";
import { generateDueReminders, unreadCount } from "@/lib/notifications";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { ServiceWorker } from "@/components/layout/service-worker";
import { HideOn } from "@/components/layout/hide-on";

const displayEn = Fraunces({ subsets: ["latin"], variable: "--font-display-en", display: "swap", axes: ["opsz", "SOFT"] });
const sansEn = Inter({ subsets: ["latin"], variable: "--font-sans-en", display: "swap" });
const sansAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-ar",
  display: "swap",
});
const displayAr = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-display-ar", display: "swap" });

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dictionaryFor(lang);
  return {
    title: { default: t.meta.title, template: `%s · ${t.brand.name}` },
    description: t.meta.description,
    applicationName: "JEDDAH LIFE",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "JEDDAH LIFE", statusBarStyle: "black-translucent" },
    icons: {
      icon: [
        { url: "/icons/favicon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    alternates: { languages: { en: "/en", ar: "/ar" } },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b1b2b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dictionaryFor(lang);
  const ready = await databaseReady();
  const user = ready ? await getCurrentUser() : null;
  if (user) await generateDueReminders(user.id);
  const unread = user ? await unreadCount(user.id) : 0;
  const clientUser = user ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role } : null;

  return (
    <html
      lang={lang}
      dir={dirFor(lang)}
      className={`${displayEn.variable} ${sansEn.variable} ${sansAr.variable} ${displayAr.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <I18nProvider locale={lang} t={t}>
          <AppStateProvider user={clientUser}>
            <a
              href="#content"
              className="sr-only z-[100] rounded-lg bg-sea-500 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
            >
              {t.nav.skipToContent}
            </a>
            <SiteHeader unread={unread} />
            <main id="content" className="min-h-[60dvh]">
              {ready ? (
                children
              ) : (
                <div className="mx-auto max-w-xl px-4 py-20 text-center">
                  <h1 className="font-display text-[32px] font-semibold">{t.errors.setupTitle}</h1>
                  <p className="mt-3 text-ink-600">{t.errors.setupLede}</p>
                </div>
              )}
            </main>
            <HideOn paths={["/map"]}>
              <SiteFooter />
            </HideOn>
            <BottomNav />
            <ServiceWorker />
          </AppStateProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
