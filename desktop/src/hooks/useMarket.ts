import { t as $t } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import {
  cachedMarketQuotes,
  fetchMarketQuotes,
  type MarketQuotes,
} from "@/lib/api/quotes";

const REFRESH_MS = 60_000;

/**
 * Piyasa listesi verisi.
 *
 * Önbellek sayesinde sekme değişiminde istek atılmaz.
 */
export function useMarket() {
  const [quotes, setQuotes] = useState<MarketQuotes>(() => cachedMarketQuotes() ?? {});
  const [loading, setLoading] = useState(() => cachedMarketQuotes() == null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    setError(null);
    try {
      const next = await fetchMarketQuotes(force);
      setQuotes(next);
      setLoading(false);
      if (Object.keys(next).length === 0) setError($t("Piyasa fiyatları alınamadı."));
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return { quotes, loading, error, refresh: () => void load(true) };
}