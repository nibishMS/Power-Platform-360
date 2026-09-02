import { Badge, Button, Input, Select } from '@fluentui/react-components'
import {
  ArrowDownload20Regular,
  ArrowSort20Regular,
  Dismiss20Regular,
  PlugConnected20Regular,
  Settings20Regular,
} from '@fluentui/react-icons'
import { useState } from 'react'
import type { FlowTriggerType, InventoryAsset } from '../inventory/types'
import {
  formatDate,
  getConnectorLicense,
  personName,
} from '../inventory/selectors'
import { WorkloadIcon } from './WorkloadIcon'

interface FlowsInventoryProps {
  assets: InventoryAsset[]
  onSelect: (asset: InventoryAsset) => void
  drilldownLabels?: string[]
  onClearDrilldown?: () => void
}

type CreatedWindow = 'all' | '30' | '60' | '90'
type FlowColumn =
  | 'name'
  | 'license'
  | 'quarantined'
  | 'trigger'
  | 'owner'
  | 'department'
  | 'createdBy'
  | 'environment'
  | 'status'

interface ColumnDefinition {
  key: FlowColumn
  label: string
}

const PAGE_SIZE = 50
const COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Name' },
  { key: 'license', label: 'Connector tier' },
  { key: 'quarantined', label: 'Quarantined' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'owner', label: 'Owner / Maker' },
  { key: 'department', label: 'Department' },
  { key: 'createdBy', label: 'Created by' },
  { key: 'environment', label: 'Environment' },
  { key: 'status', label: 'Flow status' },
]

