import { useEffect, useMemo, useState } from "react";
import { findProtocolByGeckoId, llamaRangeStats, type LlamaProtocol, type RangeStats } from "@/lib/api/llamaMeta";
import type { SeriesPoint } from "@/lib/api/defillama";

export function useTokenAnalytics(
  coingeckoId: string | undefined,
  series: SeriesPoint[],
): { protocol: LlamaProtocol | null; protocolLoading: boolean; stats: RangeStats | null } {
  const [protocol, setProtocol] = useState<LlamaProtocol | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(false);

  useEffect(() => {
    if (!coingeckoId) {
      setProtocol(null);
      setProtocolLoading(false);
      return;
    }
    let cancelled = false;
    setProtocolLoading(true);
    void findProtocolByGeckoId(coingeckoId)
      .then((row) => {
        if (!cancelled) setProtocol(row);
      })
      .catch(() => {
        if (!cancelled) setProtocol(null);
      })
      .finally(() => {
        if (!cancelled) setProtocolLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coingeckoId]);

  const stats = useMemo(() => llamaRangeStats(series), [series]);
  return { protocol, protocolLoading, stats };
}
