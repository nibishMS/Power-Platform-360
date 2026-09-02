import {
  Badge,
  Button,
  Input,
  Select,
  Spinner,
} from '@fluentui/react-components'
import {
  ArrowDownload20Regular,
  ArrowSync20Regular,
  Dismiss20Regular,
  Grid20Regular,
  List20Regular,
  Search20Regular,
  Warning20Regular,
} from '@fluentui/react-icons'
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react'
import './App.css'
import { AgentDashboard } from './components/AgentDashboard'
import { AppsDashboard } from './components/AppsDashboard'
import { AppsInventory } from './components/AppsInventory'
import { AssetDrawer } from './components/AssetDrawer'
import { FlowDashboard } from './components/FlowDashboard'
import { FlowsInventory } from './components/FlowsInventory'
import { InventoryCharts } from './components/InventoryCharts'
import { InventoryTable } from './components/InventoryTable'
import { OverviewDashboard } from './components/OverviewDashboard'
import { WorkloadIcon } from './components/WorkloadIcon'
import { loadInventory } from './inventory/inventoryService'
import {
  exportInventoryCsv,
  filterAssets,
  formatDateTime,
  getFreshness,
  isOrphaned,
  personName,
  usesDeprecatedConnector,
  usesPremiumConnector,
  type AppKind,
  type FreshnessFilter,
  type FlowLicenseFilter,
  type RiskFilter,
} from './inventory/selectors'
import type {
  AgentFlowUsage,
  AgentHarness,
  AgentKind,
  AssetCategory,
  FlowStatus,
  FlowTriggerType,
  InventoryAsset,
  InventoryLoadProgress,
  InventorySnapshot,
} from './inventory/types'
import { RESOURCE_TYPES } from './inventory/types'

type Section = 'overview' | AssetCategory | 'environmentGroups'
type ViewMode = 'dashboard' | 'inventory'
type LoadStatus = 'idle' | 'loading' | 'refreshing' | 'error'

interface NavigationItem {
  id: Section
  label: string
}

const NAVIGATION: NavigationItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'apps', label: 'Apps' },
  { id: 'flows', label: 'Flows' },
  { id: 'agents', label: 'Agents' },
  { id: 'environments', label: 'Environments' },
  { id: 'environmentGroups', label: 'Environment Groups' },
  { id: 'connectors', label: 'Connectors' },
]

const EMPTY_PROGRESS: InventoryLoadProgress = { phase: 'resources', loaded: 0 }

function progressText(progress: InventoryLoadProgress): string {
  const count = progress.total
    ? `${progress.loaded.toLocaleString()} of ${progress.total.toLocaleString()}`
    : progress.loaded.toLocaleString()
  if (progress.phase === 'people') return `Resolving makers ${count}`
  if (progress.phase === 'flowDetails') return `Enriching flows ${count}`
  if (progress.phase === 'complete') return `${progress.loaded.toLocaleString()} resources ready`
  return `Reading inventory ${count}`
}

function sectionTitle(section: Section): string {
  return NAVIGATION.find((item) => item.id === section)?.label ?? 'Overview'
}

