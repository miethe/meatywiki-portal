/**
 * Decisions API — typed wrappers for the Decision Framework CRUD endpoints.
 *
 * Endpoints:
 *   GET  /api/decisions/tables                         — list tables
 *   GET  /api/decisions/tables/{id}                    — get table with rows
 *   POST /api/decisions/tables                         — create table
 *   PATCH /api/decisions/tables/{id}                  — update table metadata
 *   DELETE /api/decisions/tables/{id}                 — delete table
 *   POST /api/decisions/tables/{id}/rows              — create row
 *   PATCH /api/decisions/tables/{id}/rows/{row_id}    — update row
 *   DELETE /api/decisions/tables/{id}/rows/{row_id}   — delete row
 *
 * P2-5-03: Decision Framework interactive table UI.
 */

import { api } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionTableSummary {
  id: string;
  name: string;
  description: string | null;
  row_count: number;
  created_at: string;
  updated_at: string;
}

export interface DecisionRow {
  id: string;
  table_id: string;
  criterion: string;
  weight: number;
  rule_text: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionTable extends DecisionTableSummary {
  rows: DecisionRow[];
}

export interface DecisionTablesEnvelope {
  data: DecisionTableSummary[];
  cursor: string | null;
  total?: number;
}

// ---------------------------------------------------------------------------
// Table operations
// ---------------------------------------------------------------------------

export function listDecisionTables(limit = 50, cursor?: string): Promise<DecisionTablesEnvelope> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return api.get<DecisionTablesEnvelope>(`/api/decisions/tables?${params}`);
}

export function getDecisionTable(id: string): Promise<DecisionTable> {
  return api.get<DecisionTable>(`/api/decisions/tables/${id}`);
}

export function createDecisionTable(payload: {
  name: string;
  description?: string;
}): Promise<DecisionTable> {
  return api.post<DecisionTable>("/api/decisions/tables", payload);
}

export function updateDecisionTable(
  id: string,
  payload: { name?: string; description?: string },
): Promise<DecisionTable> {
  return api.patch<DecisionTable>(`/api/decisions/tables/${id}`, payload);
}

export function deleteDecisionTable(id: string): Promise<void> {
  return api.delete<void>(`/api/decisions/tables/${id}`);
}

// ---------------------------------------------------------------------------
// Row operations
// ---------------------------------------------------------------------------

export function createDecisionRow(
  tableId: string,
  payload: { criterion: string; weight: number; rule_text: string },
): Promise<DecisionRow> {
  return api.post<DecisionRow>(`/api/decisions/tables/${tableId}/rows`, payload);
}

export function updateDecisionRow(
  tableId: string,
  rowId: string,
  payload: { criterion?: string; weight?: number; rule_text?: string },
): Promise<DecisionRow> {
  return api.patch<DecisionRow>(
    `/api/decisions/tables/${tableId}/rows/${rowId}`,
    payload,
  );
}

export function deleteDecisionRow(tableId: string, rowId: string): Promise<void> {
  return api.delete<void>(`/api/decisions/tables/${tableId}/rows/${rowId}`);
}
