import { Office365UsersService } from '../generated/services/Office365UsersService'
import { PowerPlatformforAdminsV2Service } from '../generated/services/PowerPlatformforAdminsV2Service'
import type {
  Clause,
  CloudFlow,
  FlowAction,
  OrderByClause,
  ResourceItem,
  ResourceQueryRequest,
  WhereClause,
} from '../generated/models/PowerPlatformforAdminsV2Model'
import type { GraphUser_V1 } from '../generated/models/Office365UsersModel'
import {
  RESOURCE_TYPES,
  type AgentFlowUsage,
  type AgentHarness,
  type AgentKind,
  type AssetCategory,
  type ConnectorUsage,
  type FlowStatus,
  type FlowTriggerType,
  type InventoryAsset,
  type InventoryLoadProgress,
  type InventoryPerson,
  type InventorySnapshot,
} from './types'

const API_VERSION = '2024-10-01'
const PAGE_SIZE = 1000
const PROFILE_CONCURRENCY = 6
const FLOW_DETAIL_CONCURRENCY = 3
const PROFILE_CACHE_KEY = 'power-platform-360:user-profiles:v1'
const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const INCLUDED_RESOURCE_TYPES = Object.values(RESOURCE_TYPES)

interface ProfileCacheEntry {
  expiresAt: number
  profile: InventoryPerson
}

interface ProfileCache {
  [id: string]: ProfileCacheEntry
}

interface TypeMetadata {
  category: AssetCategory
  label: string
}

const TYPE_METADATA: Record<string, TypeMetadata> = {
  [RESOURCE_TYPES.canvasApp]: { category: 'apps', label: 'Canvas app' },
  [RESOURCE_TYPES.modelDrivenApp]: { category: 'apps', label: 'Model-driven app' },
  [RESOURCE_TYPES.codeApp]: { category: 'apps', label: 'Code app' },
  [RESOURCE_TYPES.appBuilderApp]: { category: 'apps', label: 'App Builder app' },
  [RESOURCE_TYPES.cloudFlow]: { category: 'flows', label: 'Cloud flow' },
  [RESOURCE_TYPES.agentFlow]: { category: 'flows', label: 'Agent flow' },
  [RESOURCE_TYPES.workflowAgentFlow]: { category: 'flows', label: 'Workflow agent flow' },
  [RESOURCE_TYPES.agent]: { category: 'agents', label: 'Copilot Studio agent' },
  [RESOURCE_TYPES.connector]: { category: 'connectors', label: 'Connector' },
  [RESOURCE_TYPES.environment]: { category: 'environments', label: 'Environment' },
  [RESOURCE_TYPES.environmentGroup]: { category: 'environments', label: 'Environment group' },
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function firstString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key])
    if (value) return value
  }
  return undefined
}

function principalId(value: unknown): string | undefined {
  const direct = asString(value)
  if (direct) return direct
  const principal = asRecord(value)
  return firstString(principal, 'id', 'objectId', 'userId')
}

function getSubtype(type: string, properties: Record<string, unknown>): string | undefined {
  const subtype = firstString(properties, 'subType', 'subtype')
  if (type === RESOURCE_TYPES.codeApp && subtype === 'vibeApp') return 'Vibe app'
  if (type === RESOURCE_TYPES.codeApp && subtype === 'byocApp') return 'Code app'
  if (type === RESOURCE_TYPES.appBuilderApp) return 'App Builder app'
  return subtype
}