function App() {
  const [snapshot, setSnapshot] = useState<InventorySnapshot>()
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [progress, setProgress] = useState<InventoryLoadProgress>(EMPTY_PROGRESS)
  const [error, setError] = useState<string>()
  const [section, setSection] = useState<Section>('overview')
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [environmentFilter, setEnvironmentFilter] = useState('all')
  const [environmentTypeFilter, setEnvironmentTypeFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>('all')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [flowStatusFilter, setFlowStatusFilter] = useState<FlowStatus | 'all'>('all')
  const [flowTriggerTypeFilter, setFlowTriggerTypeFilter] = useState<FlowTriggerType | 'all'>('all')
  const [createdYearFilter, setCreatedYearFilter] = useState('all')
  const [connectorFilter, setConnectorFilter] = useState('all')
  const [flowLicenseFilter, setFlowLicenseFilter] = useState<FlowLicenseFilter>('all')
  const [agentKindFilter, setAgentKindFilter] = useState<AgentKind | 'all'>('all')
  const [agentMakerFilter, setAgentMakerFilter] = useState('all')
  const [agentDepartmentFilter, setAgentDepartmentFilter] = useState('all')
  const [agentFlowUsageFilter, setAgentFlowUsageFilter] = useState<AgentFlowUsage | 'all'>('all')
  const [appKindFilter, setAppKindFilter] = useState<AppKind | 'all'>('all')
  const [agentHarnessFilter, setAgentHarnessFilter] = useState<AgentHarness | 'all'>('all')
  const [agentPublishedFilter, setAgentPublishedFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [agentConnectorCountFilter, setAgentConnectorCountFilter] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset>()
  const snapshotRef = useRef<InventorySnapshot | undefined>(undefined)
  const requestIdRef = useRef(0)
  const initialLoadStarted = useRef(false)
  const deferredSearch = useDeferredValue(search)

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const hasData = Boolean(snapshotRef.current)
    setStatus(hasData ? 'refreshing' : 'loading')
    setError(undefined)
    setProgress(EMPTY_PROGRESS)
    console.log(`Power Platform 360: ${hasData ? 'refreshing' : 'loading'} inventory`)

    try {
      const nextSnapshot = await loadInventory(setProgress)
      if (requestId !== requestIdRef.current) return
      snapshotRef.current = nextSnapshot
      startTransition(() => {
        setSnapshot(nextSnapshot)
        setStatus('idle')
      })
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      const message = loadError instanceof Error
        ? loadError.message
        : 'The inventory could not be loaded.'
      console.error('Power Platform 360: inventory load failed', loadError)
      setError(message)
      setStatus(hasData ? 'idle' : 'error')
    }
  }, [])

  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    void refresh()
  }, [refresh])

  const allAssets = snapshot?.assets ?? []
  const platformResources = allAssets.filter((asset) => (
    asset.category === 'apps' || asset.category === 'flows' || asset.category === 'agents'
  ))
  const sectionAssets = section === 'overview'
    ? platformResources
    : section === 'environmentGroups'
      ? allAssets.filter((asset) => asset.type === RESOURCE_TYPES.environmentGroup)
      : section === 'environments'
        ? allAssets.filter((asset) => asset.type === RESOURCE_TYPES.environment)
        : allAssets.filter((asset) => asset.category === section)
  const visibleAssets = filterAssets(sectionAssets, {
    search: deferredSearch,
    type: typeFilter,
    environment: environmentFilter,
    environmentType: environmentTypeFilter,
    region: regionFilter,
    freshness: freshnessFilter,
    risk: riskFilter,
    flowStatus: flowStatusFilter,
    flowTriggerType: flowTriggerTypeFilter,
    createdYear: createdYearFilter,
    connector: connectorFilter,
    flowLicense: flowLicenseFilter,
    agentKind: agentKindFilter,
    agentMakerId: agentMakerFilter,
    agentDepartment: agentDepartmentFilter,
    agentFlowUsage: agentFlowUsageFilter,
    appKind: appKindFilter,
    agentHarness: agentHarnessFilter,
    agentPublished: agentPublishedFilter,
    agentConnectorCount: agentConnectorCountFilter,
  })
  const typeOptions = [...new Map(
    sectionAssets.map((asset) => [asset.type, asset.subtype ?? asset.typeLabel]),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1]))
  const environmentOptions = [...new Map(
    sectionAssets
      .filter((asset) => asset.environmentId)
      .map((asset) => [asset.environmentId!, asset.environmentName ?? asset.environmentId!]),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1]))
  const environmentTypeOptions = [...new Set(
    allAssets
      .filter((asset) => asset.type === RESOURCE_TYPES.environment)
      .map((asset) => asset.environmentType ?? 'Unknown'),
  )].sort()
  const regionOptions = [...new Set(
    sectionAssets.map((asset) => asset.location ?? 'Unknown'),
  )].sort()
  const flowYearOptions = [...new Set(
    sectionAssets.map((asset) => asset.createdAt?.slice(0, 4)).filter((year): year is string => Boolean(year)),
  )].sort((left, right) => right.localeCompare(left))
  const flowConnectorOptions = [...new Map(
    sectionAssets.flatMap((asset) => asset.connectors.map((connector) => [connector.id, connector.displayName] as const)),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1]))
  const agentMakerOptions = [...new Map(
    sectionAssets
      .filter((asset) => (asset.creatorId || asset.ownerId) && !asset.creator?.isSystem && !asset.owner?.isSystem)
      .map((asset) => [
        asset.creatorId ?? asset.ownerId!,
        personName(asset.creator ?? asset.owner, asset.creatorId ?? asset.ownerId),
      ]),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1]))
  const agentDepartmentOptions = [...new Set(
    sectionAssets.map((asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available'),
  )].sort()
  const activeFilterCount = [
    typeFilter,
    environmentFilter,
    environmentTypeFilter,
    regionFilter,
    freshnessFilter,
    riskFilter,
    flowStatusFilter,
    flowTriggerTypeFilter,
    createdYearFilter,
    connectorFilter,
    flowLicenseFilter,
    agentKindFilter,
    agentMakerFilter,
    agentDepartmentFilter,
    agentFlowUsageFilter,
    appKindFilter,
    agentHarnessFilter,
    agentPublishedFilter,
    agentConnectorCountFilter,
  ]
    .filter((value) => value !== 'all').length + (search.trim() ? 1 : 0)
  const staleCount = sectionAssets.filter((asset) => getFreshness(asset) === 'stale').length
  const quarantinedCount = sectionAssets.filter((asset) => asset.isQuarantined).length
  const orphanedCount = sectionAssets.filter(isOrphaned).length
  const premiumCount = sectionAssets.filter(usesPremiumConnector).length
  const deprecatedCount = sectionAssets.filter(usesDeprecatedConnector).length
  const environmentCount = allAssets.filter((asset) => asset.type === RESOURCE_TYPES.environment).length
  const environmentGroupCount = allAssets.filter((asset) => asset.type === RESOURCE_TYPES.environmentGroup).length
  const makerCount = new Set(
    platformResources
      .filter((asset) => asset.creatorId && !asset.creator?.isSystem)
      .map((asset) => asset.creatorId),
  ).size
  const totalQuarantinedCount = platformResources.filter((asset) => asset.isQuarantined).length
  const appDrilldownLabels = [
    appKindFilter !== 'all' ? `App kind: ${appKindFilter}` : undefined,
    agentMakerFilter !== 'all'
      ? `Maker: ${agentMakerOptions.find(([id]) => id === agentMakerFilter)?.[1] ?? agentMakerFilter}`
      : undefined,
    environmentFilter !== 'all'
      ? `Environment: ${environmentOptions.find(([id]) => id === environmentFilter)?.[1] ?? environmentFilter}`
      : undefined,
    createdYearFilter !== 'all' ? `Created: ${createdYearFilter}` : undefined,
    flowLicenseFilter !== 'all' ? `License: ${flowLicenseFilter === 'premium' ? 'Premium' : 'Standard'}` : undefined,
    agentDepartmentFilter !== 'all' ? `Department: ${agentDepartmentFilter}` : undefined,
  ].filter((label): label is string => Boolean(label))
  const flowDrilldownLabels = [
    flowStatusFilter !== 'all' ? `Status: ${flowStatusFilter}` : undefined,
    flowTriggerTypeFilter !== 'all' ? `Trigger: ${flowTriggerTypeFilter}` : undefined,
    environmentFilter !== 'all'
      ? `Environment: ${environmentOptions.find(([id]) => id === environmentFilter)?.[1] ?? environmentFilter}`
      : undefined,
    createdYearFilter !== 'all' ? `Created: ${createdYearFilter}` : undefined,
    connectorFilter !== 'all'
      ? `Connector: ${flowConnectorOptions.find(([id]) => id === connectorFilter)?.[1] ?? connectorFilter}`
      : undefined,
    flowLicenseFilter !== 'all' ? `Connector tier: ${flowLicenseFilter === 'premium' ? 'Premium' : 'Standard'}` : undefined,
  ].filter((label): label is string => Boolean(label))
  const isBusy = status === 'loading' || status === 'refreshing'

  function clearFilters(): void {
    setSearch('')
    setTypeFilter('all')
    setEnvironmentFilter('all')
    setEnvironmentTypeFilter('all')
    setRegionFilter('all')
    setFreshnessFilter('all')
    setRiskFilter('all')
    setFlowStatusFilter('all')
    setFlowTriggerTypeFilter('all')
    setCreatedYearFilter('all')
    setConnectorFilter('all')
    setFlowLicenseFilter('all')
    setAgentKindFilter('all')
    setAgentMakerFilter('all')
    setAgentDepartmentFilter('all')
    setAgentFlowUsageFilter('all')
    setAppKindFilter('all')
    setAgentHarnessFilter('all')
    setAgentPublishedFilter('all')
    setAgentConnectorCountFilter('all')
  }

  function navigate(nextSection: Section): void {
    setSection(nextSection)
    if (nextSection === 'apps') setViewMode('dashboard')
    if (nextSection === 'flows') setViewMode('dashboard')
    if (nextSection === 'agents') setViewMode('dashboard')
    setTypeFilter('all')
    setEnvironmentFilter('all')
    setEnvironmentTypeFilter('all')
    setRegionFilter('all')
    setFreshnessFilter('all')
    setRiskFilter('all')
    setFlowStatusFilter('all')
    setFlowTriggerTypeFilter('all')
    setCreatedYearFilter('all')
    setConnectorFilter('all')
    setFlowLicenseFilter('all')
    setAgentKindFilter('all')
    setAgentMakerFilter('all')
    setAgentDepartmentFilter('all')
    setAgentFlowUsageFilter('all')
    setAppKindFilter('all')
    setAgentHarnessFilter('all')
    setAgentPublishedFilter('all')
    setAgentConnectorCountFilter('all')
  }

  function selectType(type: string): void {
    if (type === 'apps' || type === 'flows' || type === 'agents') {
      setSection(type)
      setTypeFilter('all')
      setViewMode('inventory')
      return
    }
    const matchingAsset = allAssets.find((asset) => asset.type === type)
    if (type === RESOURCE_TYPES.environmentGroup) {
      setSection('environmentGroups')
    } else if (matchingAsset) {
      setSection(matchingAsset.category)
    }
    setTypeFilter(type)
    setViewMode('inventory')
  }

  function selectEnvironment(environmentId: string): void {
    setEnvironmentFilter(environmentId)
    setViewMode('inventory')
  }

  function selectEnvironmentType(environmentType: string): void {
    setSection('environments')
    setEnvironmentTypeFilter(environmentType)
    setViewMode('inventory')
  }

  function selectRegion(region: string): void {
    setRegionFilter(region)
    setViewMode('inventory')
  }

  function applyRisk(nextRisk: RiskFilter): void {
    setRiskFilter(nextRisk)
    setViewMode('inventory')
  }

  function selectFlowStatus(nextStatus: FlowStatus): void {
    setFlowStatusFilter(nextStatus)
    setViewMode('inventory')
  }

  function selectOverviewFlowStatus(nextStatus: FlowStatus): void {
    setSection('flows')
    setFlowStatusFilter(nextStatus)
    setViewMode('inventory')
  }

  function selectFlowTrigger(nextTrigger: FlowTriggerType): void {
    setFlowTriggerTypeFilter(nextTrigger)
    setViewMode('inventory')
  }

  function selectCreatedYear(year: string): void {
    setCreatedYearFilter(year)
    setViewMode('inventory')
  }

  function selectConnector(connectorId: string): void {
    setConnectorFilter(connectorId)
    setViewMode('inventory')
  }

  function selectFlowLicense(premium: boolean): void {
    setFlowLicenseFilter(premium ? 'premium' : 'standard')
    setViewMode('inventory')
  }

  function selectAgentKind(kind: AgentKind): void {
    setAgentKindFilter(kind)
    setViewMode('inventory')
  }

  function selectAgentMaker(makerId: string): void {
    setAgentMakerFilter(makerId)
    setViewMode('inventory')
  }

  function selectAgentDepartment(department: string): void {
    setAgentDepartmentFilter(department)
    setViewMode('inventory')
  }

  function selectAgentHarness(harness: AgentHarness): void {
    setAgentHarnessFilter(harness)
    setViewMode('inventory')
  }

  function selectAgentPublication(published: boolean): void {
    setAgentPublishedFilter(published ? 'published' : 'draft')
    setViewMode('inventory')
  }

  function selectAgentConnectorCount(count: number): void {
    setAgentConnectorCountFilter(String(count))
    setViewMode('inventory')
  }

  function selectAppKind(kind: AppKind): void {
    setAppKindFilter(kind)
    setViewMode('inventory')
  }

  function selectAppLicense(license: 'Premium' | 'Standard'): void {
    setFlowLicenseFilter(license === 'Premium' ? 'premium' : 'standard')
    setViewMode('inventory')
  }

  function clearAppDrilldown(): void {
    setAppKindFilter('all')
    setAgentMakerFilter('all')
    setEnvironmentFilter('all')
    setCreatedYearFilter('all')
    setFlowLicenseFilter('all')
    setAgentDepartmentFilter('all')
  }

  function clearFlowDrilldown(): void {
    setFlowStatusFilter('all')
    setFlowTriggerTypeFilter('all')
    setEnvironmentFilter('all')
    setCreatedYearFilter('all')
    setConnectorFilter('all')
    setFlowLicenseFilter('all')
  }

  function categoryCount(category: Section): number {
    if (category === 'overview') return platformResources.length
    if (category === 'environmentGroups') return environmentGroupCount
    if (category === 'environments') return environmentCount
    return allAssets.filter((asset) => asset.category === category).length
  }

  return (
    <div className="app-shell">
      <div className="product-chrome">
        <header className="product-header">
          <div className="product-brand">
            <WorkloadIcon workload="overview" className="product-logo" />
            <strong>Power Platform 360</strong>
            <span>Tenant inventory explorer</span>
          </div>
          <div className="product-status" aria-live="polite">
            <span>
              {isBusy
                ? progressText(progress)
                : `${allAssets.length.toLocaleString()} loaded · ${(snapshot?.totalRecords ?? 0).toLocaleString()} total`}
            </span>
            <span className="user-avatar" aria-label="Administrator account">AD</span>
          </div>
        </header>
        <nav className="workload-tabs" aria-label="Inventory workloads">
          {NAVIGATION.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`workload-tab workload-tab--${item.id} ${section === item.id ? 'workload-tab--active' : ''}`}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <WorkloadIcon workload={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <main className="main-content">
        <div className="page-heading">
          <div className="page-heading__copy">
            <p className="eyebrow">Power Platform inventory</p>
            <h1>{sectionTitle(section)}</h1>
            <p>
              {section === 'overview'
                ? 'Apps, flows, agents, makers, environments, and governance signals across the tenant.'
                : `Inspect and govern ${sectionTitle(section).toLowerCase()} across the tenant.`}
            </p>
          </div>
          <div className="heading-actions">
            <div className="view-switch" role="group" aria-label="View mode">
              <Button
                appearance={viewMode === 'dashboard' ? 'primary' : 'subtle'}
                icon={<Grid20Regular />}
                onClick={() => setViewMode('dashboard')}
              >
                Dashboard
              </Button>
              <Button
                appearance={viewMode === 'inventory' ? 'primary' : 'subtle'}
                icon={<List20Regular />}
                onClick={() => setViewMode('inventory')}
              >
                Inventory
              </Button>
            </div>
            {!(section === 'apps' && viewMode === 'inventory') && (
              <Button
                appearance="secondary"
                icon={<ArrowDownload20Regular />}
                disabled={visibleAssets.length === 0}
                onClick={() => exportInventoryCsv(visibleAssets)}
              >
                Export
              </Button>
            )}
            <Button
              appearance="primary"
              icon={<ArrowSync20Regular className={status === 'refreshing' ? 'spin' : undefined} />}
              disabled={isBusy}
              onClick={() => void refresh()}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="load-status">Updated {formatDateTime(snapshot?.loadedAt)} · Inventory API</div>

        {error && (
          <div className="error-banner" role="alert">
            <Warning20Regular />
            <span>
              <strong>Inventory connection failed</strong>
              <small>{error}</small>
            </span>
            <Button appearance="secondary" onClick={() => void refresh()}>Try again</Button>
          </div>
        )}

        {!snapshot && status !== 'error' ? (
          <div className="initial-loader">
            <Spinner size="huge" label={progressText(progress)} />
            <p>The app is reading the latest tenant inventory.</p>
          </div>
        ) : snapshot ? (
          <>
            {section === 'overview' ? (
              <section className="stat-grid stat-grid--overview" aria-label="Tenant inventory summary">
                <button type="button" className="stat-card stat-card--total" onClick={() => setViewMode('inventory')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="overview" /> Total resources</span>
                  <strong>{platformResources.length.toLocaleString()}</strong>
                  <small>apps · flows · agents</small>
                </button>
                <button type="button" className="stat-card stat-card--apps" onClick={() => navigate('apps')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="apps" /> Apps</span>
                  <strong>{categoryCount('apps').toLocaleString()}</strong>
                  <small>{Math.round((categoryCount('apps') / Math.max(platformResources.length, 1)) * 100)}% of total</small>
                </button>
                <button type="button" className="stat-card stat-card--flows" onClick={() => navigate('flows')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="flows" /> Flows</span>
                  <strong>{categoryCount('flows').toLocaleString()}</strong>
                  <small>{Math.round((categoryCount('flows') / Math.max(platformResources.length, 1)) * 100)}% of total</small>
                </button>
                <button type="button" className="stat-card stat-card--agents" onClick={() => navigate('agents')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="agents" /> Agents</span>
                  <strong>{categoryCount('agents').toLocaleString()}</strong>
                  <small>{Math.round((categoryCount('agents') / Math.max(platformResources.length, 1)) * 100)}% of total</small>
                </button>
                <button type="button" className="stat-card stat-card--environments" onClick={() => navigate('environments')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="environments" /> Environments</span>
                  <strong>{environmentCount.toLocaleString()}</strong>
                  <small>in tenant</small>
                </button>
                <button type="button" className="stat-card stat-card--groups" onClick={() => navigate('environmentGroups')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="environmentGroups" /> Env groups</span>
                  <strong>{environmentGroupCount.toLocaleString()}</strong>
                  <small>in tenant</small>
                </button>
                <button type="button" className="stat-card stat-card--makers" onClick={() => setViewMode('dashboard')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="overview" /> Makers</span>
                  <strong>{makerCount.toLocaleString()}</strong>
                  <small>unique creators</small>
                </button>
                <button type="button" className="stat-card stat-card--quarantined" onClick={() => applyRisk('quarantined')}>
                  <span className="stat-card__heading"><Warning20Regular /> Quarantined</span>
                  <strong>{totalQuarantinedCount.toLocaleString()}</strong>
                  <small>flagged apps</small>
                </button>
              </section>
            ) : (
              ((section === 'flows' || section === 'agents' || section === 'apps') && viewMode === 'dashboard') ||
              (section === 'apps' && viewMode === 'inventory')
            ) ? null : (
              <section className="stat-grid" aria-label="Inventory summary">
                <button type="button" className="stat-card stat-card--primary" onClick={() => setViewMode('inventory')}>
                  <span className="stat-card__heading"><WorkloadIcon workload={section} /> Total in view</span>
                  <strong>{sectionAssets.length.toLocaleString()}</strong>
                  <small>{visibleAssets.length.toLocaleString()} match current filters</small>
                </button>
                <button type="button" className="stat-card" onClick={() => {
                  setFreshnessFilter('stale')
                  setViewMode('inventory')
                }}>
                  <span className="stat-card__heading"><Warning20Regular /> Stale resources</span>
                  <strong>{staleCount.toLocaleString()}</strong>
                  <small>Not modified for over 180 days</small>
                </button>
                <button type="button" className="stat-card" onClick={() => applyRisk('orphaned')}>
                  <span className="stat-card__heading"><Warning20Regular /> Owners unresolved</span>
                  <strong>{orphanedCount.toLocaleString()}</strong>
                  <small>Review ownership continuity</small>
                </button>
                <button type="button" className="stat-card" onClick={() => applyRisk('premium')}>
                  <span className="stat-card__heading"><WorkloadIcon workload="connectors" /> Premium exposure</span>
                  <strong>{premiumCount.toLocaleString()}</strong>
                  <small>Resources using premium connectors</small>
                </button>
              </section>
            )}

            {(quarantinedCount > 0 || deprecatedCount > 0) && section !== 'apps' && (
              <div className="governance-strip">
                <Warning20Regular />
                <span>
                  <strong>Governance attention</strong>
                  <small>
                    {quarantinedCount.toLocaleString()} quarantined · {deprecatedCount.toLocaleString()} using deprecated connectors
                  </small>
                </span>
                <div>
                  {quarantinedCount > 0 && (
                    <Button appearance="subtle" onClick={() => applyRisk('quarantined')}>View quarantined</Button>
                  )}
                  {deprecatedCount > 0 && (
                    <Button appearance="subtle" onClick={() => applyRisk('deprecated')}>View deprecated</Button>
                  )}
                </div>
              </div>
            )}

            {viewMode === 'dashboard' ? (
              section === 'overview' ? (
                <OverviewDashboard
                  resources={visibleAssets}
                  environments={allAssets.filter((asset) => asset.type === RESOURCE_TYPES.environment)}
                  onCategorySelect={(category) => selectType(category)}
                  onYearSelect={selectCreatedYear}
                  onMakerSelect={selectAgentMaker}
                  onFlowStatusSelect={selectOverviewFlowStatus}
                  onEnvironmentSelect={selectEnvironment}
                  onEnvironmentTypeSelect={selectEnvironmentType}
                  onRegionSelect={selectRegion}
                  onConnectorSelect={selectConnector}
                  onLicenseSelect={selectFlowLicense}
                  onDepartmentSelect={selectAgentDepartment}
                />
              ) : section === 'apps' ? (
                <AppsDashboard
                  assets={sectionAssets}
                  onKindSelect={selectAppKind}
                  onMakerSelect={selectAgentMaker}
                  onEnvironmentSelect={selectEnvironment}
                  onYearSelect={selectCreatedYear}
                  onLicenseSelect={selectAppLicense}
                  onDepartmentSelect={selectAgentDepartment}
                />
              ) : section === 'flows' ? (
                <FlowDashboard
                  assets={visibleAssets}
                  onStatusSelect={selectFlowStatus}
                  onTriggerSelect={selectFlowTrigger}
                  onEnvironmentSelect={selectEnvironment}
                  onYearSelect={selectCreatedYear}
                  onPremiumSelect={selectFlowLicense}
                  onConnectorSelect={selectConnector}
                />
              ) : section === 'agents' ? (
                <AgentDashboard
                  assets={visibleAssets}
                  onKindSelect={selectAgentKind}
                  onMakerSelect={selectAgentMaker}
                  onEnvironmentSelect={selectEnvironment}
                  onMonthSelect={selectCreatedYear}
                  onPublishedSelect={selectAgentPublication}
                  onHarnessSelect={selectAgentHarness}
                  onConnectorSelect={selectConnector}
                  onConnectorCountSelect={selectAgentConnectorCount}
                  onDepartmentSelect={selectAgentDepartment}
                />
              ) : (
                <InventoryCharts
                  assets={visibleAssets}
                  onTypeSelect={selectType}
                  onEnvironmentSelect={selectEnvironment}
                />
              )
            ) : (
              section === 'apps' ? (
                <AppsInventory
                  assets={visibleAssets}
                  drilldownLabels={appDrilldownLabels}
                  onClearDrilldown={clearAppDrilldown}
                  onSelect={setSelectedAsset}
                />
              ) : section === 'flows' ? (
                <FlowsInventory
                  assets={visibleAssets}
                  drilldownLabels={flowDrilldownLabels}
                  onClearDrilldown={clearFlowDrilldown}
                  onSelect={setSelectedAsset}
                />
              ) : <>
                <section className="filter-bar" aria-label="Inventory filters">
                  <label className="filter-control filter-control--search">
                    <span>Search</span>
                    <Input
                      value={search}
                      contentBefore={<Search20Regular />}
                      placeholder="Name, owner, connector, ID"
                      onChange={(_, data) => setSearch(data.value)}
                    />
                  </label>
                  <label className="filter-control">
                    <span>Resource type</span>
                    <Select value={typeFilter} onChange={(_, data) => setTypeFilter(data.value)}>
                      <option value="all">All types</option>
                      {typeOptions.map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="filter-control">
                    <span>Environment</span>
                    <Select value={environmentFilter} onChange={(_, data) => setEnvironmentFilter(data.value)}>
                      <option value="all">All environments</option>
                      {environmentOptions.map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="filter-control">
                    <span>Activity</span>
                    <Select
                      value={freshnessFilter}
                      onChange={(_, data) => setFreshnessFilter(data.value as FreshnessFilter)}
                    >
                      <option value="all">Any activity</option>
                      <option value="current">Current (0-90 days)</option>
                      <option value="aging">Aging (91-180 days)</option>
                      <option value="stale">Stale (180+ days)</option>
                      <option value="unknown">Unknown</option>
                    </Select>
                  </label>
                  <label className="filter-control">
                    <span>Governance</span>
                    <Select
                      value={riskFilter}
                      onChange={(_, data) => setRiskFilter(data.value as RiskFilter)}
                    >
                      <option value="all">All signals</option>
                      <option value="quarantined">Quarantined</option>
                      <option value="orphaned">Owner unresolved</option>
                      <option value="premium">Premium connector</option>
                      <option value="deprecated">Deprecated connector</option>
                    </Select>
                  </label>
                  {section === 'agents' && (
                    <>
                      <label className="filter-control">
                        <span>Agent kind</span>
                        <Select
                          value={agentKindFilter}
                          onChange={(_, data) => setAgentKindFilter(data.value as AgentKind | 'all')}
                        >
                          <option value="all">All agent kinds</option>
                          <option value="Copilot Studio Agent">Copilot Studio Agent</option>
                          <option value="Agent Builder">Agent Builder</option>
                          <option value="Unknown">Unknown</option>
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Maker</span>
                        <Select value={agentMakerFilter} onChange={(_, data) => setAgentMakerFilter(data.value)}>
                          <option value="all">All makers</option>
                          {agentMakerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Department</span>
                        <Select value={agentDepartmentFilter} onChange={(_, data) => setAgentDepartmentFilter(data.value)}>
                          <option value="all">All departments</option>
                          {agentDepartmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Harness</span>
                        <Select
                          value={agentHarnessFilter}
                          onChange={(_, data) => setAgentHarnessFilter(data.value as AgentHarness | 'all')}
                        >
                          <option value="all">All harnesses</option>
                          <option value="GitHub Copilot">GitHub Copilot</option>
                          <option value="Standard">Standard</option>
                          <option value="Copilot Chat">Copilot Chat</option>
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Publication</span>
                        <Select
                          value={agentPublishedFilter}
                          onChange={(_, data) => setAgentPublishedFilter(data.value as 'all' | 'published' | 'draft')}
                        >
                          <option value="all">Any publication state</option>
                          <option value="published">Published</option>
                          <option value="draft">Draft / not published</option>
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Connector count</span>
                        <Select
                          value={agentConnectorCountFilter}
                          onChange={(_, data) => setAgentConnectorCountFilter(data.value)}
                        >
                          <option value="all">Any connector count</option>
                          {[...new Set(sectionAssets.map((asset) => asset.connectors.length))]
                            .sort((left, right) => left - right)
                            .map((count) => <option key={count} value={count}>{count}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Created year</span>
                        <Select value={createdYearFilter} onChange={(_, data) => setCreatedYearFilter(data.value)}>
                          <option value="all">All years</option>
                          {flowYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                        </Select>
                      </label>
                    </>
                  )}
                  {section === 'overview' && (
                    <>
                      <label className="filter-control">
                        <span>Maker</span>
                        <Select value={agentMakerFilter} onChange={(_, data) => setAgentMakerFilter(data.value)}>
                          <option value="all">All makers</option>
                          {agentMakerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Department</span>
                        <Select value={agentDepartmentFilter} onChange={(_, data) => setAgentDepartmentFilter(data.value)}>
                          <option value="all">All departments</option>
                          {agentDepartmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Created year</span>
                        <Select value={createdYearFilter} onChange={(_, data) => setCreatedYearFilter(data.value)}>
                          <option value="all">All years</option>
                          {flowYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Region</span>
                        <Select value={regionFilter} onChange={(_, data) => setRegionFilter(data.value)}>
                          <option value="all">All regions</option>
                          {regionOptions.map((region) => <option key={region} value={region}>{region}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Environment type</span>
                        <Select
                          value={environmentTypeFilter}
                          onChange={(_, data) => setEnvironmentTypeFilter(data.value)}
                        >
                          <option value="all">All environment types</option>
                          {environmentTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Connector</span>
                        <Select value={connectorFilter} onChange={(_, data) => setConnectorFilter(data.value)}>
                          <option value="all">All connectors</option>
                          {flowConnectorOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </Select>
                      </label>
                      <label className="filter-control">
                        <span>Licensing</span>
                        <Select
                          value={flowLicenseFilter}
                          onChange={(_, data) => setFlowLicenseFilter(data.value as FlowLicenseFilter)}
                        >
                          <option value="all">Any classification</option>
                          <option value="premium">Premium</option>
                          <option value="standard">Standard</option>
                        </Select>
                      </label>
                    </>
                  )}
                  <div className="filter-summary">
                    <Badge appearance="tint">{visibleAssets.length.toLocaleString()} results</Badge>
                    {activeFilterCount > 0 && (
                      <Button appearance="subtle" icon={<Dismiss20Regular />} onClick={clearFilters}>
                        Clear {activeFilterCount}
                      </Button>
                    )}
                  </div>
                </section>
                <InventoryTable assets={visibleAssets} onSelect={setSelectedAsset} />
              </>
            )}
          </>
        ) : null}
      </main>

      <AssetDrawer
        key={selectedAsset?.id ?? 'closed'}
        asset={selectedAsset}
        onClose={() => setSelectedAsset(undefined)}
      />
    </div>
  )
}

export default App
