import dotenv from 'dotenv';
dotenv.config();

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type UserRecord = {
  id: number;
  phone: string;
  name: string | null;
  timezone: string;
  created_at: string;
};

export type MessageRecord = {
  id: number;
  user_id: number;
  direction: 'inbound' | 'outbound';
  body: string;
  timestamp: string;
};

export type DailyLogRecord = {
  id: number;
  user_id: number;
  date: string;
  am_json: unknown | null;
  pm_json: unknown | null;
  created_at: string;
  updated_at: string;
};

export class DatabaseService {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
    this.client = createClient(url, key);
  }

  private normalizePhone(input: string): string {
    let clean = input.replace('whatsapp:', '').replace(/\s+/g, '').trim();
    if (!clean.startsWith('+')) clean = `+${clean}`;
    return clean;
  }

  async createUser(phone: string, name?: string | null, userTimezone: string = 'UTC'): Promise<UserRecord> {
    try {
      const normalized = this.normalizePhone(phone);
      const existing = await this.client.from('users').select('*').eq('phone', normalized).maybeSingle();
      if (existing.data) return existing.data as unknown as UserRecord;

      const userData = {
        phone: normalized,
        name: name ?? null,
        timezone: userTimezone,
        created_at: new Date().toISOString(),
      };
      const insert = await this.client.from('users').insert(userData).select('*').single();
      return insert.data as unknown as UserRecord;
    } catch (err) {
      console.error('Error creating user:', err);
      throw err;
    }
  }

  async getUserByPhone(phone: string): Promise<UserRecord | null> {
    try {
      const normalized = this.normalizePhone(phone);
      const res = await this.client.from('users').select('*').eq('phone', normalized).maybeSingle();
      return (res.data as unknown as UserRecord) || null;
    } catch (err) {
      console.error('Error getting user:', err);
      return null;
    }
  }

  async logMessage(userId: number, direction: 'inbound' | 'outbound', body: string): Promise<MessageRecord> {
    try {
      const messageData = {
        user_id: userId,
        direction,
        body,
        timestamp: new Date().toISOString(),
      };
      const res = await this.client.from('messages').insert(messageData).select('*').single();
      return res.data as unknown as MessageRecord;
    } catch (err) {
      console.error('Error logging message:', err);
      throw err;
    }
  }

  async createDailyLog(
    userId: number,
    date: string,
    am_json?: unknown | null,
    pm_json?: unknown | null
  ): Promise<DailyLogRecord> {
    try {
      const existing = await this.client
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

      const logData = {
        user_id: userId,
        date,
        am_json: am_json ?? null,
        pm_json: pm_json ?? null,
        updated_at: new Date().toISOString(),
      };

      if (existing.data) {
        const updated = await this.client
          .from('daily_logs')
          .update(logData)
          .eq('id', (existing.data as any).id)
          .select('*')
          .single();
        return updated.data as unknown as DailyLogRecord;
      } else {
        const toInsert = { ...logData, created_at: new Date().toISOString() };
        const inserted = await this.client.from('daily_logs').insert(toInsert).select('*').single();
        return inserted.data as unknown as DailyLogRecord;
      }
    } catch (err) {
      console.error('Error creating daily log:', err);
      throw err;
    }
  }

  async getDailyLog(userId: number, date: string): Promise<DailyLogRecord | null> {
    try {
      const res = await this.client
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      return (res.data as unknown as DailyLogRecord) || null;
    } catch (err) {
      console.error('Error getting daily log:', err);
      return null;
    }
  }
}

export const db = new DatabaseService();


