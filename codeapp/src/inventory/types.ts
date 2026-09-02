export const RESOURCE_TYPES = {
  canvasApp: 'microsoft.powerapps/canvasapps',
  modelDrivenApp: 'microsoft.powerapps/modeldrivenapps',
  codeApp: 'microsoft.powerapps/codeapps',
  appBuilderApp: 'microsoft.powerapps/apps',
  cloudFlow: 'microsoft.powerautomate/cloudflows',
  agentFlow: 'microsoft.powerautomate/agentflows',
  workflowAgentFlow: 'microsoft.powerautomate/m365agentflows',
  agent: 'microsoft.copilotstudio/agents',
  connector: 'microsoft.powerplatformconnector/connectors',
  environment: 'microsoft.powerplatform/environments',
  environmentGroup: 'microsoft.powerplatform/environmentgroups',
} as const

export type AssetCategory =
  | 'apps'
  | 'flows'
  | 'agents'
  | 'environments'
  | 'connectors'

export interface InventoryPerson {
  id: string
  displayName: string
  mail?: string
  department?: string
  jobTitle?: string
  isSystem?: boolean
}

export interface ConnectorUsage {
  id: string
  displayName: string
  tier?: string
  isDeprecated: boolean
  operations: string[]
}

export type FlowStatus = 'Activated' | 'Deactivated' | 'Suspended' | 'Unknown'
export type FlowTriggerType = 'Instant' | 'Scheduled' | 'Automated' | 'Unknown'
export type AgentKind = 'Copilot Studio Agent' | 'Agent Builder' | 'Unknown'
export type AgentFlowUsage = 'Uses flows' | 'No flow signal' | 'Unknown'
export type AgentHarness = 'GitHub Copilot' | 'Standard' | 'Copilot Chat'

export interface InventoryAsset {
  id: string
  name: string
  category: AssetCategory
  type: string
  typeLabel: string
  subtype?: string
  tenantId?: string
  location?: string
  environmentId?: string
  environmentName?: string
  environmentType?: string
  environmentGroupId?: string
  isDefaultEnvironment?: boolean
  isManagedEnvironment?: boolean
  createdAt?: string
  lastModifiedAt?: string
  publishedAt?: string
  creatorId?: string
  ownerId?: string
  modifiedById?: string
  creator?: InventoryPerson
  owner?: InventoryPerson
  modifiedBy?: InventoryPerson
  isQuarantined: boolean
  connectors: ConnectorUsage[]
  flowStatus?: FlowStatus
  flowTriggerType?: FlowTriggerType
  flowTriggerConnector?: string
  flowTriggerOperation?: string
  agentKind?: AgentKind
  agentFlowUsage?: AgentFlowUsage
  agentHarness?: AgentHarness
  connectorInventoryAvailable?: boolean
  rawProperties: Record<string, unknown>
}

export type InventoryLoadPhase = 'resources' | 'flowDetails' | 'people' | 'complete'

export interface InventoryLoadProgress {
  phase: InventoryLoadPhase
  loaded: number
  total?: number
}

export interface InventorySnapshot {
  assets: InventoryAsset[]
  loadedAt: string
  totalRecords: number
}