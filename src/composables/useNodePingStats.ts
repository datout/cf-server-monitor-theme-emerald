import type { MaybeRefOrGetter } from 'vue'
import type { PingHistoryPoint } from '@/stores/nodes'
import { computed, ref, toValue } from 'vue'
import { useNodesStore } from '@/stores/nodes'

export type PingFamily = 'ipv4' | 'ipv6'

export interface NodePingHistoryPoint extends PingHistoryPoint {}

export interface NodePingStatsState {
  avgLatencyV4: number
  avgLossV4: number
  avgLatencyV6: number
  avgLossV6: number
  avgVolatilityV4: number
  avgVolatilityV6: number
  history: NodePingHistoryPoint[]
  hasV4Data: boolean
  hasV6Data: boolean
}

export const NODE_PING_BAR_COUNT = 10

function average(values: number[]): number {
  if (!values.length)
    return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function useNodePingStats(
  uuid: MaybeRefOrGetter<string>,
  options?: { enabled?: MaybeRefOrGetter<boolean> },
) {
  const nodesStore = useNodesStore()
  const enabled = computed(() => toValue(options?.enabled) ?? true)
  const history = computed(() => {
    if (!enabled.value)
      return []
    return nodesStore.pingHistoryByUuid[toValue(uuid)] ?? []
  })

  const stats = computed<NodePingStatsState>(() => {
    const points = history.value
    const latencyV4 = points
      .map(point => point.latencyV4)
      .filter((value): value is number => value !== null)
    const lossV4 = points
      .map(point => point.lossV4)
      .filter((value): value is number => value !== null)
    const latencyV6 = points
      .map(point => point.latencyV6)
      .filter((value): value is number => value !== null)
    const lossV6 = points
      .map(point => point.lossV6)
      .filter((value): value is number => value !== null)

    return {
      avgLatencyV4: average(latencyV4),
      avgLossV4: average(lossV4),
      avgLatencyV6: average(latencyV6),
      avgLossV6: average(lossV6),
      avgVolatilityV4: 0,
      avgVolatilityV6: 0,
      history: points,
      hasV4Data: Boolean(latencyV4.length || lossV4.length),
      hasV6Data: Boolean(latencyV6.length || lossV6.length),
    }
  })

  return {
    stats,
    loading: ref(false),
    error: ref<string | null>(null),
    history,
    avgLatencyV4: computed(() => stats.value.avgLatencyV4),
    avgLossV4: computed(() => stats.value.avgLossV4),
    avgLatencyV6: computed(() => stats.value.avgLatencyV6),
    avgLossV6: computed(() => stats.value.avgLossV6),
    avgVolatilityV4: computed(() => stats.value.avgVolatilityV4),
    avgVolatilityV6: computed(() => stats.value.avgVolatilityV6),
    hasV4Data: computed(() => stats.value.hasV4Data),
    hasV6Data: computed(() => stats.value.hasV6Data),
  }
}
