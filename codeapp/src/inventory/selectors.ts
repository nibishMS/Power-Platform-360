import type {
  AgentFlowUsage,
  AgentHarness,
  AgentKind,
  FlowStatus,
  FlowTriggerType,
  InventoryAsset,
  InventoryPerson,
} from './types'
import { RESOURCE_TYPES } from './types'

export type FreshnessFilter = 'all' | 'current' | 'aging' | 'stale' | 'unknown'
export type RiskFilter = 'all' | 'quarantined' | 'orphaned' | 'premium' | 'deprecated'
export type FlowLicenseFilter = 'all' | 'premium' | 'standard'
export type AppKind = 'Canvas app' | 'Model-driven app' | 'Code app' | 'Vibe app' | 'App Builder app'
export type ConnectorLicense = 'Premium' | 'Standard' | 'Unknown'

export function getAppKind(asset: InventoryAsset): AppKind {
  if (asset.type === RESOURCE_TYPES.canvasApp) return 'Canvas app'
  if (asset.type === RESOURCE_TYPES.modelDrivenApp) return 'Model-driven app'
  if (asset.type === RESOURCE_TYPES.codeApp && asset.subtype === 'Vibe app') return 'Vibe app'
  if (asset.type === RESOURCE_TYPES.codeApp) return 'Code app'
  return 'App Builder app'
}

export function getConnectorLicense(asset: InventoryAsset): ConnectorLicense {
  if (usesPremiumConnector(asset)) return 'Premium'
  if (asset.connectors.length > 0) return 'Standard'
  return 'Unknown'
}

export interface InventoryFilters {
  search: string
  type: string
  environment: string
  environmentType: string
  region: string
  freshness: FreshnessFilter
  risk: RiskFilter
  flowStatus: FlowStatus | 'all'
  flowTriggerType: FlowTriggerType | 'all'
  createdYear: string
  connector: string
  flowLicense: FlowLicenseFilter
  agentKind: AgentKind | 'all'
  agentMakerId: string
  agentDepartment: string
  agentFlowUsage: AgentFlowUsage | 'all'
  appKind: AppKind | 'all'
  agentHarness: AgentHarness | 'all'
  agentPublished: 'all' | 'published' | 'draft'
  agentConnectorCount: string
}

export function personName(person: InventoryPerson | undefined, fallbackId?: string): string {
  return person?.displayName ?? fallbackId ?? 'Not available'
}

export function formatDate(value?: string): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(value?: string): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function getFreshness(asset: InventoryAsset): Exclude<FreshnessFilter, 'all'> {
  const value = asset.lastModifiedAt ?? asset.createdAt
  if (!value) return 'unknown'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'unknown'
  const ageInDays = (Date.now() - timestamp) / (24 * 60 * 60 * 1000)
  if (ageInDays <= 90) return 'current'
  if (ageInDays <= 180) return 'aging'
  return 'stale'
}

export function isOrphaned(asset: InventoryAsset): boolean {
  return Boolean(asset.ownerId && !asset.owner)
}

export function usesPremiumConnector(asset: InventoryAsset): boolean {
  return asset.connectors.some((connector) => connector.tier?.toLowerCase() === 'premium')
}

export function usesDeprecatedConnector(asset: InventoryAsset): boolean {
  return asset.connectors.some((connector) => connector.isDeprecated)
}

function matchesRisk(asset: InventoryAsset, risk: RiskFilter): boolean {
  if (risk === 'all') return true
  if (risk === 'quarantined') return asset.isQuarantined
  if (risk === 'orphaned') return isOrphaned(asset)
  if (risk === 'premium') return usesPremiumConnector(asset)
  return usesDeprecatedConnector(asset)
}

