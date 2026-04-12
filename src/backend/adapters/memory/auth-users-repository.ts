import { randomUUID } from 'node:crypto';

import type {
  AuthRole,
  AuthUserAdminListItem,
  AuthUserRecord,
  AuthUsersRepository,
} from '@/src/backend/ports/repositories';
import { hashPassword } from '@/src/backend/security/password';

type ResetTokenRecord = {
  userId: string;
  expiresAt: Date;
  consumedAt?: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type StoredAuthUser = AuthUserRecord & { createdAt: string; updatedAt: string };

function toPublicRecord(user: StoredAuthUser): AuthUserRecord {
  const { createdAt: _c, updatedAt: _u, ...record } = user;
  return record;
}

function toAdminListItem(user: StoredAuthUser): AuthUserAdminListItem {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    shopId: user.shopId,
    active: user.active,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class InMemoryAuthUsersRepository implements AuthUsersRepository {
  private readonly usersById = new Map<string, StoredAuthUser>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly resetTokens = new Map<string, ResetTokenRecord>();

  constructor() {
    const defaultUserEmail = process.env.USER_AUTH_EMAIL?.trim().toLowerCase() ?? 'user@ringbooker.local';
    const defaultUserPassword = process.env.USER_AUTH_PASSWORD ?? 'change_me_user_password';
    const defaultUserShopId = process.env.USER_AUTH_SHOP_ID ?? 'demo-shop';
    const defaultAdminEmail = process.env.ADMIN_AUTH_EMAIL?.trim().toLowerCase() ?? 'admin@ringbooker.local';
    const defaultAdminPassword = process.env.ADMIN_AUTH_PASSWORD ?? 'change_me_admin_password';

    void this.create({
      email: defaultUserEmail,
      role: 'user',
      shopId: defaultUserShopId,
      passwordHash: hashPassword(defaultUserPassword),
      active: true,
    });
    void this.create({
      email: defaultAdminEmail,
      role: 'admin',
      passwordHash: hashPassword(defaultAdminPassword),
      active: true,
    });
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const id = this.userIdByEmail.get(normalizeEmail(email));
    if (!id) return null;
    const row = this.usersById.get(id);
    return row ? toPublicRecord(row) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const row = this.usersById.get(id);
    return row ? toPublicRecord(row) : null;
  }

  async create(params: {
    email: string;
    role: 'user' | 'admin';
    shopId?: string | null;
    passwordHash: string;
    active?: boolean;
    mfaEnabled?: boolean;
  }): Promise<AuthUserRecord> {
    const email = normalizeEmail(params.email);
    const existingId = this.userIdByEmail.get(email);
    if (existingId) {
      const existing = this.usersById.get(existingId);
      if (existing) return toPublicRecord(existing);
    }

    const now = new Date().toISOString();
    const user: StoredAuthUser = {
      id: randomUUID(),
      email,
      role: params.role,
      shopId: params.shopId ?? null,
      passwordHash: params.passwordHash,
      active: params.active ?? true,
      mfaEnabled: params.mfaEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.usersById.set(user.id, user);
    this.userIdByEmail.set(user.email, user.id);
    return toPublicRecord(user);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const current = this.usersById.get(userId);
    if (!current) return;
    this.usersById.set(userId, {
      ...current,
      passwordHash,
      updatedAt: new Date().toISOString(),
    });
  }

  async listForAdmin(params?: { limit?: number }): Promise<AuthUserAdminListItem[]> {
    const limit = params?.limit ?? 500;
    const rows = [...this.usersById.values()]
      .map(toAdminListItem)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return rows.slice(0, limit);
  }

  async updateUserAdmin(
    userId: string,
    patch: { role?: AuthRole; active?: boolean },
  ): Promise<AuthUserAdminListItem | null> {
    const current = this.usersById.get(userId);
    if (!current) return null;
    const next: StoredAuthUser = {
      ...current,
      role: patch.role ?? current.role,
      active: patch.active ?? current.active,
      updatedAt: new Date().toISOString(),
    };
    this.usersById.set(userId, next);
    return toAdminListItem(next);
  }

  async createPasswordResetToken(params: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.resetTokens.set(params.tokenHash, {
      userId: params.userId,
      expiresAt: params.expiresAt,
    });
  }

  async consumePasswordResetToken(tokenHash: string): Promise<{ userId: string } | null> {
    const token = this.resetTokens.get(tokenHash);
    if (!token) return null;
    if (token.consumedAt) return null;
    if (token.expiresAt.getTime() <= Date.now()) return null;
    token.consumedAt = new Date();
    this.resetTokens.set(tokenHash, token);
    return { userId: token.userId };
  }
}