function connectorKey(value: string): string {
  return value.replace(/^\/providers\/Microsoft\.PowerApps\/apis\//i, '').toLowerCase()
}

function getConnectorCatalog(items: ResourceItem[]): Map<string, ConnectorUsage> {
  const catalog = new Map<string, ConnectorUsage>()

  for (const item of items) {
    if (item.type?.toLowerCase() !== RESOURCE_TYPES.connector) continue
    const properties = asRecord(item.properties)
    const id = firstString(properties, 'connectorId') ?? item.name
    if (!id) continue

    catalog.set(connectorKey(id), {
      id,
      displayName: firstString(properties, 'displayName') ?? id,
      tier: firstString(properties, 'tier'),
      isDeprecated: asBoolean(properties.isDeprecated) ?? false,
      operations: [],
    })
  }

  return catalog
}

function getConnectorUsage(
  properties: Record<string, unknown>,
  catalog: Map<string, ConnectorUsage>,
): ConnectorUsage[] {
  const rawConnectors = Array.isArray(properties.powerPlatformConnectors)
    ? properties.powerPlatformConnectors
    : []

  return rawConnectors.flatMap((value) => {
    const connector = asRecord(value)
    const id = firstString(connector, 'connectorId')
    if (!id) return []
    const catalogEntry = catalog.get(connectorKey(id))
    const operations = Array.isArray(connector.operations)
      ? connector.operations
          .map((operation) => firstString(asRecord(operation), 'operationId'))
          .filter((operation): operation is string => Boolean(operation))
      : []

    return [{
      id,
      displayName: catalogEntry?.displayName ?? id.replace(/^shared_/, ''),
      tier: catalogEntry?.tier,
      isDeprecated: catalogEntry?.isDeprecated ?? false,
      operations,
    }]
  })
}

function getAgentKind(createdIn: string | undefined): AgentKind {
  const normalized = createdIn?.toLowerCase() ?? ''
  if (normalized.includes('agent builder')) return 'Agent Builder'
  if (normalized.includes('copilot studio')) return 'Copilot Studio Agent'
  return 'Unknown'
}

function getAgentHarness(properties: Record<string, unknown>): AgentHarness {
  const directHarness = firstString(properties, 'harness')?.toLowerCase()
  if (directHarness === 'github copilot') return 'GitHub Copilot'
  if (directHarness === 'copilot chat') return 'Copilot Chat'
  if (directHarness === 'standard') return 'Standard'

  const rawCliAgent = properties.isCLIAgent
  const isCliAgent = rawCliAgent === true || String(rawCliAgent).toLowerCase() === 'true'
  const model = firstString(properties, 'model')?.toLowerCase() ?? ''
  const createdIn = firstString(properties, 'createdIn')?.toLowerCase() ?? ''

  if (isCliAgent) return 'GitHub Copilot'
  if (model === 'microsoft 365 copilot' || createdIn === 'microsoft 365 copilot agent builder') {
    return 'Copilot Chat'
  }
  return 'Standard'
}

function getAgentFlowUsage(
  connectorInventoryAvailable: boolean,
  connectors: ConnectorUsage[],
): AgentFlowUsage {
  if (!connectorInventoryAvailable) return 'Unknown'
  const hasFlowSignal = connectors.some((connector) => {
    const signal = [connector.id, connector.displayName, ...connector.operations].join(' ').toLowerCase()
    return signal.includes('logicflow') || signal.includes('power automate') ||
      signal.includes('powerautomate') || signal.includes('flow')
  })
  return hasFlowSignal ? 'Uses flows' : 'No flow signal'
}

function normalizeFlowStatus(value: unknown): FlowStatus {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === '1' || normalized === 'activated' || normalized === 'active' || normalized === 'on') {
    return 'Activated'
  }
  if (normalized === '2' || normalized === 'suspended') return 'Suspended'
  if (
    normalized === '0' ||
    normalized === 'draft' ||
    normalized === 'inactive' ||
    normalized === 'deactivated' ||
    normalized === 'off'
  ) return 'Deactivated'
  return 'Unknown'
}

function classifyTrigger(
  connector?: string,
  operationId?: string,
  operationKind?: string,
  operationType?: string,
  stageName?: string,
): FlowTriggerType {
  const signal = [connector, operationId, operationKind, operationType, stageName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!signal) return 'Unknown'
  if (signal.includes('recurrence') || signal.includes('schedule') || signal.includes('timer')) {
    return 'Scheduled'
  }
  if (
    signal.includes('manual') ||
    signal.includes('button') ||
    signal.includes('powerapps') ||
    signal.includes('instant')
  ) return 'Instant'
  return 'Automated'
}

function flowAliases(flow: CloudFlow): string[] {
  return [flow.workflowId, flow.resourceId]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
}

