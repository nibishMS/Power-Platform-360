import { Badge } from '@fluentui/react-components'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AssetCategory, InventoryAsset } from '../inventory/types'
import { personName } from '../inventory/selectors'
import { WorkloadIcon } from './WorkloadIcon'

interface InventoryChartsProps {
  assets: InventoryAsset[]
  groupByCategory?: boolean
  onTypeSelect: (type: string) => void
  onEnvironmentSelect: (environmentId: string) => void
}

interface ChartDatum {
  key: string
  name: string
  value: number
}

const CHART_COLORS = [
  'var(--cp-accent)',
  'var(--cp-link)',
  'var(--cp-success)',
  'var(--cp-warning)',
  'var(--cp-danger)',
  'var(--cp-text-muted)',
]

function countBy(
  assets: InventoryAsset[],
  getKey: (asset: InventoryAsset) => string | undefined,
  getName: (asset: InventoryAsset) => string | undefined,
  limit = 8,
): ChartDatum[] {
  const counts = new Map<string, ChartDatum>()
  for (const asset of assets) {
    const key = getKey(asset)
    if (!key) continue
    const existing = counts.get(key)
    if (existing) {
      existing.value += 1
    } else {
      counts.set(key, { key, name: getName(asset) ?? key, value: 1 })
    }
  }
  return [...counts.values()].sort((left, right) => right.value - left.value).slice(0, limit)
}

export function InventoryCharts({
  assets,
  groupByCategory = false,
  onTypeSelect,
  onEnvironmentSelect,
}: InventoryChartsProps) {
  const byType = groupByCategory
    ? countBy(
        assets,
        (asset) => asset.category,
        (asset) => `${asset.category.slice(0, 1).toUpperCase()}${asset.category.slice(1)}`,
        10,
      )
    : countBy(assets, (asset) => asset.type, (asset) => asset.typeLabel, 10)
  const byEnvironment = countBy(
    assets.filter((asset) => asset.environmentId),
    (asset) => asset.environmentId,
    (asset) => asset.environmentName,
  )
  const byOwner = countBy(
    assets.filter((asset) => asset.ownerId && !asset.owner?.isSystem),
    (asset) => asset.ownerId,
    (asset) => personName(asset.owner, asset.ownerId),
    6,
  )
  const byConnector = countBy(
    assets.flatMap((asset) => asset.connectors.map((connector) => ({
      ...asset,
      id: connector.id,
      name: connector.displayName,
    }))),
    (asset) => asset.id,
    (asset) => asset.name,
    6,
  )

  return (
    <div className="chart-grid">
      <section className="chart-panel chart-panel--wide" aria-labelledby="resource-mix-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Composition</p>
            <h2 id="resource-mix-title">Resource mix</h2>
          </div>
          <Badge appearance="tint">{assets.length.toLocaleString()} resources</Badge>
        </div>
        <div className="donut-layout">
          <div className="chart-canvas chart-canvas--donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="84%"
                  paddingAngle={2}
                  stroke="var(--cp-surface)"
                >
                  {byType.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      className="chart-cell"
                      onClick={() => onTypeSelect(entry.key)}
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
          </div>
          <div className="chart-legend" aria-label="Resource type filters">
            {byType.map((entry, index) => (
              <button
                key={entry.key}
                type="button"
                className="legend-row"
                onClick={() => onTypeSelect(entry.key)}
              >
                <span
                  className="legend-swatch"
                  style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="legend-label">
                  <WorkloadIcon
                    workload={groupByCategory ? entry.key as AssetCategory : 'overview'}
                    resourceType={groupByCategory ? undefined : entry.key}
                  />
                  {entry.name}
                </span>
                <strong>{entry.value.toLocaleString()}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="chart-panel chart-panel--wide" aria-labelledby="environment-chart-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Distribution</p>
            <h2 id="environment-chart-title">Top environments</h2>
          </div>
          <span className="panel-note">Select a bar to filter</span>
        </div>
        <div className="chart-canvas chart-canvas--bar">
          {byEnvironment.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byEnvironment} layout="vertical" margin={{ left: 8, right: 18 }} accessibilityLayer>
                <CartesianGrid stroke="var(--cp-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="var(--cp-text-muted)" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fill: 'var(--cp-text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--cp-accent-soft)' }}
                  contentStyle={{
                    background: 'var(--cp-surface)',
                    border: '1px solid var(--cp-border)',
                    borderRadius: '6px',
                    color: 'var(--cp-text)',
                  }}
                />
                <Bar dataKey="value" fill="var(--cp-link)" radius={[0, 3, 3, 0]}>
                  {byEnvironment.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill="var(--cp-link)"
                      className="chart-cell"
                      onClick={() => onEnvironmentSelect(entry.key)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-compact">No environment-scoped resources in this view.</div>
          )}
        </div>
      </section>

      <section className="chart-panel" aria-labelledby="makers-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">People</p>
            <h2 id="makers-title">Top owners</h2>
          </div>
        </div>
        <ol className="ranked-list">
          {byOwner.map((entry, index) => (
            <li key={entry.key}>
              <span className="rank-number">{index + 1}</span>
              <span className="rank-label">{entry.name}</span>
              <strong>{entry.value}</strong>
            </li>
          ))}
          {byOwner.length === 0 && <li className="empty-compact">Owner data is unavailable.</li>}
        </ol>
      </section>

      <section className="chart-panel" aria-labelledby="connectors-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dependencies</p>
            <h2 id="connectors-title">Top connectors</h2>
          </div>
          <Badge appearance="tint">Preview</Badge>
        </div>
        <ol className="ranked-list">
          {byConnector.map((entry, index) => (
            <li key={entry.key}>
              <span className="rank-number">{index + 1}</span>
              <span className="rank-label">{entry.name}</span>
              <strong>{entry.value}</strong>
            </li>
          ))}
          {byConnector.length === 0 && <li className="empty-compact">No connector usage reported.</li>}
        </ol>
      </section>
    </div>
  )
}