import { t as $t } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Button,
  Info,
  Link as LinkIcon,
  Loader,
  Refresh,
} from "@/kit";
import { ExternalLink } from "@/kit/ext";
import { StartPage } from "@/components/browser/StartPage";
import { hostOf } from "@/lib/browser/address";
import { useBrowserStore } from "@/stores/browserStore";

export function BrowserView() {
  const ref = useRef<HTMLDivElement>(null);
  const supported = useBrowserStore((s) => s.supported);
  const tabs = useBrowserStore((s) => s.tabs);
  const activeId = useBrowserStore((s) => s.activeId);
  const covers = useBrowserStore((s) => s.covers);
  const setViewport = useBrowserStore((s) => s.setViewport);
  const reload = useBrowserStore((s) => s.reload);
  const goHome = useBrowserStore((s) => s.goHome);

  const tab = tabs.find((item) => item.id === activeId);
  const covered = covers > 0;

  useEffect(() => {
    const node = ref.current;
    if (!node || !supported) return;

    let pending = 0;

    const measure = () => {
      pending = 0;
      const rect = node.getBoundingClientRect();
      setViewport({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    const schedule = () => {
      if (pending) return;
      pending = window.requestAnimationFrame(measure);
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const settle = window.setTimeout(measure, 260);
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      if (pending) window.cancelAnimationFrame(pending);
      window.clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [supported, setViewport]);

  const showSite = supported && Boolean(tab?.url) && !tab?.error && !tab?.crashed;

  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-bg">
      {showSite ? (
        <>
          {covered && tab?.image && (
            <img
              src={tab.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top opacity-35 blur-[2px]"
              draggable={false}
            />
          )}
          {!tab?.mounted && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-2 text-[11px] text-muted">
                <Loader size={14} className="animate-spin" />
                {$t("Sekme hazırlanıyor…")}
              </span>
            </div>
          )}
        </>
      ) : !tab?.url ? (
        <StartPage />
      ) : !supported ? (
        <ExternalNotice url={tab.url} onHome={() => void goHome()} />
      ) : (
        <FailurePanel
          crashed={Boolean(tab?.crashed)}
          error={tab?.error ?? ""}
          host={hostOf(tab.url)}
          onRetry={() => void reload()}
          onHome={() => void goHome()}
        />
      )}
    </div>
  );
}

function FailurePanel({
  crashed,
  error,
  host,
  onRetry,
  onHome,
}: {
  crashed: boolean;
  error: string;
  host: string;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-sm animate-fade-up rounded-card border border-line bg-surface p-5 text-center shadow-2">
        <div className="mx-auto grid size-12 place-items-center rounded-ctrl border border-danger/25 bg-danger/10">
          <AlertTriangle size={22} className="text-danger" />
        </div>
        <h2 className="mt-3 text-[15px] font-semibold text-text">
          {crashed ? $t("Sekme çöktü") : $t("Sayfa açılamadı")}
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          {crashed
            ? $t("{0} beklenmedik şekilde kapandı. Yeniden yükleyebilirsin.", [host])
            : error || $t("{0} yanıt vermedi. Bağlantını denetleyip yeniden dene.", [host])}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="soft" className="flex-1" iconLeft={<ArrowLeft size={15} />} onClick={onHome}>
            {$t("Başlangıç")}
          </Button>
          <Button className="flex-1" iconLeft={<Refresh size={15} />} onClick={onRetry}>
            {$t("Yeniden dene")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExternalNotice({ url, onHome }: { url: string; onHome: () => void }) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-md animate-fade-up rounded-card border border-line bg-surface p-5 shadow-2">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-ctrl border border-info/25 bg-info/10">
            <Info size={20} className="text-info" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-text">{$t("Tarayıcı mobilde çalışır")}</h2>
            <p className="truncate text-[11px] text-muted">{hostOf(url)}</p>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-textsoft">
          {$t("Siteleri uygulama içinde açma ve cüzdanı tek dokunuşla bağlama Android sürümünde var. Masaüstünde siteyi kendi tarayıcında aç, oradan WalletConnect ile bağlan.")}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-ctrl bg-brand px-4 text-sm font-medium text-bg transition-colors hover:bg-brand/90"
          >
            <ExternalLink size={15} /> {$t("Tarayıcıda aç")}
          </a>
          <div className="flex gap-2">
            <Button variant="soft" className="flex-1" iconLeft={<ArrowLeft size={15} />} onClick={onHome}>
              {$t("Başlangıç")}
            </Button>
            <Link
              to="/connections"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-ctrl border border-line bg-surface2 px-3 text-sm font-medium text-text transition-colors hover:border-linestrong hover:bg-surface3"
            >
              <LinkIcon size={15} /> {$t("Bağlantılar")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
