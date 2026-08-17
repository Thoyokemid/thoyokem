import { supabaseAdmin } from '@/lib/supabase';

const CHANNEL_NAME = 'notifications-refresh';

/**
 * Pings all connected clients to refetch /api/notifications. Sends only an
 * event name, never row data — the client still hits the permission-checked
 * API route, so no document data is ever exposed over the public channel.
 */
export async function broadcastNotificationsChanged() {
  try {
    const channel = supabaseAdmin.channel(CHANNEL_NAME);
    await channel.send({ type: 'broadcast', event: 'refresh', payload: {} });
    supabaseAdmin.removeChannel(channel);
  } catch (error) {
    console.error('Error broadcasting notifications change:', error);
  }
}
