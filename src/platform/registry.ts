import type { PlatformAdapter } from './types'
import { facebookAdapter } from './facebook/adapter'

const adapters: PlatformAdapter[] = [facebookAdapter]

export function getPlatformAdapter(url: string): PlatformAdapter | undefined {
  return adapters.find((adapter) => adapter.canHandle(url))
}

export function listPlatformAdapterIds(): string[] {
  return adapters.map((adapter) => adapter.id)
}
