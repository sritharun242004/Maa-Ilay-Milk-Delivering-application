import { Request } from 'express';
import prisma from '../config/prisma';

/**
 * Admin Audit Log Utility
 *
 * Tracks all administrative actions for compliance and security purposes
 * All admin operations should log their actions using these functions
 */

export type AuditAction =
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'CUSTOMER_APPROVED'
  | 'CUSTOMER_REJECTED'
  | 'DELIVERY_PERSON_ASSIGNED'
  | 'DELIVERY_PERSON_UNASSIGNED'
  | 'DELIVERY_PERSON_CREATED'
  | 'DELIVERY_PERSON_UPDATED'
  | 'DELIVERY_PERSON_DELETED'
  | 'DELIVERY_PERSON_PASSWORD_RESET'
  | 'PENALTY_IMPOSED'
  | 'WALLET_CREDITED'
  | 'WALLET_DEBITED'
  | 'INVENTORY_ADJUSTED'
  | 'SYSTEM_CONFIG_UPDATED';

export type AuditEntityType =
  | 'Customer'
  | 'DeliveryPerson'
  | 'Wallet'
  | 'Inventory'
  | 'SystemConfig'
  | 'Subscription'
  | 'BottleLedger';

interface AuditLogParams {
  adminId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  req?: Request;
}

/**
 * Create an audit log entry
 *
 * @example
 * await createAuditLog({
 *   adminId: req.user.id,
 *   action: 'CUSTOMER_UPDATED',
 *   entityType: 'Customer',
 *   entityId: customerId,
 *   oldValue: { status: 'PENDING_APPROVAL' },
 *   newValue: { status: 'ACTIVE' },
 *   req,
 * });
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const { adminId, action, entityType, entityId, oldValue, newValue, req } = params;

    // Extract IP and User-Agent from request if available
    const ipAddress = req ? (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress
    ) : undefined;

    const userAgent = req ? req.headers['user-agent'] : undefined;

    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress,
        userAgent,
      },
    });

    console.log(`[Audit] ${action} on ${entityType}:${entityId} by admin:${adminId}`);
  } catch (error) {
    // Log error but don't throw - audit log failures shouldn't break business operations
    console.error('[Audit] Failed to create audit log:', error);
  }
}

/**
 * Helper: Log customer assignment to delivery person
 */
export async function logCustomerAssignment(
  adminId: string,
  customerId: string,
  oldDeliveryPersonId: string | null,
  newDeliveryPersonId: string | null,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: newDeliveryPersonId ? 'DELIVERY_PERSON_ASSIGNED' : 'DELIVERY_PERSON_UNASSIGNED',
    entityType: 'Customer',
    entityId: customerId,
    oldValue: { deliveryPersonId: oldDeliveryPersonId },
    newValue: { deliveryPersonId: newDeliveryPersonId },
    req,
  });
}

/**
 * Helper: Log customer approval/rejection
 */
export async function logCustomerApproval(
  adminId: string,
  customerId: string,
  approved: boolean,
  reason?: string,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: approved ? 'CUSTOMER_APPROVED' : 'CUSTOMER_REJECTED',
    entityType: 'Customer',
    entityId: customerId,
    oldValue: { status: 'PENDING_APPROVAL' },
    newValue: {
      status: approved ? 'ACTIVE' : 'PENDING_APPROVAL',
      ...(reason && { rejectionReason: reason }),
    },
    req,
  });
}

/**
 * Helper: Log delivery person creation
 */
export async function logDeliveryPersonCreated(
  adminId: string,
  deliveryPersonId: string,
  deliveryPersonData: any,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: 'DELIVERY_PERSON_CREATED',
    entityType: 'DeliveryPerson',
    entityId: deliveryPersonId,
    newValue: deliveryPersonData,
    req,
  });
}

/**
 * Helper: Log delivery person update
 */
export async function logDeliveryPersonUpdated(
  adminId: string,
  deliveryPersonId: string,
  oldValue: any,
  newValue: any,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: 'DELIVERY_PERSON_UPDATED',
    entityType: 'DeliveryPerson',
    entityId: deliveryPersonId,
    oldValue,
    newValue,
    req,
  });
}

/**
 * Helper: Log password reset
 */
export async function logPasswordReset(
  adminId: string,
  deliveryPersonId: string,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: 'DELIVERY_PERSON_PASSWORD_RESET',
    entityType: 'DeliveryPerson',
    entityId: deliveryPersonId,
    newValue: { passwordResetAt: new Date() },
    req,
  });
}

/**
 * Helper: Log penalty imposed
 */
export async function logPenaltyImposed(
  adminId: string,
  customerId: string,
  penaltyDetails: any,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: 'PENALTY_IMPOSED',
    entityType: 'Customer',
    entityId: customerId,
    newValue: penaltyDetails,
    req,
  });
}

/**
 * Helper: Log wallet adjustment
 */
export async function logWalletAdjustment(
  adminId: string,
  customerId: string,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  reason: string,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: type === 'CREDIT' ? 'WALLET_CREDITED' : 'WALLET_DEBITED',
    entityType: 'Wallet',
    entityId: customerId,
    newValue: { amount, reason },
    req,
  });
}

/**
 * Helper: Log inventory adjustment
 */
export async function logInventoryAdjustment(
  adminId: string,
  inventoryId: string,
  adjustment: any,
  reason: string,
  req?: Request
): Promise<void> {
  await createAuditLog({
    adminId,
    action: 'INVENTORY_ADJUSTED',
    entityType: 'Inventory',
    entityId: inventoryId,
    newValue: { ...adjustment, reason },
    req,
  });
}

/**
 * Get recent audit logs for an admin
 */
export async function getAuditLogs(
  adminId?: string,
  limit: number = 100,
  entityType?: AuditEntityType
): Promise<any[]> {
  return prisma.adminAuditLog.findMany({
    where: {
      ...(adminId && { adminId }),
      ...(entityType && { entityType }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      Admin: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  entityType: AuditEntityType,
  entityId: string,
  limit: number = 50
): Promise<any[]> {
  return prisma.adminAuditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      Admin: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}