function assetFlowAliases(asset: InventoryAsset): string[] {
  return [
    asset.id,
    firstString(asset.rawProperties, 'workflowEntityId', 'workflowId', 'resourceId'),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
}

async function enrichFlowDetails(
  assets: InventoryAsset[],
  onProgress?: (progress: InventoryLoadProgress) => void,
): Promise<InventoryAsset[]> {
  const flowAssets = assets.filter((asset) => asset.category === 'flows' && asset.environmentId)
  const environmentIds = [...new Set(flowAssets.map((asset) => asset.environmentId!))]
  const flowsByAlias = new Map<string, CloudFlow>()
  const triggersByWorkflow = new Map<string, FlowAction>()
  let cursor = 0
  let completed = 0

  onProgress?.({ phase: 'flowDetails', loaded: 0, total: environmentIds.length })
  console.log(`Power Platform 360: enriching flows across ${environmentIds.length} environments`)

  const workers = Array.from(
    { length: Math.min(FLOW_DETAIL_CONCURRENCY, environmentIds.length) },
    async () => {
      while (cursor < environmentIds.length) {
        const environmentId = environmentIds[cursor]
        cursor += 1
        if (!environmentId) continue

        const [flowResult, actionResult] = await Promise.allSettled([
          PowerPlatformforAdminsV2Service.ListCloudFlows(environmentId, API_VERSION),
          PowerPlatformforAdminsV2Service.ListFlowActions(
            environmentId,
            API_VERSION,
            undefined,
            undefined,
            undefined,
            true,
          ),
        ])

        if (flowResult.status === 'fulfilled' && flowResult.value.success) {
          for (const flow of flowResult.value.data?.value ?? []) {
            for (const alias of flowAliases(flow)) flowsByAlias.set(alias, flow)
          }
        } else {
          console.log(`Power Platform 360: cloud flow enrichment unavailable for ${environmentId}`)
        }

        if (actionResult.status === 'fulfilled' && actionResult.value.success) {
          for (const action of actionResult.value.data?.value ?? []) {
            if (action.workflowId && !triggersByWorkflow.has(action.workflowId.toLowerCase())) {
              triggersByWorkflow.set(action.workflowId.toLowerCase(), action)
            }
          }
        } else {
          console.log(`Power Platform 360: trigger enrichment unavailable for ${environmentId}`)
        }

        completed += 1
        onProgress?.({ phase: 'flowDetails', loaded: completed, total: environmentIds.length })
      }
    },
  )

  await Promise.all(workers)

  const enriched = assets.map((asset) => {
    if (asset.category !== 'flows') return asset
    const aliases = assetFlowAliases(asset)
    const cloudFlow = aliases.map((alias) => flowsByAlias.get(alias)).find(Boolean)
    const trigger = aliases
      .concat(cloudFlow ? flowAliases(cloudFlow) : [])
      .map((alias) => triggersByWorkflow.get(alias))
      .find(Boolean)
    const triggerConnector = trigger?.connector ?? firstString(asset.rawProperties, 'trigger')
    const triggerOperation = trigger?.operationId ?? firstString(asset.rawProperties, 'triggerOperation')

    return {
      ...asset,
      flowStatus: normalizeFlowStatus(cloudFlow?.stateCode),
      flowTriggerType: classifyTrigger(
        triggerConnector,
        triggerOperation,
        trigger?.operationKind,
        trigger?.operationType,
        trigger?.stageName,
      ),
      flowTriggerConnector: triggerConnector,
      flowTriggerOperation: triggerOperation,
    }
  })

  const statusCounts = enriched
    .filter((asset) => asset.category === 'flows')
    .reduce<Record<string, number>>((counts, asset) => {
      const key = asset.flowStatus ?? 'Unknown'
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
  const triggerCounts = enriched
    .filter((asset) => asset.category === 'flows')
    .reduce<Record<string, number>>((counts, asset) => {
      const key = asset.flowTriggerType ?? 'Unknown'
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
  console.log('Power Platform 360: flow enrichment complete', { statusCounts, triggerCounts })
  return enriched
}

function normalizeAssets(items: ResourceItem[]): InventoryAsset[] {
  const connectorCatalog = getConnectorCatalog(items)
  const environments = new Map<string, ResourceItem>()

  for (const item of items) {
    if (item.type?.toLowerCase() === RESOURCE_TYPES.environment && item.name) {
      environments.set(item.name.toLowerCase(), item)
    }
  }

  return items.flatMap((item) => {
    const type = item.type?.toLowerCase()
    if (!type) return []
    const metadata = TYPE_METADATA[type]
    if (!metadata) return []

    const properties = asRecord(item.properties)
    const environmentId = type === RESOURCE_TYPES.environment
      ? item.name
      : firstString(properties, 'environmentId') ?? item.environmentId
    const environment = environmentId
      ? environments.get(environmentId.toLowerCase())
      : undefined
    const environmentProperties = asRecord(environment?.properties)
    const id = item.name ?? item.id
    if (!id) return []
    const connectors = getConnectorUsage(properties, connectorCatalog)
    const connectorInventoryAvailable = Array.isArray(properties.powerPlatformConnectors)
    const environmentType = type === RESOURCE_TYPES.environment
      ? firstString(properties, 'environmentType')
      : firstString(environmentProperties, 'environmentType') ?? item.environmentType

    return [{
      id,
      name: firstString(properties, 'displayName', 'name') ?? item.name ?? 'Unnamed resource',
      category: metadata.category,
      type,
      typeLabel: metadata.label,
      subtype: getSubtype(type, properties),
      tenantId: item.tenantId,
      location: item.location ?? environment?.location,
      environmentId,
      environmentName: type === RESOURCE_TYPES.environment
        ? firstString(properties, 'displayName') ?? item.name
        : firstString(environmentProperties, 'displayName') ?? item.environmentName,
      environmentType,
      environmentGroupId: type === RESOURCE_TYPES.environment
        ? firstString(properties, 'environmentGroupId')
        : firstString(environmentProperties, 'environmentGroupId'),
      isDefaultEnvironment: environmentType?.toLowerCase() === 'default',
      isManagedEnvironment: type === RESOURCE_TYPES.environment
        ? asBoolean(properties.isManaged)
        : asBoolean(environmentProperties.isManaged) ?? item.isManagedEnvironment,
      createdAt: firstString(properties, 'createdAt', 'createdTime', 'createdDateTime'),
      lastModifiedAt: firstString(properties, 'lastModifiedAt', 'lastModifiedTime', 'modifiedAt'),
      publishedAt: firstString(properties, 'lastPublishedAt', 'publishedAt'),
      creatorId: principalId(properties.createdBy),
      ownerId: principalId(properties.ownerId ?? properties.owner),
      modifiedById: principalId(properties.lastModifiedBy ?? properties.modifiedBy),
      isQuarantined: asBoolean(properties.isQuarantined) ?? false,
      connectors,
      flowTriggerConnector: firstString(properties, 'trigger'),
      flowTriggerOperation: firstString(properties, 'triggerOperation'),
      agentKind: type === RESOURCE_TYPES.agent
        ? getAgentKind(firstString(properties, 'createdIn'))
        : undefined,
      agentFlowUsage: type === RESOURCE_TYPES.agent
        ? getAgentFlowUsage(connectorInventoryAvailable, connectors)
        : undefined,
      agentHarness: type === RESOURCE_TYPES.agent ? getAgentHarness(properties) : undefined,
      connectorInventoryAvailable,
      rawProperties: properties,
    }]
  })
}

function readProfileCache(): ProfileCache {
  if (typeof localStorage === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? '{}') as ProfileCache
  } catch {
    return {}
  }
}

function writeProfileCache(cache: ProfileCache): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.log('Power Platform 360: user profile cache unavailable', error)
  }
}

function toInventoryPerson(id: string, profile: GraphUser_V1): InventoryPerson {
  return {
    id,
    displayName: profile.displayName ?? profile.mail ?? id,
    mail: profile.mail,
    department: profile.department,
    jobTitle: profile.jobTitle,
  }
}

function isSystemPrincipal(id: string): boolean {
  const normalized = id.toLowerCase()
  return normalized === 'system' || normalized.startsWith('00000000-0000-0000-0000-')
}

async function resolvePeople(
  assets: InventoryAsset[],
  onProgress?: (progress: InventoryLoadProgress) => void,
): Promise<Map<string, InventoryPerson>> {
  const ids = [...new Set(
    assets.flatMap((asset) => [asset.creatorId, asset.ownerId, asset.modifiedById])
      .filter((id): id is string => Boolean(id)),
  )]
  const cache = readProfileCache()
  const now = Date.now()
  const people = new Map<string, InventoryPerson>()
  const pending: string[] = []

  for (const id of ids) {
    if (isSystemPrincipal(id)) {
      people.set(id.toLowerCase(), {
        id,
        displayName: 'System account',
        isSystem: true,
      })
      continue
    }
    const cached = cache[id.toLowerCase()]
    if (cached && cached.expiresAt > now) {
      people.set(id.toLowerCase(), cached.profile)
    } else {
      pending.push(id)
    }
  }

  let completed = ids.length - pending.length
  onProgress?.({ phase: 'people', loaded: completed, total: ids.length })
  console.log(`Power Platform 360: resolving ${pending.length} uncached user profiles`)

  let cursor = 0
  const workers = Array.from(
    { length: Math.min(PROFILE_CONCURRENCY, pending.length) },
    async () => {
      while (cursor < pending.length) {
        const id = pending[cursor]
        cursor += 1
        if (!id) continue

        try {
          const result = await Office365UsersService.UserProfile_V2(
            id,
            'id,displayName,mail,department,jobTitle',
          )
          if (result.success && result.data) {
            const profile = toInventoryPerson(id, result.data)
            people.set(id.toLowerCase(), profile)
            cache[id.toLowerCase()] = {
              profile,
              expiresAt: now + PROFILE_CACHE_TTL_MS,
            }
          } else {
            console.log(`Power Platform 360: profile lookup failed for ${id}`, result.error)
          }
        } catch (error) {
          console.log(`Power Platform 360: profile lookup failed for ${id}`, error)
        } finally {
          completed += 1
          onProgress?.({ phase: 'people', loaded: completed, total: ids.length })
        }
      }
    },
  )

  await Promise.all(workers)
  writeProfileCache(cache)
  return people
}

function attachPeople(
  assets: InventoryAsset[],
  people: Map<string, InventoryPerson>,
): InventoryAsset[] {
  return assets.map((asset) => ({
    ...asset,
    creator: asset.creatorId ? people.get(asset.creatorId.toLowerCase()) : undefined,
    owner: asset.ownerId ? people.get(asset.ownerId.toLowerCase()) : undefined,
    modifiedBy: asset.modifiedById ? people.get(asset.modifiedById.toLowerCase()) : undefined,
  }))
}

async function queryAllResources(
  onProgress?: (progress: InventoryLoadProgress) => void,
): Promise<{ items: ResourceItem[]; totalRecords: number }> {
  const whereClause: Clause & WhereClause = {
    $type: 'where',
    FieldName: 'type',
    Operator: 'in~',
    Values: INCLUDED_RESOURCE_TYPES.map((type) => `'${type}'`),
  }
  const orderByClause: Clause & OrderByClause = {
    $type: 'orderby',
    FieldNamesAscDesc: { type: 'asc', name: 'asc' },
  }
  const clauses: Clause[] = [whereClause, orderByClause]
  const items: ResourceItem[] = []
  let skipToken: string | undefined
  let totalRecords = 0
  let page = 0

  do {
    const request: ResourceQueryRequest = {
      TableName: 'PowerPlatformResources',
      Clauses: clauses,
      Options: skipToken
        ? { Top: PAGE_SIZE, SkipToken: skipToken }
        : { Top: PAGE_SIZE, Skip: 0 },
    }
    const result = await PowerPlatformforAdminsV2Service.QueryResources(API_VERSION, request)

    if (!result.success) {
      throw new Error(result.error?.message ?? 'The Power Platform Inventory API request failed.')
    }

    const pageItems = result.data?.data ?? []
    items.push(...pageItems)
    totalRecords = result.data?.totalRecords ?? Math.max(totalRecords, items.length)
    const nextToken = result.data?.skipToken ?? result.skipToken
    page += 1
    console.log(`Power Platform 360: Inventory API page ${page} loaded (${items.length}/${totalRecords || '?'})`)
    onProgress?.({ phase: 'resources', loaded: items.length, total: totalRecords || undefined })

    if (!nextToken || nextToken === skipToken) break
    skipToken = nextToken
  } while (page < 1000)

  if (page === 1000 && skipToken) {
    throw new Error('Inventory paging exceeded the safety limit.')
  }

  return { items, totalRecords: totalRecords || items.length }
}

export async function loadInventory(
  onProgress?: (progress: InventoryLoadProgress) => void,
): Promise<InventorySnapshot> {
  console.log('Power Platform 360: loading tenant inventory from QueryResources')
  const { items, totalRecords } = await queryAllResources(onProgress)
  const normalized = normalizeAssets(items)
  const flowEnriched = await enrichFlowDetails(normalized, onProgress)
  const people = await resolvePeople(flowEnriched, onProgress)
  const assets = attachPeople(flowEnriched, people)
  onProgress?.({ phase: 'complete', loaded: assets.length, total: assets.length })
  console.log(`Power Platform 360: inventory ready with ${assets.length} normalized resources`)

  return {
    assets,
    loadedAt: new Date().toISOString(),
    totalRecords,
  }
}