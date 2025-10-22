import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { Message, Profile } from "@/types";
import Header from "@/components/Header";

interface Conversation {
  userId: string;
  userName: string;
  userAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUserId && user) {
      fetchMessages(selectedUserId);
      
      const channel = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (
              (newMsg.sender_id === selectedUserId && newMsg.recipient_id === user.id) ||
              (newMsg.sender_id === user.id && newMsg.recipient_id === selectedUserId)
            ) {
              setMessages(prev => [...prev, newMsg]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUserId, user]);

  const fetchConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    const conversationMap = new Map<string, Conversation>();
    
    data?.forEach((msg: any) => {
      const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      const otherUser = msg.sender_id === user.id ? msg.recipient : msg.sender;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUser?.full_name || 'Unknown User',
          userAvatar: otherUser?.avatar_url,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unreadCount: msg.recipient_id === user.id && !msg.is_read ? 1 : 0,
        });
      }
    });

    setConversations(Array.from(conversationMap.values()));
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', user.id);
  };

  const sendMessage = async () => {
    if (!user || !selectedUserId || !newMessage.trim()) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: selectedUserId,
        content: newMessage.trim(),
      });

    if (error) {
      toast.error('Failed to send message');
      return;
    }

    setNewMessage("");
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        Please log in to view messages
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pb-mobile-nav max-w-7xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Messages</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] md:h-[600px]">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  onClick={() => setSelectedUserId(conv.userId)}
                  className={`p-3 md:p-4 cursor-pointer hover:bg-accent border-b transition-colors min-h-[60px] ${
                    selectedUserId === conv.userId ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 md:h-12 md:w-12">
                      <AvatarImage src={conv.userAvatar} />
                      <AvatarFallback>{conv.userName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base truncate">{conv.userName}</div>
                      <div className="text-xs md:text-sm text-muted-foreground truncate">
                        {conv.lastMessage}
                      </div>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs flex-shrink-0">
                        {conv.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No conversations yet</p>
                  <p className="text-xs mt-2">Messages will appear here when you start chatting</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages Thread */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {selectedUserId
                ? conversations.find(c => c.userId === selectedUserId)?.userName
                : 'Select a conversation'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {selectedUserId ? (
              <>
                <ScrollArea className="h-[380px] md:h-[480px] mb-3 md:mb-4 pr-2">
                  <div className="space-y-3 md:space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] md:max-w-[70%] rounded-lg p-2.5 md:p-3 ${
                            msg.sender_id === user.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="text-sm md:text-base break-words">{msg.content}</div>
                          <div className="text-[10px] md:text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    className="min-h-[44px]"
                  />
                  <Button 
                    onClick={sendMessage} 
                    size="icon"
                    disabled={!newMessage.trim()}
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-[440px] md:h-[540px] flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                <p className="text-base md:text-lg mb-2">Select a conversation</p>
                <p className="text-xs md:text-sm">Choose a conversation from the list to start messaging</p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
