'use strict'

/**
 * 后台分级权限鉴权
 * - admin：超级管理员，全权限（含删除）
 * - auditor：普通管理员，可审核；浏览权由 schema 放行；删除不对审核员开放
 *
 * 权限点约定：
 * - AUDIT_TEACHER / AUDIT_REFUND / AUDIT_RECRUITMENT
 */

const PERMISSION = {
  AUDIT_TEACHER: 'AUDIT_TEACHER',
  AUDIT_REFUND: 'AUDIT_REFUND',
  AUDIT_RECRUITMENT: 'AUDIT_RECRUITMENT'
}

function normalizeList(val) {
  if (Array.isArray(val)) return val.filter(Boolean).map(String)
  if (val == null || val === '') return []
  return [String(val)]
}

async function loadUserAccess(ctx) {
  const token = ctx.getUniIdToken && ctx.getUniIdToken()
  if (!token) {
    throw new Error('未登录')
  }
  if (!ctx.uniID || typeof ctx.uniID.checkToken !== 'function') {
    throw new Error('鉴权未初始化')
  }

  const payload = await ctx.uniID.checkToken(token)
  if (payload && payload.code) {
    throw new Error(payload.message || 'token无效，请重新登录')
  }

  let uid = payload.uid
  let roles = normalizeList(payload.role)
  let permissions = normalizeList(payload.permission)

  // token 权限不全时回查用户与角色表
  if (uid && (!roles.length || (!permissions.length && !roles.includes('admin')))) {
    const db = uniCloud.database()
    const userDoc = await db.collection('uni-id-users').doc(uid).field({ role: true }).get()
    const user = userDoc.data && userDoc.data[0]
    if (user) {
      roles = normalizeList(user.role)
    }
    if (roles.length && !roles.includes('admin')) {
      const roleDoc = await db.collection('uni-id-roles')
        .where({ role_id: db.command.in(roles) })
        .field({ permission: true, role_id: true })
        .get()
      const merged = new Set(permissions)
      ;(roleDoc.data || []).forEach((r) => {
        normalizeList(r.permission).forEach((p) => merged.add(p))
      })
      permissions = Array.from(merged)
    }
  }

  return {
    uid,
    roles,
    permissions,
    isSuperAdmin: roles.includes('admin')
  }
}

/**
 * @param {object} ctx 云对象 this
 * @param {string[]} requiredPermissions 需要的权限点（满足其一即可；超管旁路）
 * @returns {Promise<{uid, roles, permissions, isSuperAdmin}>}
 */
async function assertStaffAccess(ctx, requiredPermissions = []) {
  const access = await loadUserAccess(ctx)
  if (access.isSuperAdmin) return access

  const need = normalizeList(requiredPermissions)
  if (!need.length) {
    // 未指定权限点时：auditor / 任意后台角色也可进入（谨慎使用）
    if (access.roles.includes('auditor') || access.permissions.length > 0) {
      return access
    }
    throw new Error('需要管理员权限')
  }

  const ok = need.some((p) => access.permissions.includes(p))
  if (!ok) {
    throw new Error(`无权限：需要 ${need.join(' 或 ')}`)
  }
  return access
}

async function assertSuperAdmin(ctx) {
  const access = await loadUserAccess(ctx)
  if (!access.isSuperAdmin) {
    throw new Error('需要超级管理员权限')
  }
  return access
}

module.exports = {
  PERMISSION,
  loadUserAccess,
  assertStaffAccess,
  assertSuperAdmin
}
