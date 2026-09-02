import { Badge, Button } from '@fluentui/react-components'
import {
  ArrowLeft20Regular,
  ArrowRight20Regular,
  ArrowSort20Regular,
  PlugConnected20Regular,
} from '@fluentui/react-icons'
import { useState } from 'react'
import type { InventoryAsset } from '../inventory/types'
import { formatDate, getFreshness, personName } from '../inventory/selectors'
import { WorkloadIcon } from './WorkloadIcon'

interface InventoryTableProps {
  assets: InventoryAsset[]
  onSelect: (asset: InventoryAsset) => void
}

type SortKey = 'name' | 'typeLabel' | 'environmentName' | 'owner' | 'createdAt' | 'lastModifiedAt' | 'agentHarness' | 'publishedAt'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 50

function sortValue(asset: InventoryAsset, key: SortKey): string {
  if (key === 'owner') return personName(asset.owner, asset.ownerId)
  return asset[key] ?? ''
}

export function InventoryTable({ assets, onSelect }: InventoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('lastModifiedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)

  const sorted = [...assets].sort((left, right) => {
    const comparison = sortValue(left, sortKey).localeCompare(sortValue(right, sortKey), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
    return sortDirection === 'asc' ? comparison : -comparison
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageAssets = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const showAgentColumns = assets.some((asset) => asset.category === 'agents')

  function changeSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setPage(0)
  }

  function header(label: string, key: SortKey) {
    return (
      <button type="button" className="table-sort" onClick={() => changeSort(key)}>
        {label}
        {sortKey === key && <ArrowSort20Regular aria-label={`Sorted ${sortDirection}`} />}
      </button>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="empty-state">
        <h2>No resources match these filters</h2>
        <p>Adjust the search or clear one of the active filters.</p>
      </div>
    )
  }

  return (
    <section className="inventory-grid-panel" aria-label="Power Platform inventory results">
      <div className="table-scroll">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{header('Name', 'name')}</th>
              <th>{header('Type', 'typeLabel')}</th>
              <th>{header('Environment', 'environmentName')}</th>
              <th>{header('Owner', 'owner')}</th>
              {showAgentColumns && <th>{header('Harness', 'agentHarness')}</th>}
              {showAgentColumns && <th>{header('Publication', 'publishedAt')}</th>}
              <th>{header('Created', 'createdAt')}</th>
              <th>{header('Modified', 'lastModifiedAt')}</th>
              <th>Connectors</th>
            </tr>
          </thead>
          <tbody>
            {pageAssets.map((asset) => (
              <tr key={`${asset.type}:${asset.id}`}>
                <td>
                  <button type="button" className="resource-name" onClick={() => onSelect(asset)}>
                    <span className={`resource-icon resource-icon--${asset.category}`} aria-hidden="true">
                      <WorkloadIcon workload={asset.category} resourceType={asset.type} />
                    </span>
                    <span>
                      <strong>{asset.name}</strong>
                      <small>{asset.id}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <Badge appearance="tint">{asset.subtype ?? asset.typeLabel}</Badge>
                </td>
                <td>
                  <span className="cell-primary">{asset.environmentName ?? 'Tenant-wide'}</span>
                  <small>{asset.location ?? 'Region unavailable'}</small>
                </td>
                <td>
                  <span className="cell-primary">{personName(asset.owner, asset.ownerId)}</span>
                  <small>{asset.owner?.department ?? 'Department unavailable'}</small>
                </td>
                {showAgentColumns && (
                  <td><Badge appearance="tint">{asset.agentHarness ?? 'Standard'}</Badge></td>
                )}
                {showAgentColumns && (
                  <td>
                    <Badge appearance={asset.publishedAt ? 'filled' : 'outline'} color={asset.publishedAt ? 'success' : 'informative'}>
                      {asset.publishedAt ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                )}
                <td>{formatDate(asset.createdAt)}</td>
                <td>
                  <span className="cell-primary">{formatDate(asset.lastModifiedAt)}</span>
                  <small className={`freshness freshness--${getFreshness(asset)}`}>
                    {getFreshness(asset)}
                  </small>
                </td>
                <td>
                  <span className="connector-count">
                    <PlugConnected20Regular />
                    {asset.connectors.length}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-resource-list">
        {pageAssets.map((asset) => (
          <button
            type="button"
            className="mobile-resource-card"
            key={`${asset.type}:${asset.id}`}
            onClick={() => onSelect(asset)}
          >
            <span className={`resource-icon resource-icon--${asset.category}`} aria-hidden="true">
              <WorkloadIcon workload={asset.category} resourceType={asset.type} />
            </span>
            <span className="mobile-resource-copy">
              <strong>{asset.name}</strong>
              <small>{asset.subtype ?? asset.typeLabel}</small>
              <span>{asset.environmentName ?? 'Tenant-wide'}</span>
              {showAgentColumns && <span>{asset.agentHarness ?? 'Standard'} · {asset.publishedAt ? 'Published' : 'Draft'}</span>}
            </span>
            <span className="mobile-resource-date">{formatDate(asset.lastModifiedAt)}</span>
          </button>
        ))}
      </div>

      <footer className="pagination-bar">
        <span>
          {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, assets.length)} of{' '}
          {assets.length.toLocaleString()}
        </span>
        <div className="pagination-actions">
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            aria-label="Previous page"
            disabled={safePage === 0}
            onClick={() => setPage(Math.max(0, safePage - 1))}
          />
          <span>Page {safePage + 1} of {pageCount}</span>
          <Button
            appearance="subtle"
            icon={<ArrowRight20Regular />}
            aria-label="Next page"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          />
        </div>
      </footer>
    </section>
  )
}