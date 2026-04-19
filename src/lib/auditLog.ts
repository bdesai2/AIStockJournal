import { db } from './supabase'

export type AuditLogAction =
  | 'EXPORT_DATA'
  | 'DELETE_ACCOUNT'
  | 'DELETE_TRADE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PROFILE_UPDATE'
  | 'ACCOUNT_CREATE'
  | 'ACCOUNT_DELETE'
  | 'TRADE_CREATE'
  | 'TRADE_EDIT'

export interface AuditLog {
  id: string
  user_id: string
  action: AuditLogAction
  details: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

/**
 * Log a sensitive action for audit trail
 * Retained for 1 year for compliance
 */
export async function logAuditEvent(
  userId: string,
  action: AuditLogAction,
  details: Record<string, unknown> = {}
) {
  try {
    const userAgent = navigator.userAgent
    const now = new Date().toISOString()

    // Insert audit log
    await db.audit_logs().insert({
      user_id: userId,
      action,
      details,
      user_agent: userAgent,
      created_at: now,
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
    // Don't throw - audit logging failure shouldn't break the app
  }
}

/**
 * Get audit logs for current user (recent 90 days)
 */
export async function fetchAuditLogs(userId: string) {
  try {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data, error } = await db
      .audit_logs()
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
}

/**
 * Export audit logs for user (GDPR compliance)
 */
export async function exportAuditLogs(userId: string) {
  try {
    // Fetch all audit logs (not just 90 days)
    const { data, error } = await db
      .audit_logs()
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Failed to export audit logs:', error)
    return []
  }
}
