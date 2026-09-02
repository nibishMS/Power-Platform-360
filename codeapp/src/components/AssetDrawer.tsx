import { Badge, Button, Tooltip } from '@fluentui/react-components'
import {
  Copy20Regular,
  Dismiss20Regular,
  Open20Regular,
  PlugConnected20Regular,
} from '@fluentui/react-icons'
import { useState, type ReactNode } from 'react'
import type { InventoryAsset, InventoryPerson } from '../inventory/types'
import {
  formatDateTime,
  getAppKind,
  getConnectorLicense,
  getResourceLink,
  personName,
} from '../inventory/selectors'

interface AssetDrawerProps {
  asset?: InventoryAsset
  onClose: () => void
}

function initials(person: InventoryPerson | undefined, fallback?: string): string {
  const name = person?.displayName ?? fallback ?? '?'
  const parts = name.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part.slice(0, 1).toUpperCase()).join('') || '?'
}

function PersonValue({ person, fallback }: { person?: InventoryPerson; fallback?: string }) {
  return (
    <span className="preview-person">
      <span className="preview-avatar" aria-hidden="true">{initials(person, fallback)}</span>
      <span>{personName(person, fallback)}</span>
    </span>
  )
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="preview-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

async function copyValue(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    console.log(`Power Platform 360: copied ${label}`)
  } catch (error) {
    console.log(`Power Platform 360: unable to copy ${label}`, error)
  }
}

function CopyableValue({ value, label }: { value?: string; label: string }) {
  if (!value) return <>Not available</>
  return (
    <span className="preview-copy-value">
      <span>{value}</span>
      <Tooltip content={`Copy ${label}`} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<Copy20Regular />}
          onClick={() => void copyValue(value, label)}
        />
      </Tooltip>
    </span>
  )
}

function displayType(asset: InventoryAsset): string {
  if (asset.category === 'apps') return getAppKind(asset)
  if (asset.category === 'agents') return asset.agentKind ?? asset.typeLabel
  return asset.subtype ?? asset.typeLabel
}

