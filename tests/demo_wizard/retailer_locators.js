export const RetailerLocators = {
  "NavRetailer": "nav-retailer",
  "DashboardKpis": "retailer-dashboard-kpis",
  "ScheduleCalendar": "schedule-calendar",
  "ScheduleHistory": "schedule-history",
  "ScheduleHistoryRow": "schedule-history-row",
  "ScheduleManager": "schedule-manager",
  "ScheduleSlot": "schedule-slot",
  "ScheduleStoreFilter": "schedule-store-filter",
  "SlotTransition": "slot-transition",
  "ScheduleOverrideBlocked": "schedule-override-blocked",
  "SelectOverrideDay": "select-override-day",
  "SelectOverrideType": "select-override-type",
  "InputOverrideStart": "input-override-start",
  "InputOverrideEnd": "input-override-end",
  "ErrorOverrideStart": "error-override-start",
  "BtnAddScheduleOverride": "btn-add-schedule-override",
  "BtnOverrideFormSubmit": "btn-override-form-submit",
  "ModalScheduleOverrideForm": "modal-schedule-override-form",
  "BtnShiftSlot": "btn-shift-slot",
  "PendingApprovals": "pending-approvals",
  "PendingApprovalBadge": "pending-approval-badge",
  "CampaignApprovalList": "campaign-approval-list",
  "BtnApprove": "btn-approve",
  "BtnReject": "btn-reject",
  "LoopsList": "loops-list",
  "BtnAddLoop": "btn-add-loop",
  "ModalLoopForm": "modal-loop-form",
  "InputLoopName": "input-loop-name",
  "InputLoopDuration": "input-loop-duration",
  "InputLoopPaidSlots": "input-loop-paid-slots",
  "BtnLoopFormSubmit": "btn-loop-form-submit",
  "SelectLoopRetailer": "select-loop-retailer"
};

export function getLocator(page, testId) {
  if(!testId) throw new Error("Missing testId");
  return page.locator(`[data-testid="${testId}"]`);
}