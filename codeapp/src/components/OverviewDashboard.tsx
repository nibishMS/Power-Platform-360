import { Badge } from '@fluentui/react-components'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  AssetCategory,
  FlowStatus,
  InventoryAsset,
} from '../inventory/types'
import { personName, usesPremiumConnector } from '../inventory/selectors'

interface OverviewDashboardProps {
  resources: InventoryAsset[]
  environments: InventoryAsset[]
  onCategorySelect: (category: AssetCategory) => void
  onYearSelect: (year: string) => void
  onMakerSelect: (makerId: string) => void
  onFlowStatusSelect: (status: FlowStatus) => void
  onEnvironmentSelect: (environmentId: string) => void
  onEnvironmentTypeSelect: (environmentType: string) => void
  onRegionSelect: (region: string) => void
  onConnectorSelect: (connectorId: string) => void
  onLicenseSelect: (premium: boolean) => void
  onDepartmentSelect: (department: string) => void
}

interface OverviewDatum {
  key: string
  name: string
  value: number
  color?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  apps: 'var(--cp-apps)',
  flows: 'var(--cp-flows)',
  agents: 'var(--cp-agents)',
}
const FLOW_STATUS_COLORS: Record<string, string> = {
  Activated: 'var(--cp-success)',
  Deactivated: 'var(--cp-danger)',
  Suspended: 'var(--cp-warning)',
  Unknown: 'var(--cp-text-muted)',
}
const ENVIRONMENT_COLORS = [
  'var(--cp-text-muted)',
  'var(--cp-flows)',
  'var(--cp-agents)',
  'var(--cp-apps)',
  'var(--cp-warning)',
  'var(--cp-connectors)',
]

function tooltipStyle() {
  return {
    background: 'var(--cp-surface)',
    border: '1px solid var(--cp-border)',
    borderRadius: '6px',
    color: 'var(--cp-text)',
  }
}

function countBy(
  assets: InventoryAsset[],
  getKey: (asset: InventoryAsset) => string | undefined,
  getName: (asset: InventoryAsset) => string | undefined,
  limit = 8,
): OverviewDatum[] {
  const counts = new Map<string, OverviewDatum>()
  for (const asset of assets) {
    const key = getKey(asset)
    if (!key) continue
    const current = counts.get(key)
    if (current) current.value += 1
    else counts.set(key, { key, name: getName(asset) ?? key, value: 1 })
  }
  return [...counts.values()].sort((left, right) => right.value - left.value).slice(0, limit)
}

function countDistinctConnectors(assets: InventoryAsset[]): OverviewDatum[] {
  const usage = new Map<string, { name: string; resources: Set<string> }>()
  for (const asset of assets) {
    for (const connector of asset.connectors) {
      const current = usage.get(connector.id)
      if (current) current.resources.add(asset.id)
      else usage.set(connector.id, { name: connector.displayName, resources: new Set([asset.id]) })
    }
  }
  return [...usage.entries()]
    .map(([key, item]) => ({ key, name: item.name, value: item.resources.size }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 10)
}

function createdTrend(assets: InventoryAsset[]) {
  const counts = new Map<string, number>()
  for (const asset of assets) {
    const year = asset.createdAt?.slice(0, 4)
    if (year && /^\d{4}$/.test(year)) counts.set(year, (counts.get(year) ?? 0) + 1)
  }
  let cumulative = 0
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, count]) => {
      cumulative += count
      return { year, count, cumulative }
    })
}

