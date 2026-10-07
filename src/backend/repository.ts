import { getSupabaseClient } from './client'

export interface CampaignRecord {
  id?: string
  name: string
  type: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  config: Record<string, unknown>
  revision?: number
}

export interface AiProfileRecord {
  id?: string
  name: string
  persona?: string
  prompt_version: string
  config: Record<string, unknown>
  revision?: number
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase backend chưa được cấu hình.')
  return client
}

export async function listRemoteCampaigns(): Promise<CampaignRecord[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('campaigns')
    .select('id,name,type,status,config,revision')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CampaignRecord[]
}

export async function upsertRemoteCampaign(record: CampaignRecord): Promise<CampaignRecord> {
  const client = requireClient()
  const payload = {
    ...record,
    revision: Math.max(1, Number(record.revision ?? 0) + 1),
  }
  const { data, error } = await client
    .from('campaigns')
    .upsert(payload)
    .select('id,name,type,status,config,revision')
    .single()
  if (error) throw error
  return data as CampaignRecord
}

export async function listRemoteAiProfiles(): Promise<AiProfileRecord[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('ai_profiles')
    .select('id,name,persona,prompt_version,config,revision')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AiProfileRecord[]
}

export async function upsertRemoteAiProfile(record: AiProfileRecord): Promise<AiProfileRecord> {
  const client = requireClient()
  const payload = {
    ...record,
    revision: Math.max(1, Number(record.revision ?? 0) + 1),
  }
  const { data, error } = await client
    .from('ai_profiles')
    .upsert(payload)
    .select('id,name,persona,prompt_version,config,revision')
    .single()
  if (error) throw error
  return data as AiProfileRecord
}
