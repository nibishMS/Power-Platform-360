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
  FlowStatus,
  FlowTriggerType,
  InventoryAsset,
} from '../inventory/types'
import { usesPremiumConnector } from '../inventory/selectors'

interface FlowDashboardProps {
  assets: InventoryAsset[]
  onStatusSelect: (status: FlowStatus) => void
  onTriggerSelect: (triggerType: FlowTriggerType) => void
  onEnvironmentSelect: (environmentId: string) => void
  onYearSelect: (year: string) => void
  onPremiumSelect: (premium: boolean) => void
  onConnectorSelect: (connectorId: string) => void
}

interface FlowChartDatum {
  key: string
  name: string
  value: number
  color: string
}

const STATUS_COLORS: Record<FlowStatus, string> = {
  Activated: 'var(--cp-success)',
  Deactivated: 'var(--cp-danger)',
  Suspended: 'var(--cp-warning)',
  Unknown: 'var(--cp-text-muted)',
}

const TRIGGER_COLORS: Record<FlowTriggerType, string> = {
  Instant: 'var(--cp-agents)',
  Automated: 'var(--cp-flows)',
  Scheduled: 'var(--cp-apps)',
  Unknown: 'var(--cp-text-muted)',
}

function countValues<T extends string>(
  values: T[],
  orderedKeys: T[],
  colors: Record<T, string>,
): FlowChartDatum[] {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return orderedKeys
    .filter((key) => counts.has(key))
    .map((key) => ({ key, name: key, value: counts.get(key) ?? 0, color: colors[key] }))
}

function countByEnvironment(assets: InventoryAsset[]) {
  const counts = new Map<string, { key: string; name: string; value: number }>()
  for (const asset of assets) {
    if (!asset.environmentId) continue
    const current = counts.get(asset.environmentId)
    if (current) current.value += 1
    else counts.set(asset.environmentId, {
      key: asset.environmentId,
      name: asset.environmentName ?? asset.environmentId,
      value: 1,
    })
  }
  return [...counts.values()].sort((left, right) => right.value - left.value).slice(0, 8)
}

