import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AuthUserAdminListItem,
  AuthUserRecord,
  AuthUsersRepository,
} from '@/src/backend/ports/repositories';

type AuthUsersRow = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  shop_id: string | null;
  password_hash: string;
  active: boolean | null;
  mfa_enabled: boolean | null;
};

type AuthUsersAdminRow = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  shop_id: string | null;
  active: boolean | null;
  mfa_enabled: boolean | null;
  created_at: string;
  updated_at: string;
};

function toAuthUser(row: AuthUsersRow): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    shopId: row.shop_id,
    passwordHash: row.password_hash,
    active: row.active ?? true,
    mfaEnabled: row.mfa_enabled ?? false,
  };
}

function toAdminListItem(row: AuthUsersAdminRow): AuthUserAdminListItem {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    shopId: row.shop_id,
    active: row.active ?? true,
    mfaEnabled: row.mfa_enabled ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseAuthUsersRepository implements AuthUsersRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const { data, error } = await this.supabase
      .from('auth_users')
      .select('id,email,role,shop_id,password_hash,active,mfa_enabled')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle<AuthUsersRow>();

    if (error) throw new Error(`auth_users_find_by_email_failed:${error.message}`);
    return data ? toAuthUser(data) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const { data, error } = await this.supabase
      .from('auth_users')
      .select('id,email,role,shop_id,password_hash,active,mfa_enabled')
      .eq('id', id)
      .maybeSingle<AuthUsersRow>();
    if (error) throw new Error(`auth_users_find_by_id_failed:${error.message}`);
    return data ? toAuthUser(data) : null;
  }

  async create(params: {
    email: string;
    role: 'user' | 'admin';
    shopId?: string | null;
    passwordHash: string;
    active?: boolean;
    mfaEnabled?: boolean;
  }): Promise<AuthUserRecord> {
    const { data, error } = await this.supabase
      .from('auth_users')
      .insert({
        email: params.email.trim().toLowerCase(),
        role: params.role,
        shop_id: params.shopId ?? null,
        password_hash: params.passwordHash,
        active: params.active ?? true,
        mfa_enabled: params.mfaEnabled ?? false,
      })
      .select('id,email,role,shop_id,password_hash,active,mfa_enabled')
      .single<AuthUsersRow>();
    if (error) throw new Error(`auth_users_create_failed:${error.message}`);
    return toAuthUser(data);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const { error } = await this.supabase
      .from('auth_users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) throw new Error(`auth_users_update_password_hash_failed:${error.message}`);
  }

  async listForAdmin(params?: { limit?: number }): Promise<AuthUserAdminListItem[]> {
    const limit = params?.limit ?? 500;
    const { data, error } = await this.supabase
      .from('auth_users')
      .select('id,email,role,shop_id,active,mfa_enabled,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`auth_users_list_for_admin_failed:${error.message}`);
    return (data as AuthUsersAdminRow[] | null)?.map(toAdminListItem) ?? [];
  }

  async updateUserAdmin(
    userId: string,
    patch: { role?: 'user' | 'admin'; active?: boolean },
  ): Promise<AuthUserAdminListItem | null> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.role !== undefined) updates.role = patch.role;
    if (patch.active !== undefined) updates.active = patch.active;

    const { data, error } = await this.supabase
      .from('auth_users')
      .update(updates)
      .eq('id', userId)
      .select('id,email,role,shop_id,active,mfa_enabled,created_at,updated_at')
      .maybeSingle<AuthUsersAdminRow>();

    if (error) throw new Error(`auth_users_update_admin_failed:${error.message}`);
    return data ? toAdminListItem(data) : null;
  }

  async createPasswordResetToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const { error } = await this.supabase.from('auth_password_reset_tokens').insert({
      user_id: params.userId,
      token_hash: params.tokenHash,
      expires_at: params.expiresAt.toISOString(),
    });
    if (error) throw new Error(`auth_password_reset_tokens_create_failed:${error.message}`);
  }

  async consumePasswordResetToken(tokenHash: string): Promise<{ userId: string } | null> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('auth_password_reset_tokens')
      .select('id,user_id,consumed_at,expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle<{ id: string; user_id: string; consumed_at: string | null; expires_at: string }>();

    if (error) throw new Error(`auth_password_reset_tokens_find_failed:${error.message}`);
    if (!data) return null;
    if (data.consumed_at) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) return null;

    const { error: updateError } = await this.supabase
      .from('auth_password_reset_tokens')
      .update({
        consumed_at: nowIso,
      })
      .eq('id', data.id)
      .is('consumed_at', null);
    if (updateError) throw new Error(`auth_password_reset_tokens_consume_failed:${updateError.message}`);

    return { userId: data.user_id };
  }
}
