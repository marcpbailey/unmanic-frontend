<template>
  <div v-if="completion" class="q-pa-md">
    <div class="row items-center q-gutter-sm text-primary">
      <q-spinner size="1.2em"/>
      <span>{{ $t('components.pendingTasks.completingScan') }}</span>
      <span>{{ $t('components.pendingTasks.completionElapsed', { seconds: completion.elapsed_seconds }) }}</span>
    </div>
    <div v-if="completion.plugin_name" class="q-mt-sm">{{ completion.plugin_name }}</div>
    <div v-if="completion.message">{{ completion.message }}</div>
    <div v-if="hasTotal">
      {{ $t('components.pendingTasks.completionCount', { current: completion.current, total: completion.total, unit: completion.unit || '' }) }}
    </div>
    <q-linear-progress class="q-mt-sm" :indeterminate="!hasTotal" :value="fraction" color="primary"/>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ completion: { type: Object, default: null } });
const hasTotal = computed(() => Number.isFinite(props.completion?.current) && props.completion?.total > 0);
const fraction = computed(() => hasTotal.value ? Math.min(1, props.completion.current / props.completion.total) : 0);
</script>