export function filterAssets(assets: InventoryAsset[], filters: InventoryFilters): InventoryAsset[] {
  const query = filters.search.trim().toLowerCase()

  return assets.filter((asset) => {
    if (filters.type !== 'all' && asset.type !== filters.type) return false
    if (filters.environment !== 'all' && asset.environmentId !== filters.environment) return false
    if (filters.environmentType !== 'all' && asset.environmentType !== filters.environmentType) return false
    if (filters.region !== 'all' && asset.location !== filters.region) return false
    if (filters.freshness !== 'all' && getFreshness(asset) !== filters.freshness) return false
    if (!matchesRisk(asset, filters.risk)) return false
    if (filters.flowStatus !== 'all' && asset.flowStatus !== filters.flowStatus) return false
    if (filters.flowTriggerType !== 'all' && asset.flowTriggerType !== filters.flowTriggerType) return false
    if (filters.createdYear !== 'all' && !asset.createdAt?.startsWith(filters.createdYear)) return false
    if (
      filters.connector !== 'all' &&
      !asset.connectors.some((connector) => connector.id === filters.connector)
    ) return false
    if (filters.flowLicense === 'premium' && !usesPremiumConnector(asset)) return false
    if (
      filters.flowLicense === 'standard' &&
      (asset.connectors.length === 0 || usesPremiumConnector(asset))
    ) return false
    if (filters.agentKind !== 'all' && asset.agentKind !== filters.agentKind) return false
    if (
      filters.agentMakerId !== 'all' &&
      asset.creatorId !== filters.agentMakerId &&
      asset.ownerId !== filters.agentMakerId
    ) return false
    if (
      filters.agentDepartment !== 'all' &&
      (asset.creator?.department ?? asset.owner?.department ?? 'Not available') !== filters.agentDepartment
    ) return false
    if (filters.agentFlowUsage !== 'all' && asset.agentFlowUsage !== filters.agentFlowUsage) return false
    if (filters.appKind !== 'all' && getAppKind(asset) !== filters.appKind) return false
    if (filters.agentHarness !== 'all' && asset.agentHarness !== filters.agentHarness) return false
    if (filters.agentPublished === 'published' && !asset.publishedAt) return false
    if (filters.agentPublished === 'draft' && asset.publishedAt) return false
    if (filters.agentConnectorCount !== 'all' && asset.connectors.length !== Number(filters.agentConnectorCount)) {
      return false
    }
    if (!query) return true

    const searchable = [
      asset.name,
      asset.typeLabel,
      asset.subtype,
      asset.environmentName,
      asset.location,
      personName(asset.owner, asset.ownerId),
      personName(asset.creator, asset.creatorId),
      ...asset.connectors.flatMap((connector) => [connector.id, connector.displayName]),
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(query)
  })
}

function escapeCsv(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function exportInventoryCsv(assets: InventoryAsset[]): void {
  const headers = [
    'Name',
    'Type',
    'Agent Harness',
    'Agent Publication',
    'Environment',
    'Region',
    'Owner',
    'Created By',
    'Created On',
    'Last Modified By',
    'Last Modified On',
    'Connectors',
    'Quarantined',
    'Resource ID',
  ]
  const rows = assets.map((asset) => [
    asset.name,
    asset.typeLabel,
    asset.category === 'agents' ? asset.agentHarness : undefined,
    asset.category === 'agents' ? (asset.publishedAt ? 'Published' : 'Draft') : undefined,
    asset.environmentName,
    asset.location,
    personName(asset.owner, asset.ownerId),
    personName(asset.creator, asset.creatorId),
    asset.createdAt,
    personName(asset.modifiedBy, asset.modifiedById),
    asset.lastModifiedAt,
    asset.connectors.map((connector) => connector.displayName).join('; '),
    asset.isQuarantined,
    asset.id,
  ])
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `power-platform-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  console.log(`Power Platform 360: exported ${assets.length} resources to CSV`)
}

export function getResourceLink(asset: InventoryAsset): string | undefined {
  const environmentId = asset.environmentId ? encodeURIComponent(asset.environmentId) : undefined
  const resourceId = encodeURIComponent(asset.id)

  if (asset.category === 'apps' && environmentId) {
    return `https://make.powerapps.com/environments/${environmentId}/apps/${resourceId}/details`
  }
  if (asset.category === 'flows' && environmentId) {
    return `https://make.powerautomate.com/environments/${environmentId}/flows/${resourceId}/details`
  }
  if (asset.category === 'agents' && environmentId) {
    return `https://copilotstudio.microsoft.com/environments/${environmentId}/bots/${resourceId}/overview`
  }
  if (asset.category === 'environments') {
    return `https://admin.powerplatform.microsoft.com/environments/${resourceId}/details`
  }
  return undefined
}