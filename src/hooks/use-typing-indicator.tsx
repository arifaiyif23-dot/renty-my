import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTypingIndicator(conversationId: string, userId: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const typingChannel = supabase.channel(`typing:${conversationId}`);

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((presence: any) => presence.user_id)
          .filter(id => id !== userId);
        setTypingUsers(users);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Typing indicator channel error');
        }
      });

    setChannel(typingChannel);

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, userId]);

  const startTyping = async () => {
    if (channel) {
      await channel.track({ user_id: userId, typing: true });
    }
  };

  const stopTyping = async () => {
    if (channel) {
      await channel.untrack();
    }
  };

  return { typingUsers, startTyping, stopTyping };
}
