<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed } from 'vue'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { buildIpv6PingNetworks, buildTopPingNetworks, useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useNodesStore } from '@/stores/nodes'

const props = defineProps<{ node: NodeData }>()

const nodesStore = useNodesStore()
const {
  pingStats,
  ipv4LatencyRenderBars,
  ipv4LossRenderBars,
  ipv6LatencyRenderBars,
  ipv6LossRenderBars,
} = useNodePingDisplay(props.node.uuid)
const topPingNetworks = computed(() => buildTopPingNetworks(props.node.ping))
const ipv6PingNetworks = computed(() => buildIpv6PingNetworks(props.node.ping))
const showIpv6 = computed(() => Boolean(props.node.ipv6?.trim()) || ipv6PingNetworks.value.length > 0 || pingStats.hasV6Data.value)
</script>

<template>
  <div class="flex min-w-0 w-full flex-col gap-[1px]">
    <div v-if="topPingNetworks.length > 0" class="flex flex-row">
      <DataTooltip
        v-for="(net, index) in topPingNetworks" :key="net.key" placement="top"
        :content="net.tooltip"
        content-class="whitespace-pre-wrap w-max px-1.5 !leading-[1.2] text-[11px]"
      >
        <div class="truncate text-[10px]">
          <span v-if="index" class="mx-1">·</span>
          <span :class="net.toneClass">{{ net.latency }}</span>
        </div>
      </DataTooltip>
    </div>
    <div v-else class="truncate">
      N/A
    </div>

    <div v-if="showIpv6" class="flex flex-row">
      <DataTooltip
        v-for="(net, index) in ipv6PingNetworks" :key="net.key" placement="top"
        :content="net.tooltip"
        content-class="whitespace-pre-wrap w-max px-1.5 !leading-[1.2] text-[11px]"
      >
        <div class="truncate text-[10px]">
          <span v-if="index" class="mx-1">·</span>
          <span :class="net.toneClass">{{ net.latency }}</span>
        </div>
      </DataTooltip>
      <span v-if="!ipv6PingNetworks.length" class="text-[10px] text-muted-foreground">—</span>
    </div>

    <template v-if="nodesStore.showThreeNetDetails">
      <div class="flex w-full flex-col gap-[1px] pr-4">
        <div class="relative items-center gap-1">
          <div
            class="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
            :style="{ gridTemplateColumns: `repeat(${ipv4LatencyRenderBars.length}, minmax(0, 1fr))` }"
          >
            <DataTooltip
              v-for="bar in ipv4LatencyRenderBars" :key="bar.key" placement="top"
              :content="bar.tooltip" class="h-full w-full"
              content-class="whitespace-pre-wrap w-max px-1.5 !leading-[1.2] text-[11px]"
            >
              <span class="block h-full w-full rounded-[1px]" :class="bar.className" />
            </DataTooltip>
          </div>
        </div>
        <div v-if="showIpv6" class="relative items-center gap-1">
          <div
            class="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
            :style="{ gridTemplateColumns: `repeat(${ipv6LatencyRenderBars.length}, minmax(0, 1fr))` }"
          >
            <DataTooltip
              v-for="bar in ipv6LatencyRenderBars" :key="bar.key" placement="top"
              :content="bar.tooltip" class="h-full w-full"
              content-class="whitespace-pre-wrap w-max px-1.5 !leading-[1.2] text-[11px]"
            >
              <span class="block h-full w-full rounded-[1px]" :class="bar.className" />
            </DataTooltip>
          </div>
        </div>
        <div class="relative items-center gap-1">
          <div
            class="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
            :style="{ gridTemplateColumns: `repeat(${ipv4LossRenderBars.length}, minmax(0, 1fr))` }"
          >
            <DataTooltip
              v-for="bar in ipv4LossRenderBars" :key="bar.key" placement="top"
              :content="bar.tooltip" class="h-full w-full"
              content-class="whitespace-pre-wrap w-max px-1.5 !leading-[1.2] text-[11px]"
            >
              <span class="block h-full w-full rounded-[1px]" :class="bar.className" />
            </DataTooltip>
          </div>
        </div>
        <div v-if="showIpv6" class="relative items-center gap-1">
          <div
            class="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
            :style="{ gridTemplateColumns: `repeat(${ipv6LossRenderBars.length}, minmax(0, 1fr))` }"
          >
            <DataTooltip
              v-for="bar in ipv6LossRenderBars" :key="bar.key" placement="top"
              :content="bar.tooltip" class="h-full w-full"
              content-class="whitespace-pre-wrap w-max px-1.5 !leading-[1.2] text-[11px]"
            >
              <span class="block h-full w-full rounded-[1px]" :class="bar.className" />
            </DataTooltip>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
