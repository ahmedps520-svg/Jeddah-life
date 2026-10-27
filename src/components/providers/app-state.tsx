"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";

/* ------------------------------------------------------------------ */
/* Session                                                              */
/* ------------------------------------------------------------------ */

export type ClientUser = { id: string; displayName: string; avatarUrl: string | null; role: "user" | "admin" } | null;

const SessionContext = createContext<ClientUser>(null);
export const useSession = () => useContext(SessionContext);

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */

type Toast = { id: number; message: string; tone: "default" | "error"; action?: { label: string; href: string } };
const ToastContext = createContext<(message: string, opts?: { tone?: "default" | "error"; action?: { label: string; href: string } }) => void>(() => {});
export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ */
/* Saved places (ids)                                                   */
/* ------------------------------------------------------------------ */

type SavedCtx = {
  ready: boolean;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => Promise<boolean | null>;
  count: number;
};
const SavedContext = createContext<SavedCtx>({ ready: false, isSaved: () => false, toggle: async () => null, count: 0 });
export const useSaved = () => useContext(SavedContext);

/* ------------------------------------------------------------------ */
/* Location (kept on this device only)                                  */
/* ------------------------------------------------------------------ */

export type CityLocation =
  | { kind: "none" }
  | { kind: "area"; slug: string; lat: number; lng: number; label: { en: string; ar: string | null } }
  | { kind: "device"; lat: number; lng: number; at: number };

type LocationCtx = {
  location: CityLocation;
  setArea: (a: { slug: string; lat: number; lng: number; label: { en: string; ar: string | null } }) => void;
  clear: () => void;
  requestDevice: () => Promise<"ok" | "denied" | "unavailable">;
  origin: { lat: number; lng: number } | null;
};
const LocationContext = createContext<LocationCtx>({
  location: { kind: "none" },
  setArea: () => {},
  clear: () => {},
  requestDevice: async () => "unavailable",
  origin: null,
});
export const useCityLocation = () => useContext(LocationContext);

const LOCATION_KEY = "jl_location";

function readStoredLocation(): CityLocation {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return { kind: "none" };
    const v = JSON.parse(raw) as CityLocation;
    // Device positions are only reused for 30 minutes.
    if (v.kind === "device" && Date.now() - v.at > 30 * 60 * 1000) return { kind: "none" };
    return v;
  } catch {
    return { kind: "none" };
  }
}

/* ------------------------------------------------------------------ */
/* Provider                                                             */
/* ------------------------------------------------------------------ */

const NO_SAVES: ReadonlySet<string> = new Set();

export function AppStateProvider({ user, children }: { user: ClientUser; children: React.ReactNode }) {
  const { t } = useI18n();

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const toast = useCallback<React.ContextType<typeof ToastContext>>((message, opts) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, message, tone: opts?.tone ?? "default", action: opts?.action }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3800);
  }, []);

  // Saved ids
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/me/saves", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids: string[] }) => {
        if (alive) {
          setSaved(new Set(d.ids));
          setReady(true);
        }
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [user]);

  const toggle = useCallback(
    async (id: string) => {
      if (!user) {
        toast(t.common.signInToSave, { action: { label: t.auth.signIn, href: "/auth/sign-in" } });
        return null;
      }
      const was = saved.has(id);
      setSaved((s) => {
        const n = new Set(s);
        if (was) n.delete(id);
        else n.add(id);
        return n;
      });
      try {
        const res = await fetch("/api/me/saves", {
          method: was ? "DELETE" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placeId: id }),
        });
        if (!res.ok) throw new Error(String(res.status));
        return !was;
      } catch {
        setSaved((s) => {
          const n = new Set(s);
          if (was) n.add(id);
          else n.delete(id);
          return n;
        });
        toast(t.common.somethingWrong, { tone: "error" });
        return was;
      }
    },
    [saved, user, toast, t],
  );

  // Signed out: nothing is saved and there's nothing to wait for.
  const ownSaved = user ? saved : NO_SAVES;
  const savedReady = !user || ready;
  const savedCtx = useMemo<SavedCtx>(
    () => ({ ready: savedReady, isSaved: (id) => ownSaved.has(id), toggle, count: ownSaved.size }),
    [savedReady, ownSaved, toggle],
  );

  // Location
  const [location, setLocation] = useState<CityLocation>({ kind: "none" });
  // localStorage is only available after hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocation(readStoredLocation());
  }, []);
  const persist = (v: CityLocation) => {
    setLocation(v);
    try {
      if (v.kind === "none") localStorage.removeItem(LOCATION_KEY);
      else localStorage.setItem(LOCATION_KEY, JSON.stringify(v));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  };
  const locationCtx = useMemo<LocationCtx>(
    () => ({
      location,
      setArea: (a) => persist({ kind: "area", ...a }),
      clear: () => persist({ kind: "none" }),
      requestDevice: () =>
        new Promise((resolve) => {
          if (!("geolocation" in navigator)) return resolve("unavailable");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              persist({ kind: "device", lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() });
              resolve("ok");
            },
            (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
          );
        }),
      origin: location.kind === "none" ? null : { lat: location.lat, lng: location.lng },
    }),
    [location],
  );

  return (
    <SessionContext.Provider value={user}>
      <ToastContext.Provider value={toast}>
        <SavedContext.Provider value={savedCtx}>
          <LocationContext.Provider value={locationCtx}>
            {children}
            <div
              aria-live="polite"
              className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+12px)] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6"
            >
              {toasts.map((x) => (
                <div
                  key={x.id}
                  role={x.tone === "error" ? "alert" : "status"}
                  className={`pointer-events-auto flex max-w-md animate-fade-up items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lift ${
                    x.tone === "error" ? "bg-coral-500 text-white" : "bg-ink-900 text-sand-50"
                  }`}
                >
                  <span>{x.message}</span>
                  {x.action && <ToastAction href={x.action.href} label={x.action.label} />}
                </div>
              ))}
            </div>
          </LocationContext.Provider>
        </SavedContext.Provider>
      </ToastContext.Provider>
    </SessionContext.Provider>
  );
}

function ToastAction({ href, label }: { href: string; label: string }) {
  const { locale } = useI18n();
  return (
    <a href={`/${locale}${href}`} className="shrink-0 font-semibold text-sea-200 underline-offset-2 hover:underline">
      {label}
    </a>
  );
}
