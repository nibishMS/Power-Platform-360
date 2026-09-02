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
  AgentHarness,
  AgentKind,
  InventoryAsset,
} from '../inventory/types'
import { personName } from '../inventory/selectors'

interface AgentDashboardProps {
  assets: InventoryAsset[]
  onKindSelect: (kind: AgentKind) => void
  onMakerSelect: (makerId: string) => void
  onEnvironmentSelect: (environmentId: string) => void
  onMonthSelect: (month: string) => void
  onPublishedSelect: (published: boolean) => void
  onHarnessSelect: (harness: AgentHarness) => void
  onConnectorSelect: (connectorId: string) => void
  onConnectorCountSelect: (count: number) => void
  onDepartmentSelect: (department: string) => void
}

interface AgentDatum {
  key: string
  name: string
  value: number
  color?: string
}

const AGENT_KIND_COLORS: Record<AgentKind, string> = {
  'Copilot Studio Agent': 'var(--cp-apps)',
  'Agent Builder': 'var(--cp-flows)',
  Unknown: 'var(--cp-text-muted)',
}

const HARNESS_COLORS: Record<AgentHarness, string> = {
  'GitHub Copilot': 'var(--cp-flows)',
  Standard: 'var(--cp-apps)',
  'Copilot Chat': 'var(--cp-agents)',
}

function countValues<T extends string>(
  values: T[],
  orderedKeys: T[],
  colors: Record<T, string>,
): AgentDatum[] {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return orderedKeys
    .filter((key) => counts.has(key))
    .map((key) => ({ key, name: key, value: counts.get(key) ?? 0, color: colors[key] }))
}

function countAgents(
  assets: InventoryAsset[],
  getKey: (asset: InventoryAsset) => string | undefined,
  getName: (asset: InventoryAsset) => string | undefined,
  limit = 8,
): AgentDatum[] {
  const counts = new Map<string, AgentDatum>()
  for (const asset of assets) {
    const key = getKey(asset)
    if (!key) continue
    const current = counts.get(key)
    if (current) current.value += 1
    else counts.set(key, { key, name: getName(asset) ?? key, value: 1 })
  }
  return [...counts.values()].sort((left, right) => right.value - left.value).slice(0, limit)
}

function getMonthlyCreatedTrend(assets: InventoryAsset[]) {
  const counts = new Map<string, number>()
  for (const asset of assets) {
    const month = asset.createdAt?.slice(0, 7)
    if (month && /^\d{4}-\d{2}$/.test(month)) counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  let cumulative = 0
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => {
      cumulative += count
      return { month, count, cumulative }
    })
}

