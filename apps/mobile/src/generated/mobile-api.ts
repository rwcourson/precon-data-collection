/* AUTO-GENERATED — do not edit. Run: node scripts/generate-openapi.mjs */
export type MobileOperation = {
  method: string;
  path: string;
  operationId: string;
  scopes: string[];
};

export const MOBILE_OPERATIONS: MobileOperation[] = [
  {
    "method": "GET",
    "path": "/api/v1/mobile/admin",
    "operationId": "get__api_v1_mobile_admin",
    "scopes": [
      "read:admin",
      "write:admin"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/admin",
    "operationId": "post__api_v1_mobile_admin",
    "scopes": [
      "read:admin",
      "write:admin"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/auth/demo",
    "operationId": "post__api_v1_mobile_auth_demo",
    "scopes": [
      "profile:read"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/bid-schedule",
    "operationId": "get__api_v1_mobile_bidschedule",
    "scopes": [
      "profile:read"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/copilot",
    "operationId": "post__api_v1_mobile_copilot",
    "scopes": [
      "read:dashboards"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/dashboards/{id}",
    "operationId": "get__api_v1_mobile_dashboards_id",
    "scopes": [
      "read:dashboards",
      "write:dashboards"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/dashboards",
    "operationId": "get__api_v1_mobile_dashboards",
    "scopes": [
      "read:dashboards",
      "write:dashboards"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/dashboards",
    "operationId": "post__api_v1_mobile_dashboards",
    "scopes": [
      "read:dashboards",
      "write:dashboards"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/mobile/dashboards",
    "operationId": "patch__api_v1_mobile_dashboards",
    "scopes": [
      "read:dashboards",
      "write:dashboards"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/forecast",
    "operationId": "get__api_v1_mobile_forecast",
    "scopes": [
      "read:reports"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/jobs/{id}",
    "operationId": "get__api_v1_mobile_jobs_id",
    "scopes": [
      "read:pursuits"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/me",
    "operationId": "get__api_v1_mobile_me",
    "scopes": [
      "profile:read"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/notifications",
    "operationId": "get__api_v1_mobile_notifications",
    "scopes": [
      "read:notifications"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/notifications",
    "operationId": "post__api_v1_mobile_notifications",
    "scopes": [
      "read:notifications"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/overview",
    "operationId": "get__api_v1_mobile_overview",
    "scopes": [
      "read:pursuits"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/pursuits",
    "operationId": "post__api_v1_mobile_pursuits",
    "scopes": [
      "write:pursuits"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/reconciliation",
    "operationId": "get__api_v1_mobile_reconciliation",
    "scopes": [
      "read:reports"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/reconciliation",
    "operationId": "post__api_v1_mobile_reconciliation",
    "scopes": [
      "read:reports"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/reports/annual",
    "operationId": "get__api_v1_mobile_reports_annual",
    "scopes": [
      "read:reports"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/reports",
    "operationId": "get__api_v1_mobile_reports",
    "scopes": [
      "read:reports"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/reports",
    "operationId": "post__api_v1_mobile_reports",
    "scopes": [
      "read:reports"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/rounds/{id}/approve-lock",
    "operationId": "post__api_v1_mobile_rounds_id_approvelock",
    "scopes": [
      "read:pursuits",
      "write:pursuits"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/rounds/{id}/outcome",
    "operationId": "post__api_v1_mobile_rounds_id_outcome",
    "scopes": [
      "read:pursuits",
      "write:pursuits"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/rounds/{id}",
    "operationId": "get__api_v1_mobile_rounds_id",
    "scopes": [
      "read:pursuits",
      "write:pursuits"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/rounds/{id}",
    "operationId": "post__api_v1_mobile_rounds_id",
    "scopes": [
      "read:pursuits",
      "write:pursuits"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/v1/mobile/rounds/{id}",
    "operationId": "put__api_v1_mobile_rounds_id",
    "scopes": [
      "read:pursuits",
      "write:pursuits"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/rounds/{id}/transition",
    "operationId": "post__api_v1_mobile_rounds_id_transition",
    "scopes": [
      "read:pursuits",
      "write:pursuits"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/salesforce/search",
    "operationId": "get__api_v1_mobile_salesforce_search",
    "scopes": [
      "integrate:connect"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/search",
    "operationId": "get__api_v1_mobile_search",
    "scopes": [
      "read:pursuits"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/sheets/{id}",
    "operationId": "get__api_v1_mobile_sheets_id",
    "scopes": [
      "read:sheets",
      "write:sheets"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/mobile/sheets/{id}",
    "operationId": "patch__api_v1_mobile_sheets_id",
    "scopes": [
      "read:sheets",
      "write:sheets"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/sheets",
    "operationId": "get__api_v1_mobile_sheets",
    "scopes": [
      "read:sheets",
      "write:sheets"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/sheets",
    "operationId": "post__api_v1_mobile_sheets",
    "scopes": [
      "read:sheets",
      "write:sheets"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/trash",
    "operationId": "get__api_v1_mobile_trash",
    "scopes": [
      "read:trash",
      "write:trash"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/trash",
    "operationId": "post__api_v1_mobile_trash",
    "scopes": [
      "read:trash",
      "write:trash"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/mobile/users",
    "operationId": "get__api_v1_mobile_users",
    "scopes": [
      "profile:read"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/mobile/workspace",
    "operationId": "post__api_v1_mobile_workspace",
    "scopes": [
      "profile:read"
    ]
  }
] as const;

export type GeneratedMobileClient = {
  baseUrl: string;
  operations: typeof MOBILE_OPERATIONS;
};

export function createGeneratedMobileClient(baseUrl: string): GeneratedMobileClient {
  if (process.env.NODE_ENV === "production" && !baseUrl.startsWith("https://")) {
    throw new Error("Release builds require HTTPS API base URLs.");
  }
  return { baseUrl, operations: MOBILE_OPERATIONS };
}
