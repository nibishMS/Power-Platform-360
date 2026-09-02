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
import type { InventoryAsset } from '../inventory/types'
import {
  getAppKind,
  getConnectorLicense,
  personName,
  type AppKind,
  type ConnectorLicense,
} from '../inventory/selectors'

interface AppsDashboardProps {
  assets: InventoryAsset[]
  onKindSelect: (kind: AppKind) => void
  onMakerSelect: (makerId: string) => void
  onEnvironmentSelect: (environmentId: string) => void
  onYearSelect: (year: string) => void
  onLicenseSelect: (license: Exclude<ConnectorLicense, 'Unknown'>) => void
  onDepartmentSelect: (department: string) => void
}

interface AppDatum {
  key: string
  name: string
  value: number
  color?: string
}

const APP_KIND_COLORS: Record<AppKind, string> = {
  'Canvas app': 'var(--cp-apps)',
  'Model-driven app': 'var(--cp-flows)',
  'Code app': 'var(--cp-agents)',
  'Vibe app': 'var(--cp-warning)',
  'App Builder app': 'var(--cp-connectors)',
}

const LICENSE_COLORS: Record<ConnectorLicense, string> = {
  Premium: 'var(--cp-warning)',
  Standard: 'var(--cp-text-muted)',
  Unknown: 'var(--cp-border-strong)',
}

function tooltipStyle() {
  return {
    background: 'var(--cp-surface)',
    border: '1px solid var(--cp-border)',
    borderRadius: '6px',
    color: 'var(--cp-text)',
  }
}

function countApps(
  assets: InventoryAsset[],
  getKey: (asset: InventoryAsset) => string | undefined,
  getName: (asset: InventoryAsset) => string | undefined,
  limit = 8,
): AppDatum[] {
  const counts = new Map<string, AppDatum>()
  for (const asset of assets) {
    const key = getKey(asset)
    if (!key) continue
    const current = counts.get(key)
    if (current) current.value += 1
    else counts.set(key, { key, name: getName(asset) ?? key, value: 1 })
  }
  return [...counts.values()].sort((left, right) => right.value - left.value).slice(0, limit)
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

function AppDonut({
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
  data: AppDatum[]
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel app-panel" aria-label={title}>
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
            <span>apps</span>
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

function AppBars({
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
  data: AppDatum[]
  color: string
  onSelect: (key: string) => void
}) {
  return (
    <section className="chart-panel app-panel" aria-label={title}>
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
              <Tooltip cursor={{ fill: 'var(--cp-apps-soft)' }} contentStyle={tooltipStyle()} />
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

export function AppsDashboard({
  assets,
  onKindSelect,
  onMakerSelect,
  onEnvironmentSelect,
  onYearSelect,
  onLicenseSelect,
  onDepartmentSelect,
}: AppsDashboardProps) {
  const kinds = countApps(assets, (asset) => getAppKind(asset), (asset) => getAppKind(asset), 5)
    .map((item) => ({ ...item, color: APP_KIND_COLORS[item.key as AppKind] }))
  const makers = countApps(
    assets.filter((asset) => !asset.creator?.isSystem && !asset.owner?.isSystem),
    (asset) => asset.creatorId ?? asset.ownerId,
    (asset) => personName(asset.creator ?? asset.owner, asset.creatorId ?? asset.ownerId),
    8,
  )
  const environments = countApps(
    assets,
    (asset) => asset.environmentId,
    (asset) => asset.environmentName,
    8,
  )
  const departments = countApps(
    assets,
    (asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available',
    (asset) => asset.creator?.department ?? asset.owner?.department ?? 'Not available',
    8,
  )
  const licenses = countApps(
    assets,
    (asset) => getConnectorLicense(asset),
    (asset) => getConnectorLicense(asset),
    3,
  ).map((item) => ({ ...item, color: LICENSE_COLORS[item.key as ConnectorLicense] }))
  const trend = getCreatedTrend(assets)

  return (
    <div className="apps-dashboard-grid">
      <AppDonut
        title="App kind"
        subtitle="Canvas, code, vibe, App Builder, and model-driven"
        badge="Inventory API"
        total={assets.length}
        data={kinds}
        onSelect={(key) => onKindSelect(key as AppKind)}
      />

      <AppBars
        title="Top makers"
        subtitle="Most apps created or owned"
        badge="Directory enriched"
        data={makers}
        color="var(--cp-apps)"
        onSelect={onMakerSelect}
      />

      <AppBars
        title="Apps by environment"
        subtitle="Where apps live"
        badge="Inventory API"
        data={environments}
        color="var(--cp-text-muted)"
        onSelect={onEnvironmentSelect}
      />

      <section className="chart-panel app-panel" aria-label="Apps created over time">
        <div className="panel-heading">
          <div>
            <h2>Created over time</h2>
            <p>New apps per year and cumulative total</p>
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

      <AppDonut
        title="Premium vs standard"
        subtitle="Connector licensing classification"
        badge="Connector preview"
        total={assets.length}
        data={licenses}
        onSelect={(key) => {
          if (key !== 'Unknown') onLicenseSelect(key as Exclude<ConnectorLicense, 'Unknown'>)
        }}
      />

      <AppBars
        title="Apps by department"
        subtitle="Maker department"
        badge="Directory enriched"
        data={departments}
        color="var(--cp-apps)"
        onSelect={onDepartmentSelect}
      />
    </div>
  )
}