function getCreatedTrend(assets: InventoryAsset[]) {
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

function getConnectorUsage(assets: InventoryAsset[]) {
  const usage = new Map<string, { key: string; name: string; flowIds: Set<string> }>()
  for (const asset of assets) {
    for (const connector of asset.connectors) {
      const current = usage.get(connector.id)
      if (current) current.flowIds.add(asset.id)
      else usage.set(connector.id, {
        key: connector.id,
        name: connector.displayName,
        flowIds: new Set([asset.id]),
      })
    }
  }
  return [...usage.values()]
    .map((item) => ({ key: item.key, name: item.name, value: item.flowIds.size }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)
}

function DonutPanel({
  title,
  subtitle,
  badge,
  total,
  data,
  onSelect,
}: {
  title: string
  subtitle: string
  badge: string
  total: number
  data: FlowChartDatum[]
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel flow-panel" aria-label={title}>
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
              <Tooltip
                contentStyle={{
                  background: 'var(--cp-surface)',
                  border: '1px solid var(--cp-border)',
                  borderRadius: '6px',
                  color: 'var(--cp-text)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flow-donut-center" aria-hidden="true">
            <strong>{total.toLocaleString()}</strong>
            <span>flows</span>
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

export function FlowDashboard({
  assets,
  onStatusSelect,
  onTriggerSelect,
  onEnvironmentSelect,
  onYearSelect,
  onPremiumSelect,
  onConnectorSelect,
}: FlowDashboardProps) {
  const statusData = countValues(
    assets.map((asset) => asset.flowStatus ?? 'Unknown'),
    ['Activated', 'Deactivated', 'Suspended', 'Unknown'],
    STATUS_COLORS,
  )
  const triggerData = countValues(
    assets.map((asset) => asset.flowTriggerType ?? 'Unknown'),
    ['Instant', 'Automated', 'Scheduled', 'Unknown'],
    TRIGGER_COLORS,
  )
  const environments = countByEnvironment(assets)
  const createdTrend = getCreatedTrend(assets)
  const connectors = getConnectorUsage(assets)
  const premiumCount = assets.filter(usesPremiumConnector).length
  const knownStandardCount = assets.filter(
    (asset) => asset.connectors.length > 0 && !usesPremiumConnector(asset),
  ).length
  const unknownLicenseCount = assets.length - premiumCount - knownStandardCount
  const licenseData: FlowChartDatum[] = [
    { key: 'premium', name: 'Premium', value: premiumCount, color: 'var(--cp-warning)' },
    { key: 'standard', name: 'Standard', value: knownStandardCount, color: 'var(--cp-text-muted)' },
    { key: 'unknown', name: 'Unknown', value: unknownLicenseCount, color: 'var(--cp-border-strong)' },
  ].filter((item) => item.value > 0)

  return (
    <div className="flow-dashboard-grid">
      <DonutPanel
        title="Flow status"
        subtitle="Activated, deactivated, and suspended"
        badge="Admin API"
        total={assets.length}
        data={statusData}
        onSelect={(key) => onStatusSelect(key as FlowStatus)}
      />

      <DonutPanel
        title="Trigger type"
        subtitle="Instant, scheduled, and automated"
        badge="Admin API"
        total={assets.length}
        data={triggerData}
        onSelect={(key) => onTriggerSelect(key as FlowTriggerType)}
      />

      <section className="chart-panel flow-panel" aria-label="Flows by environment">
        <div className="panel-heading">
          <div>
            <h2>Flows by environment</h2>
            <p>Where flows live</p>
          </div>
          <Badge appearance="tint">Inventory API</Badge>
        </div>
        <div className="flow-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={environments} layout="vertical" margin={{ left: 10, right: 24 }} accessibilityLayer>
              <CartesianGrid stroke="var(--cp-border)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tick={{ fill: 'var(--cp-text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--cp-flows-soft)' }}
                contentStyle={{
                  background: 'var(--cp-surface)',
                  border: '1px solid var(--cp-border)',
                  borderRadius: '6px',
                  color: 'var(--cp-text)',
                }}
              />
              <Bar dataKey="value" fill="var(--cp-text-muted)" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: 'var(--cp-text-muted)', fontSize: 11 }}>
                {environments.map((entry) => (
                  <Cell key={entry.key} className="chart-cell" onClick={() => onEnvironmentSelect(entry.key)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-panel flow-panel" aria-label="Flows created over time">
        <div className="panel-heading">
          <div>
            <h2>Created over time</h2>
            <p>New flows per year and cumulative total</p>
          </div>
          <Badge appearance="tint">Inventory API</Badge>
        </div>
        <div className="flow-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={createdTrend} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
              <CartesianGrid stroke="var(--cp-border)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--cp-text-muted)" />
              <YAxis allowDecimals={false} stroke="var(--cp-text-muted)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--cp-surface)',
                  border: '1px solid var(--cp-border)',
                  borderRadius: '6px',
                  color: 'var(--cp-text)',
                }}
              />
              <Bar dataKey="count" name="Created" fill="var(--cp-apps)" radius={[3, 3, 0, 0]}>
                {createdTrend.map((entry) => (
                  <Cell key={entry.year} className="chart-cell" onClick={() => onYearSelect(entry.year)} />
                ))}
              </Bar>
              <Line dataKey="cumulative" name="Cumulative" stroke="var(--cp-accent)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <DonutPanel
        title="Premium vs standard"
        subtitle="Connector licensing classification"
        badge="Connector preview"
        total={assets.length}
        data={licenseData}
        onSelect={(key) => {
          if (key !== 'unknown') onPremiumSelect(key === 'premium')
        }}
      />

      <section className="chart-panel flow-panel" aria-label="Top flow connectors">
        <div className="panel-heading">
          <div>
            <h2>Top connectors</h2>
            <p>Distinct flows using each connector</p>
          </div>
          <Badge appearance="tint">Connector preview</Badge>
        </div>
        <div className="flow-chart-canvas">
          {connectors.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={connectors} layout="vertical" margin={{ left: 10, right: 24 }} accessibilityLayer>
                <CartesianGrid stroke="var(--cp-border)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={116}
                  tick={{ fill: 'var(--cp-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--cp-connectors-soft)' }}
                  contentStyle={{
                    background: 'var(--cp-surface)',
                    border: '1px solid var(--cp-border)',
                    borderRadius: '6px',
                    color: 'var(--cp-text)',
                  }}
                />
                <Bar dataKey="value" fill="var(--cp-warning)" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: 'var(--cp-text-muted)', fontSize: 11 }}>
                  {connectors.map((entry) => (
                    <Cell key={entry.key} className="chart-cell" onClick={() => onConnectorSelect(entry.key)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-compact">No connector usage reported.</div>
          )}
        </div>
      </section>
    </div>
  )
}