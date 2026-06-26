import { createClient } from '@supabase/supabase-js';
import { User, Drop } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export const isFallbackMode = !SUPABASE_URL || !SUPABASE_KEY;

if (isFallbackMode) {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    '[Database] Warning: SUPABASE_URL or SUPABASE_KEY is missing in your .env file. Falling back to In-Memory mode.'
  );
}

// Service role key is recommended since RLS is enabled by default on new projects
const supabase = isFallbackMode
  ? null
  : createClient(SUPABASE_URL!, SUPABASE_KEY!);

export const dbService = {
  // Sync active user registration
  async saveActiveUser(user: User): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('active_users').upsert({
        id: user.id,
        alias: user.alias,
        real_name: user.realName,
        avatar_url: user.avatarUrl,
        interests: user.interests,
        age: user.age,
        gender: user.gender,
        gender_preference: user.genderPreference,
        city: user.city,
        location_lat: user.location.lat,
        location_lng: user.location.lng,
        is_online: user.isOnline,
        is_visible: user.isVisible,
        stealth_mode: user.stealthMode,
        last_active: new Date(user.lastActive).toISOString(),
        socket_id: user.socketId,
      });
      if (error) console.error('[Database] Error saving user:', error.message);
    } catch (e) {
      console.error('[Database] Exception saving user:', e);
    }
  },

  // Delete active user session on disconnect purge
  async deleteActiveUser(userId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('active_users').delete().eq('id', userId);
      if (error) console.error('[Database] Error deleting user:', error.message);
    } catch (e) {
      console.error('[Database] Exception deleting user:', e);
    }
  },

  // Sync active connection links
  async saveConnection(connectionId: string, user1Id: string, user2Id: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('active_connections').upsert({
        id: connectionId,
        user1_id: user1Id,
        user2_id: user2Id,
        status: 'active',
      });
      if (error) console.error('[Database] Error saving connection:', error.message);
    } catch (e) {
      console.error('[Database] Exception saving connection:', e);
    }
  },

  // Delete connection link
  async deleteConnection(connectionId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('active_connections').delete().eq('id', connectionId);
      if (error) console.error('[Database] Error deleting connection:', error.message);
    } catch (e) {
      console.error('[Database] Exception deleting connection:', e);
    }
  },

  // Log moderation reports
  async saveReport(reporterId: string, targetId: string, connectionId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: reporterId,
        target_id: targetId,
        connection_id: connectionId,
      });
      if (error) console.error('[Database] Error saving report:', error.message);
    } catch (e) {
      console.error('[Database] Exception saving report:', e);
    }
  },

  // Dismiss user reports
  async dismissReports(targetUserId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('reports').delete().eq('target_id', targetUserId);
      if (error) console.error('[Database] Error dismissing reports:', error.message);
    } catch (e) {
      console.error('[Database] Exception dismissing reports:', e);
    }
  },

  // Check if a user ID is banned
  async isUserBanned(userId: string): Promise<boolean> {
    if (isFallbackMode || !supabase) return false;
    try {
      const { data, error } = await supabase
        .from('banned_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('[Database] Error checking ban status:', error.message);
        return false;
      }
      return !!data;
    } catch (e) {
      console.error('[Database] Exception checking ban status:', e);
      return false;
    }
  },

  // Add banned user
  async saveBannedUser(userId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('banned_users').upsert({ user_id: userId });
      if (error) console.error('[Database] Error saving banned user:', error.message);
    } catch (e) {
      console.error('[Database] Exception saving banned user:', e);
    }
  },

  // Remove banned user
  async removeBannedUser(userId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('banned_users').delete().eq('user_id', userId);
      if (error) console.error('[Database] Error removing banned user:', error.message);
    } catch (e) {
      console.error('[Database] Exception removing banned user:', e);
    }
  },

  // Load all active users on startup
  async getActiveUsers(): Promise<User[]> {
    if (isFallbackMode || !supabase) return [];
    try {
      const { data, error } = await supabase.from('active_users').select('*');
      if (error) {
        console.error('[Database] Error loading active users:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        alias: row.alias,
        realName: row.real_name,
        avatarUrl: row.avatar_url,
        interests: row.interests || [],
        age: row.age,
        gender: row.gender,
        genderPreference: row.gender_preference,
        city: row.city,
        location: { lat: row.location_lat, lng: row.location_lng },
        lastActive: new Date(row.last_active).getTime(),
        socketId: row.socket_id,
        isOnline: row.is_online,
        isVisible: row.is_visible,
        stealthMode: row.stealth_mode,
      }));
    } catch (e) {
      console.error('[Database] Exception loading active users:', e);
      return [];
    }
  },

  // Load all active connections on startup
  async getActiveConnections(): Promise<{ id: string; user1Id: string; user2Id: string }[]> {
    if (isFallbackMode || !supabase) return [];
    try {
      const { data, error } = await supabase.from('active_connections').select('*');
      if (error) {
        console.error('[Database] Error loading active connections:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        user1Id: row.user1_id,
        user2Id: row.user2_id,
      }));
    } catch (e) {
      console.error('[Database] Exception loading active connections:', e);
      return [];
    }
  },

  // Load banned user IDs list
  async getBannedUsers(): Promise<string[]> {
    if (isFallbackMode || !supabase) return [];
    try {
      const { data, error } = await supabase.from('banned_users').select('user_id');
      if (error) {
        console.error('[Database] Error loading banned users:', error.message);
        return [];
      }
      return (data || []).map((row: any) => row.user_id);
    } catch (e) {
      console.error('[Database] Exception loading banned users:', e);
      return [];
    }
  },

  // Load reports count breakdown
  async getReportsCount(): Promise<Map<string, number>> {
    const reportMap = new Map<string, number>();
    if (isFallbackMode || !supabase) return reportMap;
    try {
      const { data, error } = await supabase.from('reports').select('target_id');
      if (error) {
        console.error('[Database] Error loading reports count:', error.message);
        return reportMap;
      }
      (data || []).forEach((row: any) => {
        const count = reportMap.get(row.target_id) || 0;
        reportMap.set(row.target_id, count + 1);
      });
    } catch (e) {
      console.error('[Database] Exception loading reports count:', e);
    }
    return reportMap;
  },

  // Sync active drops
  async saveDrop(drop: Drop): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('drops').upsert({
        id: drop.id,
        user_id: drop.userId,
        type: drop.type,
        content_url: drop.contentUrl,
        message_text: drop.messageText,
        duration: drop.duration,
        city: drop.city,
        location_lat: drop.location.lat,
        location_lng: drop.location.lng,
        status: drop.status,
        created_at: new Date(drop.createdAt).toISOString(),
      });
      if (error) console.error('[Database] Error saving drop:', error.message);
    } catch (e) {
      console.error('[Database] Exception saving drop:', e);
    }
  },

  // Delete drop row
  async deleteDrop(dropId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('drops').delete().eq('id', dropId);
      if (error) console.error('[Database] Error deleting drop:', error.message);
    } catch (e) {
      console.error('[Database] Exception deleting drop:', e);
    }
  },

  // Log connection waves on drops
  async createDropRequest(dropId: string, senderId: string, receiverId: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.from('drop_requests').insert({
        drop_id: dropId,
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending'
      });
      if (error) console.error('[Database] Error creating drop request:', error.message);
    } catch (e) {
      console.error('[Database] Exception creating drop request:', e);
    }
  },

  // Accept request, update status, and return connection ID
  async acceptDropAndCreateConnection(dropId: string, requestId: string, senderId: string, receiverId: string): Promise<string> {
    const connId = `conn-${Math.random().toString(36).substring(2, 9)}`;
    if (isFallbackMode || !supabase) return connId;
    try {
      // 1. Mark drop request as accepted
      await supabase.from('drop_requests').update({ status: 'accepted' }).eq('id', requestId);
      // 2. Mark drop as accepted
      await supabase.from('drops').update({ status: 'accepted' }).eq('id', dropId);
      // 3. Create active connection pairing
      await supabase.from('active_connections').upsert({
        id: connId,
        user1_id: senderId,
        user2_id: receiverId,
        status: 'active'
      });
    } catch (e) {
      console.error('[Database] Exception accepting drop & creating connection:', e);
    }
    return connId;
  },

  // Load active drops on startup
  async getActiveDrops(): Promise<Drop[]> {
    if (isFallbackMode || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('status', 'active');
      if (error) {
        console.error('[Database] Error loading active drops:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        contentUrl: row.content_url,
        messageText: row.message_text,
        duration: row.duration,
        city: row.city,
        location: { lat: row.location_lat, lng: row.location_lng },
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
      }));
    } catch (e) {
      console.error('[Database] Exception loading active drops:', e);
      return [];
    }
  },

  // Delete audio file from storage bucket
  async deleteAudioFile(filePath: string): Promise<void> {
    if (isFallbackMode || !supabase) return;
    try {
      const { error } = await supabase.storage.from('audio_drops').remove([filePath]);
      if (error) console.error('[Database] Error deleting audio file:', error.message);
    } catch (e) {
      console.error('[Database] Exception deleting audio file:', e);
    }
  },

  // Upload audio file from base64 string
  async uploadAudio(fileName: string, base64Data: string): Promise<string | null> {
    if (isFallbackMode || !supabase) return null;
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const { data, error } = await supabase.storage
        .from('audio_drops')
        .upload(fileName, buffer, {
          contentType: 'audio/webm',
          upsert: true
        });
      if (error) {
        console.error('[Database] Error uploading audio file:', error.message);
        return null;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('audio_drops')
        .getPublicUrl(fileName);
        
      return publicUrlData.publicUrl;
    } catch (e) {
      console.error('[Database] Exception uploading audio file:', e);
      return null;
    }
  }
};
