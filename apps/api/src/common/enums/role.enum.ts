/** Application roles. Hierarchy is enforced in RolesGuard (SUPER_ADMIN ⊃ ADMIN ⊃ USER). */
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/** Higher number = more privilege. */
export const ROLE_RANK: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.ADMIN]: 2,
  [Role.SUPER_ADMIN]: 3,
};
