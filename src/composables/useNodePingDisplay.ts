import type { MaybeRefOrGetter } from 'vue'
import type { NodeStatusPing } from '@/utils/rpc'
import { computed, toValue } from 'vue'
import { NODE_PING_BAR_COUNT, type PingFamily, useNodePingStats } from '@/composables/useNodePingStats'
import { formatDateTime } from '@/utils/helper'
import { getPingToneClass, PING_PROVIDERS } from '@/utils/nodeHelper'

export type NodePingMetric = 'latency' | 'loss'

export interface NodePingBar {
  key: string
  className: string
  tooltip: string
}

interface UseNodePingDisplayOptions {
  enabled?: MaybeRefOrGetter<boolean>
  loadingDisplayText?: string
  emptyDisplayText?: string
}

function getLatencyToneClass(latency: number): string {
  if (latency <= 60)
    return 'bg-emerald-600/90'
  if (latency <= 120)
    return 'bg-green-500/80'
  if (latency <= 180)
    return 'bg-lime-400/80'
  if (latency <= 240)
    return 'bg-yellow-400/80'
  return 'bg-rose-500/80'
}

function getLossToneClass(loss: number): string {
  if (loss <= 1)
    return 'bg-emerald-600/90'
  if (loss <= 3)
    return 'bg-green-500/80'
  if (loss <= 6)
    return 'bg-lime-400/80'
  if (loss <= 9)
    return 'bg-yellow-400/80'
  return 'bg-rose-500/80'
}

export interface TopPingNetwork {
  key: string
  name: string
  latency: string
  toneClass: string
  tooltip: string
}

export interface Ipv6PingNetwork extends TopPingNetwork {}

const IPV6_PING_KEYS = ['node_1', 'node_2', 'node_3', 'node_4'] as const

/**
 * 首页卡片/列表「三网」行：只取 CT/CU/CM，并按存在性过滤。
 */
export function buildTopPingNetworks(ping?: Record<string, NodeStatusPing>): TopPingNetwork[] {
  if (!ping)
    return []

  return PING_PROVIDERS.slice(0, 3).flatMap((provider) => {
    const entry = ping[provider.key]
    if (!entry)
      return []

    const latency = entry.latest ?? 0
    const loss = entry.loss ?? 100
    const available = latency > 0 && loss < 100

    return [{
      key: provider.key,
      name: entry.name ?? provider.label,
      latency: available ? `${Math.round(latency)}ms` : '--',
      toneClass: getPingToneClass(latency, available),
      tooltip: available
        ? `${entry.name ?? provider.label}\n${Math.round(latency)} ms`
        : `${entry.name ?? provider.label}\n暂无响应`,
    }]
  })
}

/**
 * IPv6 行使用 Node 1~4。主题约定这些自定义节点用于 IPv6 探测。
 * 未配置/未返回的节点不会占位。
 */
export function buildIpv6PingNetworks(ping?: Record<string, NodeStatusPing>): Ipv6PingNetwork[] {
  if (!ping)
    return []

  return IPV6_PING_KEYS.flatMap((key) => {
    const entry = ping[key]
    if (!entry)
      return []

    const latency = entry.latest ?? 0
    const loss = entry.loss ?? 100
    const available = latency > 0 && loss < 100
    const fallbackName = key.replace('_', ' ').replace('node ', 'IPv6 ')

    return [{
      key,
      name: entry.name || fallbackName,
      latency: available ? `${Math.round(latency)}ms` : '--',
      toneClass: getPingToneClass(latency, available),
      tooltip: available
        ? `${entry.name || fallbackName}\n${Math.round(latency)} ms`
        : `${entry.name || fallbackName}\n暂无响应`,
    }]
  })
}