function getAgentConnectorUsage(assets: InventoryAsset[]): AgentDatum[] {
  const usage = new Map<string, { name: string; agents: Set<string> }>()
  for (const asset of assets) {
    for (const connector of asset.connectors) {
      const current = usage.get(connector.id)
      if (current) current.agents.add(asset.id)
      else usage.set(connector.id, { name: connector.displayName, agents: new Set([asset.id]) })
    }
  }
  return [...usage.entries()]
    .map(([key, value]) => ({ key, name: value.name, value: value.agents.size }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)
}

function getConnectorCountDistribution(assets: InventoryAsset[]): AgentDatum[] {
  const counts = new Map<number, number>()
  for (const asset of assets) counts.set(asset.connectors.length, (counts.get(asset.connectors.length) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([count, value]) => ({
      key: String(count),
      name: count === 1 ? '1 connector' : `${count} connectors`,
      value,
    }))
}

function tooltipStyle() {
  return {
    background: 'var(--cp-surface)',
    border: '1px solid var(--cp-border)',
    borderRadius: '6px',
    color: 'var(--cp-text)',
  }
}

function AgentDonut({
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
  data: AgentDatum[]
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel agent-panel" aria-label={title}>
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
            <span>agents</span>
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

function AgentBars({
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
  data: AgentDatum[]
  color: string
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel agent-panel" aria-label={title}>
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
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 25 }} accessibilityLayer>
              <CartesianGrid stroke="var(--cp-border)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                tick={{ fill: 'var(--cp-text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: 'var(--cp-agents-soft)' }} contentStyle={tooltipStyle()} />
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

export function AgentDashboard({
  assets,
  onKindSelect,
  onMakerSelect,
  onEnvironmentSelect,
  onMonthSelect,
  onPublishedSelect,
  onHarnessSelect,
  onConnectorSelect,
  onConnectorCountSelect,
  onDepartmentSelect,
}: AgentDashboardProps) {
  const kindData = countValues(
    assets.map((asset) => asset.agentKind ?? 'Unknown'),
    ['Copilot Studio Agent', 'Agent Builder', 'Unknown'],
    AGENT_KIND_COLORS,
  )
  const makerData = countAgents(
    assets.filter((asset) => !asset.creator?.isSystem && !asset.owner?.isSystem),
    (asset) => asset.creatorId ?? asset.ownerId,
    (asset) => personName(asset.creator ?? asset.owner, asset.creatorId ?? asset.ownerId),
    6,
  )
  const environmentData = countAgents(
    assets,
    (asset) => asset.environmentId,
    (asset) => asset.environmentName,
    8,
  )
  const publishedData: AgentDatum[] = [
    {
      key: 'published',
      name: 'Published',
      value: assets.filter((asset) => Boolean(asset.publishedAt)).length,
      color: 'var(--cp-success)',
    },
    {
      key: 'draft',
      name: 'Draft / not published',
      value: assets.filter((asset) => !asset.publishedAt).length,
      color: 'var(--cp-text-muted)',
    },
  ].filter((item) => item.value > 0)
  const harnessData = countValues(
    assets.map((asset) => asset.agentHarness ?? 'Standard'),
    ['GitHub Copilot', 'Standard', 'Copilot Chat'],
    HARNESS_COLORS,
  )
  const departmentData = countAgents(
    assets,
    (asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available',
    (asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available',
    8,
  )
  const createdTrend = getMonthlyCreatedTrend(assets)
  const connectorUsage = getAgentConnectorUsage(assets)
  const connectorDistribution = getConnectorCountDistribution(assets)

  return (
    <div className="agent-dashboard-grid">
      <AgentDonut
        title="Agent kind"
        subtitle="Copilot Studio and Microsoft 365 Agent Builder"
        badge="Inventory API"
        total={assets.length}
        data={kindData}
        onSelect={(key) => onKindSelect(key as AgentKind)}
      />

      <AgentBars
        title="Top makers"
        subtitle="Most agents created or owned"
        badge="Directory enriched"
        data={makerData}
        color="var(--cp-apps)"
        onSelect={onMakerSelect}
      />

      <AgentBars
        title="Agents by environment"
        subtitle="Where agents live"
        badge="Inventory API"
        data={environmentData}
        color="var(--cp-text-muted)"
        onSelect={onEnvironmentSelect}
      />

      <section className="chart-panel agent-panel" aria-label="Agents created by month">
        <div className="panel-heading">
          <div>
            <h2>Created by month</h2>
            <p>New agents per month and cumulative total</p>
          </div>
          <Badge appearance="tint">Inventory API</Badge>
        </div>
        <div className="flow-chart-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={createdTrend} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
              <CartesianGrid stroke="var(--cp-border)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--cp-text-muted)"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis allowDecimals={false} stroke="var(--cp-text-muted)" />
              <Tooltip contentStyle={tooltipStyle()} />
              <Bar dataKey="count" name="Created" fill="var(--cp-apps)" radius={[3, 3, 0, 0]}>
                {createdTrend.map((entry) => (
                  <Cell key={entry.month} className="chart-cell" onClick={() => onMonthSelect(entry.month)} />
                ))}
              </Bar>
              <Line dataKey="cumulative" name="Cumulative" stroke="var(--cp-accent)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <AgentDonut
        title="Publication status"
        subtitle="Published agents compared with draft agents"
        badge="Inventory API"
        total={assets.length}
        data={publishedData}
        onSelect={(key) => onPublishedSelect(key === 'published')}
      />

      <AgentDonut
        title="Agents by harness"
        subtitle="GitHub Copilot, Standard, and Copilot Chat"
        badge="Microsoft derivation"
        total={assets.length}
        data={harnessData}
        onSelect={(key) => onHarnessSelect(key as AgentHarness)}
      />

      <AgentBars
        title="Agents by connector"
        subtitle="Distinct agents using each connector"
        badge="Connector preview"
        data={connectorUsage}
        color="var(--cp-flows)"
        onSelect={onConnectorSelect}
      />

      <AgentBars
        title="Connector count per agent"
        subtitle="Complexity distribution by configured connectors"
        badge="Connector preview"
        data={connectorDistribution}
        color="var(--cp-connectors)"
        onSelect={(key) => onConnectorCountSelect(Number(key))}
      />

      <AgentBars
        title="Agents by department"
        subtitle="Maker department"
        badge="Directory enriched"
        data={departmentData}
        color="var(--cp-agents)"
        onSelect={onDepartmentSelect}
      />
    </div>
  )
}