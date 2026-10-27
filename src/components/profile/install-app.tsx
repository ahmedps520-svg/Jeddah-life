"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const STANDALONE = "(display-mode: standalone)";
function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function isStandalone() {
  return window.matchMedia(STANDALONE).matches;
}

/** Uses the browser's install prompt where available; otherwise explains how. */
export function InstallApp() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BeforeInstallPrompt | null>(null);
  const [justInstalled, setInstalled] = useState(false);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
  const installed = standalone || justInstalled;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div className="flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink-900 text-sand-50">
        <Smartphone className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-semibold">{t.profile.installApp}</p>
        <p className="text-sm text-ink-500">{installed ? t.profile.installed : evt ? t.profile.installHint : t.profile.installUnavailable}</p>
      </div>
      {evt && !installed && (
        <Button
          size="sm"
          onClick={async () => {
            await evt.prompt();
            const r = await evt.userChoice;
            if (r.outcome === "accepted") setInstalled(true);
            setEvt(null);
          }}
        >
          {t.profile.installApp}
        </Button>
      )}
    </div>
  );
}
