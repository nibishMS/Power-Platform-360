import {
  GroupList24Regular,
  PlugConnected24Regular,
} from '@fluentui/react-icons'
import copilotStudioIcon from '../assets/power-platform/copilot-studio.svg'
import dataverseIcon from '../assets/power-platform/dataverse.svg'
import powerAppsIcon from '../assets/power-platform/power-apps.svg'
import powerAutomateIcon from '../assets/power-platform/power-automate.svg'
import powerPlatformIcon from '../assets/power-platform/power-platform.svg'
import { RESOURCE_TYPES, type AssetCategory } from '../inventory/types'

export type Workload = AssetCategory | 'overview' | 'environmentGroups'

interface WorkloadIconProps {
  workload?: Workload
  resourceType?: string
  className?: string
  label?: string
}

function iconFor(resourceType: string | undefined, workload: Workload) {
  if (
    resourceType === RESOURCE_TYPES.canvasApp ||
    resourceType === RESOURCE_TYPES.modelDrivenApp ||
    resourceType === RESOURCE_TYPES.codeApp ||
    resourceType === RESOURCE_TYPES.appBuilderApp
  ) return <img src={powerAppsIcon} alt="" />
  if (
    resourceType === RESOURCE_TYPES.cloudFlow ||
    resourceType === RESOURCE_TYPES.agentFlow ||
    resourceType === RESOURCE_TYPES.workflowAgentFlow
  ) return <img src={powerAutomateIcon} alt="" />
  if (resourceType === RESOURCE_TYPES.agent) return <img src={copilotStudioIcon} alt="" />
  if (resourceType === RESOURCE_TYPES.connector) return <PlugConnected24Regular />
  if (resourceType === RESOURCE_TYPES.environmentGroup) return <GroupList24Regular />
  if (resourceType === RESOURCE_TYPES.environment) return <img src={dataverseIcon} alt="" />

  if (workload === 'apps') return <img src={powerAppsIcon} alt="" />
  if (workload === 'flows') return <img src={powerAutomateIcon} alt="" />
  if (workload === 'agents') return <img src={copilotStudioIcon} alt="" />
  if (workload === 'environments') return <img src={dataverseIcon} alt="" />
  if (workload === 'environmentGroups') return <GroupList24Regular />
  if (workload === 'connectors') return <PlugConnected24Regular />
  return <img src={powerPlatformIcon} alt="" />
}

export function WorkloadIcon({
  workload = 'overview',
  resourceType,
  className,
  label,
}: WorkloadIconProps) {
  return (
    <span
      className={`workload-icon workload-icon--${workload} ${className ?? ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {iconFor(resourceType, workload)}
    </span>
  )
}