function OverviewDonut({
  title,
  subtitle,
  badge,
  total,
  centerLabel,
  data,
  onSelect,
}: {
  title: string
  subtitle: string
  badge: string
  total: number
  centerLabel: string
  data: OverviewDatum[]
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel overview-panel" aria-label={title}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Badge appearance="tint">{badge}</Badge>
      </div>
      <div className="flow-donut-layout">
        <div className="flow-donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={1}
                stroke="var(--cp-surface)"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    className="chart-cell"
                    onClick={() => onSelect(entry.key)}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flow-donut-center" aria-hidden="true">
            <strong>{total.toLocaleString()}</strong>
            <span>{centerLabel}</span>
          </div>
        </div>
        <div className="flow-legend">
          {data.map((entry) => (
            <button type="button" key={entry.key} onClick={() => onSelect(entry.key)}>
              <span className="legend-swatch" style={{ background: entry.color }} />
              <span>{entry.name}</span>
              <strong>{entry.value.toLocaleString()}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function OverviewBars({
  title,
  subtitle,
  badge,
  data,
  color,
  onSelect,
}: {
  title: string
  subtitle: string
  badge: string
  data: OverviewDatum[]
  color: string
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel overview-panel" aria-label={title}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Badge appearance="tint">{badge}</Badge>
      </div>
      <div className="flow-chart-canvas">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 28 }} accessibilityLayer>
              <CartesianGrid stroke="var(--cp-border)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: 'var(--cp-text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: 'var(--cp-accent-soft)' }} contentStyle={tooltipStyle()} />
              <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: 'var(--cp-text-muted)', fontSize: 11 }}>
                {data.map((entry) => (
                  <Cell key={entry.key} className="chart-cell" onClick={() => onSelect(entry.key)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-compact">No data available.</div>
        )}
      </div>
    </section>
  )
}

export function OverviewDashboard({
  resources,
  environments,
  onCategorySelect,
  onYearSelect,
  onMakerSelect,
  onFlowStatusSelect,
  onEnvironmentSelect,
  onEnvironmentTypeSelect,
  onRegionSelect,
  onConnectorSelect,
  onLicenseSelect,
  onDepartmentSelect,
}: OverviewDashboardProps) {
  const flows = resources.filter((asset) => asset.category === 'flows')
  const appsAndFlows = resources.filter((asset) => asset.category === 'apps' || asset.category === 'flows')
  const composition = countBy(
    resources,
    (asset) => asset.category,
    (asset) => `${asset.category.slice(0, 1).toUpperCase()}${asset.category.slice(1)}`,
    3,
  ).map((item) => ({ ...item, color: CATEGORY_COLORS[item.key] }))
  const makers = countBy(
    resources,
    (asset) => asset.creatorId ?? asset.ownerId,
    (asset) => personName(asset.creator ?? asset.owner, asset.creatorId ?? asset.ownerId),
    6,
  )
  const flowStatuses = countBy(
    flows,
    (asset) => asset.flowStatus ?? 'Unknown',
    (asset) => asset.flowStatus ?? 'Unknown',
    4,
  ).map((item) => ({ ...item, color: FLOW_STATUS_COLORS[item.key] ?? 'var(--cp-text-muted)' }))
  const topEnvironments = countBy(
    resources,
    (asset) => asset.environmentId,
    (asset) => asset.environmentName,
    8,
  )
  const environmentTypes = countBy(
    environments,
    (asset) => asset.environmentType ?? 'Unknown',
    (asset) => asset.environmentType ?? 'Unknown',
    8,
  ).map((item, index) => ({ ...item, color: ENVIRONMENT_COLORS[index % ENVIRONMENT_COLORS.length] }))
  const regions = countBy(resources, (asset) => asset.location ?? 'Unknown', (asset) => asset.location ?? 'Unknown', 8)
  const connectors = countDistinctConnectors(appsAndFlows)
  const premiumCount = appsAndFlows.filter(usesPremiumConnector).length
  const standardCount = appsAndFlows.filter((asset) => asset.connectors.length > 0 && !usesPremiumConnector(asset)).length
  const unknownLicense = appsAndFlows.length - premiumCount - standardCount
  const licenseData: OverviewDatum[] = [
    { key: 'premium', name: 'Premium', value: premiumCount, color: 'var(--cp-warning)' },
    { key: 'standard', name: 'Standard', value: standardCount, color: 'var(--cp-text-muted)' },
    { key: 'unknown', name: 'Unknown', value: unknownLicense, color: 'var(--cp-border-strong)' },
  ].filter((item) => item.value > 0)
  const departments = countBy(
    resources,
    (asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available',
    (asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available',
    8,
  )
  const trend = createdTrend(resources)

  return (
    <div className="overview-dashboard-grid">
      <OverviewDonut
        title="Resource composition"
        subtitle="Apps, flows, and agents — select to drill in"
        badge="Inventory API"
        total={resources.length}
        centerLabel="resources"
        data={composition}
        onSelect={(key) => onCategorySelect(key as AssetCategory)}
      />

      <section className="chart-panel overview-panel" aria-label="Adoption over time">
        <div className="panel-heading">
          <div>
            <h2>Adoption over time</h2>
            <p>New apps, flows, and agents per year and cumulative total</p>
          </div>
          <Badge appearance="tint">Inventory API</Badge>
        </div>
        <div className="flow-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
              <CartesianGrid stroke="var(--cp-border)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--cp-text-muted)" />
              <YAxis allowDecimals={false} stroke="var(--cp-text-muted)" />
              <Tooltip contentStyle={tooltipStyle()} />
              <Bar dataKey="count" name="Created" fill="var(--cp-apps)" radius={[3, 3, 0, 0]}>
                {trend.map((entry) => (
                  <Cell key={entry.year} className="chart-cell" onClick={() => onYearSelect(entry.year)} />
                ))}
              </Bar>
              <Line dataKey="cumulative" name="Cumulative" stroke="var(--cp-accent)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <OverviewBars
        title="Top makers"
        subtitle="Most resources created or owned"
        badge="Directory enriched"
        data={makers}
        color="var(--cp-apps)"
        onSelect={onMakerSelect}
      />

      <OverviewDonut
        title="Flow status"
        subtitle="Activated, deactivated, and suspended"
        badge="Admin API"
        total={flows.length}
        centerLabel="flows"
        data={flowStatuses}
        onSelect={(key) => onFlowStatusSelect(key as FlowStatus)}
      />

      <OverviewBars
        title="Top environments"
        subtitle="Apps, flows, and agents by environment"
        badge="Inventory API"
        data={topEnvironments}
        color="var(--cp-text-muted)"
        onSelect={onEnvironmentSelect}
      />

      <OverviewDonut
        title="Environments by type"
        subtitle="Production, sandbox, trial, developer, and default"
        badge="Inventory API"
        total={environments.length}
        centerLabel="environments"
        data={environmentTypes}
        onSelect={onEnvironmentTypeSelect}
      />

      <OverviewBars
        title="Resources by region"
        subtitle="Where resources are hosted"
        badge="Inventory API"
        data={regions}
        color="var(--cp-text-muted)"
        onSelect={onRegionSelect}
      />

      <OverviewBars
        title="Top connectors"
        subtitle="Used across apps and flows"
        badge="Connector preview"
        data={connectors}
        color="var(--cp-flows)"
        onSelect={onConnectorSelect}
      />

      <OverviewDonut
        title="Premium vs standard"
        subtitle="Connector licensing across apps and flows"
        badge="Connector preview"
        total={appsAndFlows.length}
        centerLabel="resources"
        data={licenseData}
        onSelect={(key) => {
          if (key !== 'unknown') onLicenseSelect(key === 'premium')
        }}
      />

      <OverviewBars
        title="Top departments"
        subtitle="Apps, flows, and agents by maker department"
        badge="Directory enriched"
        data={departments}
        color="var(--cp-agents)"
        onSelect={onDepartmentSelect}
      />
    </div>
  )
}
