/**
 * pages/retailer/CampaignApprovalList.jsx
 *
 * Re-export of the canonical shared component.
 * Source of truth: client-app/src/components/CampaignApprovalList.jsx
 *
 * This file exists so the lazy route in App.jsx:
 *   const CampaignApprovals = lazy(() => import('./pages/retailer/CampaignApprovalList'));
 * resolves to the same module as RetailerDashboard's inline import:
 *   import CampaignApprovalList from '../../components/CampaignApprovalList';
 *
 * DO NOT duplicate logic here. All changes go in components/CampaignApprovalList.jsx.
 */
export { default } from '../../components/CampaignApprovalList.jsx';
