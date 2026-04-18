export const TENANTS = {
  uvu: {
    slug: 'uvu',
    shortName: 'UVU',
    name: 'Utah Valley University',
    themeName: 'Summit Green'
  },
  uofu: {
    slug: 'uofu',
    shortName: 'UofU',
    name: 'University of Utah',
    themeName: 'Wasatch Red'
  }
} as const;

export type TenantKey = keyof typeof TENANTS;

export const USER_ROLES = ['admin', 'teacher', 'ta', 'student'] as const;
export type UserRole = typeof USER_ROLES[number];

export const MEMBERSHIP_ROLES = ['teacher', 'ta', 'student'] as const;
export type MembershipRole = typeof MEMBERSHIP_ROLES[number];

export function isTenantKey(value: string): value is TenantKey {
  return value in TENANTS;
}

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isMembershipRole(value: string): value is MembershipRole {
  return (MEMBERSHIP_ROLES as readonly string[]).includes(value);
}