export function useNodePingDisplay(
  uuid: MaybeRefOrGetter<string>,
  options: UseNodePingDisplayOptions = {},
) {
  // Home-card samples are appended by the shared subscribe=all WebSocket.
  const pingStatsEnabled = computed(() => options.enabled === undefined || toValue(options.enabled))

  const pingStats = useNodePingStats(uuid, {
    enabled: pingStatsEnabled,
  })

  /**
   * 将一小时数据集按时间平均划分为 NODE_PING_BAR_COUNT 根柱子，按 IPv4/IPv6 分开统计。
   */
  function buildPingBars(metric: NodePingMetric, family: PingFamily): NodePingBar[] {
    const points = pingStats.history.value
    if (!points.length)
      return []

    const barCount = Math.min(NODE_PING_BAR_COUNT, points.length)
    const firstTime = Date.parse(points[0]!.time)
    const lastTime = Date.parse(points.at(-1)!.time)
    const segmentSize = Math.max(1, (lastTime - firstTime) / barCount)

    const bars: NodePingBar[] = []
    for (let index = 0; index < barCount; index++) {
      const segmentStart = firstTime + index * segmentSize
      const segmentEnd = index === barCount - 1 ? lastTime + 1 : segmentStart + segmentSize
      const segmentPoints = points.filter((point) => {
        const time = Date.parse(point.time)
        return time >= segmentStart && time < segmentEnd
      })

      const values = segmentPoints
        .map((point) => {
          if (metric === 'latency')
            return family === 'ipv4' ? point.latencyV4 : point.latencyV6
          return family === 'ipv4' ? point.lossV4 : point.lossV6
        })
        .filter((value): value is number => value !== null)

      const value = values.length
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null
      const segmentTime = new Date(segmentStart).toISOString()
      const familyLabel = family === 'ipv4' ? 'IPv4' : 'IPv6'

      bars.push({
        key: `${family}-${metric}-${segmentTime}-${index}`,
        className: value === null
          ? 'bg-muted-foreground/15'
          : metric === 'latency'
            ? getLatencyToneClass(value)
            : getLossToneClass(value),
        tooltip: value === null
          ? `${familyLabel} ${formatDateTime(segmentTime, 'HH:mm:ss')} N/A`
          : metric === 'latency'
            ? `${familyLabel} ${formatDateTime(segmentTime, 'HH:mm:ss')}\n${Math.round(value)} ms`
            : `${familyLabel} ${formatDateTime(segmentTime, 'HH:mm:ss')}\n${value.toFixed(1)}%`,
      })
    }

    return bars
  }

  function buildEmptyPingBars(metric: NodePingMetric, family: PingFamily): NodePingBar[] {
    const tooltip = pingStats.loading.value
      ? '加载中'
      : pingStats.error.value
        ? '加载失败'
        : !pingStatsEnabled.value
          ? '未启用记录'
          : 'N/A'

    return Array.from({ length: NODE_PING_BAR_COUNT }, (_, index) => ({
      key: `${family}-${metric}-empty-${index}`,
      className: 'bg-muted-foreground/10',
      tooltip,
    }))
  }

  const ipv4LatencyBars = computed(() => buildPingBars('latency', 'ipv4'))
  const ipv4LossBars = computed(() => buildPingBars('loss', 'ipv4'))
  const ipv6LatencyBars = computed(() => buildPingBars('latency', 'ipv6'))
  const ipv6LossBars = computed(() => buildPingBars('loss', 'ipv6'))

  const ipv4LatencyRenderBars = computed(() => ipv4LatencyBars.value.length ? ipv4LatencyBars.value : buildEmptyPingBars('latency', 'ipv4'))
  const ipv4LossRenderBars = computed(() => ipv4LossBars.value.length ? ipv4LossBars.value : buildEmptyPingBars('loss', 'ipv4'))
  const ipv6LatencyRenderBars = computed(() => ipv6LatencyBars.value.length ? ipv6LatencyBars.value : buildEmptyPingBars('latency', 'ipv6'))
  const ipv6LossRenderBars = computed(() => ipv6LossBars.value.length ? ipv6LossBars.value : buildEmptyPingBars('loss', 'ipv6'))

  const ipv4LatencyDisplay = computed(() => {
    if (pingStats.hasV4Data.value)
      return `${Math.round(pingStats.avgLatencyV4.value)} ms`
    if (pingStats.loading.value)
      return options.loadingDisplayText ?? '加载中'
    return options.emptyDisplayText ?? '-'
  })

  const ipv4LossDisplay = computed(() => {
    if (pingStats.hasV4Data.value)
      return `${pingStats.avgLossV4.value.toFixed(1)}%`
    if (pingStats.loading.value)
      return options.loadingDisplayText ?? '加载中'
    return options.emptyDisplayText ?? '-'
  })

  const ipv6LatencyDisplay = computed(() => pingStats.hasV6Data.value ? `${Math.round(pingStats.avgLatencyV6.value)} ms` : '—')
  const ipv6LossDisplay = computed(() => pingStats.hasV6Data.value ? `${pingStats.avgLossV6.value.toFixed(1)}%` : '—')

  const latencyPanelTooltip = computed(() => {
    const v4 = pingStats.hasV4Data.value ? `IPv4 平均延迟 ${Math.round(pingStats.avgLatencyV4.value)} ms` : 'IPv4 暂无数据'
    const v6 = pingStats.hasV6Data.value ? `IPv6 平均延迟 ${Math.round(pingStats.avgLatencyV6.value)} ms` : 'IPv6 暂无数据'
    return `${v4}\n${v6}`
  })

  const lossPanelTooltip = computed(() => {
    const v4 = pingStats.hasV4Data.value ? `IPv4 平均丢包 ${pingStats.avgLossV4.value.toFixed(1)}%` : 'IPv4 暂无数据'
    const v6 = pingStats.hasV6Data.value ? `IPv6 平均丢包 ${pingStats.avgLossV6.value.toFixed(1)}%` : 'IPv6 暂无数据'
    return `${v4}\n${v6}`
  })

  return {
    pingStats,
    pingStatsEnabled,
    ipv4LatencyRenderBars,
    ipv4LossRenderBars,
    ipv6LatencyRenderBars,
    ipv6LossRenderBars,
    ipv4LatencyDisplay,
    ipv4LossDisplay,
    ipv6LatencyDisplay,
    ipv6LossDisplay,
    latencyPanelTooltip,
    lossPanelTooltip,
  }
}