function escapeCsv(value: string | boolean | undefined): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function exportFlowsCsv(assets: InventoryAsset[]): void {
  const headers = [
    'Name',
    'Connector Tier',
    'Quarantined',
    'Trigger',
    'Flow Status',
    'Owner / Maker',
    'Department',
    'Created By',
    'Created On',
    'Last Modified On',
    'Environment',
    'Connectors',
    'Resource ID',
  ]
  const rows = assets.map((asset) => [
    asset.name,
    getConnectorLicense(asset),
    asset.isQuarantined ? 'Yes' : 'No',
    asset.flowTriggerType ?? 'Unknown',
    asset.flowStatus ?? 'Unknown',
    personName(asset.owner, asset.ownerId),
    asset.creator?.department ?? asset.owner?.department,
    personName(asset.creator, asset.creatorId),
    asset.createdAt,
    asset.lastModifiedAt,
    asset.environmentName,
    asset.connectors.map((connector) => connector.displayName).join('; '),
    asset.id,
  ])
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `power-automate-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  console.log(`Power Platform 360: exported ${assets.length} flows to CSV`)
}

function columnValue(asset: InventoryAsset, column: FlowColumn): string {
  if (column === 'name') return asset.name
  if (column === 'license') return getConnectorLicense(asset)
  if (column === 'quarantined') return asset.isQuarantined ? 'Yes' : 'No'
  if (column === 'trigger') return asset.flowTriggerType ?? 'Unknown'
  if (column === 'owner') return personName(asset.owner, asset.ownerId)
  if (column === 'department') return asset.creator?.department ?? asset.owner?.department ?? ''
  if (column === 'createdBy') return personName(asset.creator, asset.creatorId)
  if (column === 'environment') return asset.environmentName ?? ''
  return asset.flowStatus ?? 'Unknown'
}

function createdWithin(asset: InventoryAsset, window: CreatedWindow): boolean {
  if (window === 'all') return true
  if (!asset.createdAt) return false
  const timestamp = new Date(asset.createdAt).getTime()
  if (Number.isNaN(timestamp)) return false
  const ageInDays = (Date.now() - timestamp) / (24 * 60 * 60 * 1000)
  return ageInDays <= Number(window)
}

function triggerClass(trigger: FlowTriggerType | undefined): string {
  return `trigger-badge trigger-badge--${(trigger ?? 'Unknown').toLowerCase()}`
}

export function FlowsInventory({
  assets,
  onSelect,
  drilldownLabels = [],
  onClearDrilldown,
}: FlowsInventoryProps) {
  const [createdWindow, setCreatedWindow] = useState<CreatedWindow>('all')
  const [connectorId, setConnectorId] = useState('all')
  const [connectorFilterOpen, setConnectorFilterOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<Partial<Record<FlowColumn, string>>>({})
  const [visibleColumns, setVisibleColumns] = useState<Set<FlowColumn>>(
    () => new Set(COLUMNS.map((column) => column.key)),
  )
  const [sortColumn, setSortColumn] = useState<FlowColumn>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const connectorOptions = [...new Map(
    assets.flatMap((asset) => asset.connectors.map((connector) => [connector.id, connector.displayName] as const)),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1]))
  const filtered = assets.filter((asset) => {
    if (!createdWithin(asset, createdWindow)) return false
    if (connectorId !== 'all' && !asset.connectors.some((connector) => connector.id === connectorId)) return false
    const normalizedSearch = search.trim().toLowerCase()
    if (normalizedSearch) {
      const searchable = [
        asset.name,
        asset.flowTriggerType,
        asset.flowStatus,
        getConnectorLicense(asset),
        asset.environmentName,
        personName(asset.owner, asset.ownerId),
        personName(asset.creator, asset.creatorId),
      ].join(' ').toLowerCase()
      if (!searchable.includes(normalizedSearch)) return false
    }
    return Object.entries(columnFilters).every(([key, value]) => {
      if (!value?.trim()) return true
      return columnValue(asset, key as FlowColumn).toLowerCase().includes(value.trim().toLowerCase())
    })
  })
  const sorted = [...filtered].sort((left, right) => {
    const comparison = columnValue(left, sortColumn).localeCompare(
      columnValue(right, sortColumn),
      undefined,
      { numeric: true, sensitivity: 'base' },
    )
    return sortDirection === 'asc' ? comparison : -comparison
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageAssets = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const activeColumns = COLUMNS.filter((column) => visibleColumns.has(column.key))
  const hasFilters = drilldownLabels.length > 0 || createdWindow !== 'all' || connectorId !== 'all' ||
    Boolean(search.trim()) || Object.values(columnFilters).some((value) => value?.trim())

  function updateColumnFilter(column: FlowColumn, value: string): void {
    setColumnFilters((current) => ({ ...current, [column]: value }))
    setPage(0)
  }

  function changeSort(column: FlowColumn): void {
    if (sortColumn === column) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setPage(0)
  }

  function toggleColumn(column: FlowColumn): void {
    if (column === 'name') return
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  function clearFilters(): void {
    setCreatedWindow('all')
    setConnectorId('all')
    setSearch('')
    setColumnFilters({})
    setPage(0)
    onClearDrilldown?.()
  }

  return (
    <section className="apps-inventory flows-inventory" aria-label="Power Automate inventory grid">
      <div className="apps-filter-band">
        {drilldownLabels.length > 0 && (
          <div className="apps-chip-row apps-drilldown-row">
            <strong>Drill-down</strong>
            {drilldownLabels.map((label) => <span className="chip chip--context" key={label}>{label}</span>)}
          </div>
        )}
        <div className="apps-chip-row">
          <strong>Created</strong>
          {([
            ['all', 'Any time'],
            ['30', 'Last 30 days'],
            ['60', 'Last 60 days'],
            ['90', 'Last 90 days'],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={createdWindow === value ? 'chip chip--active' : 'chip'}
              onClick={() => {
                setCreatedWindow(value)
                setPage(0)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="apps-command-bar">
        <div className="apps-search-block">
          <Input
            value={search}
            placeholder="Search flows"
            aria-label="Search flows"
            onChange={(_, data) => {
              setSearch(data.value)
              setPage(0)
            }}
          />
          <span>{pageAssets.length} items · {filtered.length.toLocaleString()} of {assets.length.toLocaleString()}</span>
        </div>
        <div className="apps-command-actions">
          <Button
            appearance={connectorFilterOpen || connectorId !== 'all' ? 'primary' : 'secondary'}
            icon={<PlugConnected20Regular />}
            onClick={() => setConnectorFilterOpen((current) => !current)}
          >
            Connectors
          </Button>
          <Button appearance="subtle" disabled={!hasFilters} icon={<Dismiss20Regular />} onClick={clearFilters}>
            Clear filters
          </Button>
          <Button appearance="primary" icon={<ArrowDownload20Regular />} onClick={() => exportFlowsCsv(filtered)}>
            Export CSV
          </Button>
          <details className="apps-columns-menu">
            <summary><Settings20Regular /> Columns ({visibleColumns.size}/{COLUMNS.length})</summary>
            <div className="apps-columns-popover">
              {COLUMNS.map((column) => (
                <label key={column.key}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(column.key)}
                    disabled={column.key === 'name'}
                    onChange={() => toggleColumn(column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      {connectorFilterOpen && (
        <div className="apps-connector-filter">
          <label>
            <span>Connector usage</span>
            <Select value={connectorId} onChange={(_, data) => {
              setConnectorId(data.value)
              setPage(0)
            }}>
              <option value="all">All connectors</option>
              {connectorOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </label>
        </div>
      )}

      <div className="apps-table-scroll">
        <table className="apps-table flows-table">
          <thead>
            <tr>
              {activeColumns.map((column) => (
                <th key={column.key}>
                  <button type="button" onClick={() => changeSort(column.key)}>
                    {column.label}
                    {sortColumn === column.key && <ArrowSort20Regular aria-label={`Sorted ${sortDirection}`} />}
                  </button>
                </th>
              ))}
            </tr>
            <tr className="apps-column-filters">
              {activeColumns.map((column) => (
                <th key={column.key}>
                  <input
                    value={columnFilters[column.key] ?? ''}
                    placeholder={column.key === 'createdBy' ? 'Search user' : 'Filter'}
                    aria-label={`Filter ${column.label}`}
                    onChange={(event) => updateColumnFilter(column.key, event.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageAssets.map((asset) => (
              <tr key={`${asset.type}:${asset.id}`}>
                {activeColumns.map((column) => (
                  <td key={column.key}>
                    {column.key === 'name' && (
                      <button type="button" className="apps-name-cell" onClick={() => onSelect(asset)}>
                        <WorkloadIcon workload="flows" resourceType={asset.type} />
                        <span>
                          <strong>{asset.name}</strong>
                          <small>{formatDate(asset.lastModifiedAt)}</small>
                        </span>
                      </button>
                    )}
                    {column.key === 'license' && (
                      <Badge appearance="tint" color={getConnectorLicense(asset) === 'Premium' ? 'warning' : 'informative'}>
                        {getConnectorLicense(asset)}
                      </Badge>
                    )}
                    {column.key === 'quarantined' && (asset.isQuarantined ? 'Yes' : 'No')}
                    {column.key === 'trigger' && (
                      <span className={triggerClass(asset.flowTriggerType)}>{asset.flowTriggerType ?? 'Unknown'}</span>
                    )}
                    {column.key === 'owner' && personName(asset.owner, asset.ownerId)}
                    {column.key === 'department' && (asset.creator?.department ?? asset.owner?.department ?? 'Not available')}
                    {column.key === 'createdBy' && personName(asset.creator, asset.creatorId)}
                    {column.key === 'environment' && asset.environmentName}
                    {column.key === 'status' && asset.flowStatus}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="apps-mobile-list">
        {pageAssets.map((asset) => (
          <button type="button" key={`${asset.type}:${asset.id}`} onClick={() => onSelect(asset)}>
            <WorkloadIcon workload="flows" resourceType={asset.type} />
            <span>
              <strong>{asset.name}</strong>
              <small>{asset.environmentName ?? 'Tenant-wide'} · {asset.flowStatus ?? 'Unknown'}</small>
            </span>
            <span className={triggerClass(asset.flowTriggerType)}>{asset.flowTriggerType ?? 'Unknown'}</span>
          </button>
        ))}
      </div>

      <footer className="pagination-bar">
        <span>
          {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}-
          {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
        </span>
        <div className="apps-page-actions">
          <button type="button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>Previous</button>
          <span>Page {safePage + 1} of {pageCount}</span>
          <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>Next</button>
        </div>
      </footer>
    </section>
  )
}