export function AssetDrawer({ asset, onClose }: AssetDrawerProps) {
  const [tab, setTab] = useState<'overview' | 'connectors'>('overview')

  if (!asset) return null
  const resourceLink = getResourceLink(asset)

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="asset-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <h2 id="asset-drawer-title">{asset.name}</h2>
          <Tooltip content="Close details" relationship="label">
            <Button appearance="subtle" icon={<Dismiss20Regular />} onClick={onClose} />
          </Tooltip>
        </header>

        <nav className="drawer-tabs" aria-label="Asset detail views">
          <button
            type="button"
            className={tab === 'overview' ? 'drawer-tab drawer-tab--active' : 'drawer-tab'}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={tab === 'connectors' ? 'drawer-tab drawer-tab--active' : 'drawer-tab'}
            onClick={() => setTab('connectors')}
          >
            Connectors
            <Badge appearance="tint">{asset.connectors.length}</Badge>
          </button>
        </nav>

        {tab === 'overview' ? (
          <div className="drawer-content preview-content">
            <section className="preview-card" aria-labelledby="item-details-heading">
              <h3 id="item-details-heading">Item details</h3>
              <dl>
                <PreviewRow label="Name">{asset.name}</PreviewRow>
                <PreviewRow label="Owner"><PersonValue person={asset.owner} fallback={asset.ownerId} /></PreviewRow>
                <PreviewRow label="Item type">{displayType(asset)}</PreviewRow>
                <PreviewRow label="Item ID"><CopyableValue value={asset.id} label="item ID" /></PreviewRow>
                {resourceLink && (
                  <PreviewRow label="Open">
                    <a className="preview-link" href={resourceLink} target="_blank" rel="noreferrer">
                      Open in maker portal <Open20Regular />
                    </a>
                  </PreviewRow>
                )}
              </dl>
            </section>

            <section className="preview-card" aria-labelledby="environment-details-heading">
              <h3 id="environment-details-heading">Environment details</h3>
              <dl>
                <PreviewRow label="Environment">{asset.environmentName ?? 'Tenant-wide'}</PreviewRow>
                <PreviewRow label="Region">{asset.location ?? 'Not available'}</PreviewRow>
                <PreviewRow label="Managed">
                  {asset.isManagedEnvironment === undefined ? 'Not available' : asset.isManagedEnvironment ? 'Yes' : 'No'}
                </PreviewRow>
                <PreviewRow label="Default">
                  {asset.isDefaultEnvironment === undefined ? 'Not available' : asset.isDefaultEnvironment ? 'Yes' : 'No'}
                </PreviewRow>
                <PreviewRow label="Environment ID">
                  <CopyableValue value={asset.environmentId} label="environment ID" />
                </PreviewRow>
                <PreviewRow label="Environment group ID">{asset.environmentGroupId ?? '—'}</PreviewRow>
              </dl>
            </section>

            <section className="preview-card" aria-labelledby="activity-heading">
              <h3 id="activity-heading">Activity</h3>
              <dl>
                <PreviewRow label="Created by"><PersonValue person={asset.creator} fallback={asset.creatorId} /></PreviewRow>
                <PreviewRow label="Created on">{formatDateTime(asset.createdAt)}</PreviewRow>
                <PreviewRow label="Updated by"><PersonValue person={asset.modifiedBy} fallback={asset.modifiedById} /></PreviewRow>
                <PreviewRow label="Updated on">{formatDateTime(asset.lastModifiedAt)}</PreviewRow>
                <PreviewRow label="Published on">{formatDateTime(asset.publishedAt)}</PreviewRow>
              </dl>
            </section>

            {asset.category === 'apps' && (
              <section className="preview-card" aria-labelledby="app-governance-heading">
                <h3 id="app-governance-heading">App governance</h3>
                <dl>
                  <PreviewRow label="License">{getConnectorLicense(asset)}</PreviewRow>
                  <PreviewRow label="Quarantined">{asset.isQuarantined ? 'Yes' : 'No'}</PreviewRow>
                </dl>
              </section>
            )}

            {asset.category === 'flows' && (
              <section className="preview-card" aria-labelledby="flow-details-heading">
                <h3 id="flow-details-heading">Flow details</h3>
                <dl>
                  <PreviewRow label="Status">{asset.flowStatus ?? 'Unknown'}</PreviewRow>
                  <PreviewRow label="Trigger type">{asset.flowTriggerType ?? 'Unknown'}</PreviewRow>
                  <PreviewRow label="Trigger connector">{asset.flowTriggerConnector ?? 'Not available'}</PreviewRow>
                  <PreviewRow label="Trigger operation">{asset.flowTriggerOperation ?? 'Not available'}</PreviewRow>
                </dl>
              </section>
            )}

            {asset.category === 'agents' && (
              <section className="preview-card" aria-labelledby="agent-details-heading">
                <h3 id="agent-details-heading">Agent details</h3>
                <dl>
                  <PreviewRow label="Agent kind">{asset.agentKind ?? 'Unknown'}</PreviewRow>
                  <PreviewRow label="Harness">{asset.agentHarness ?? 'Standard'}</PreviewRow>
                  <PreviewRow label="Publication">{asset.publishedAt ? 'Published' : 'Draft'}</PreviewRow>
                  <PreviewRow label="Quarantined">{asset.isQuarantined ? 'Yes' : 'No'}</PreviewRow>
                </dl>
              </section>
            )}
          </div>
        ) : (
          <div className="drawer-content preview-content">
            <section className="preview-card" aria-labelledby="connector-detail-title">
              <div className="section-heading-row">
                <h3 id="connector-detail-title">Connectors</h3>
                <Badge appearance="tint">Preview</Badge>
              </div>
              {asset.connectors.length > 0 ? (
                <div className="connector-list">
                  {asset.connectors.map((connector) => (
                    <div className="connector-item" key={connector.id}>
                      <PlugConnected20Regular />
                      <span>
                        <strong>{connector.displayName}</strong>
                        <small>
                          {[connector.tier, connector.isDeprecated ? 'Deprecated' : undefined]
                            .filter(Boolean).join(' · ') || connector.id}
                        </small>
                      </span>
                      <Badge appearance="outline">{connector.operations.length} ops</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-compact">No connector usage was reported for this resource.</p>
              )}
            </section>

            <details className="raw-details">
              <summary>Raw Inventory API properties</summary>
              <pre>{JSON.stringify(asset.rawProperties, null, 2)}</pre>
            </details>
          </div>
        )}
      </aside>
    </div>
  )
}
