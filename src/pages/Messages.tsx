import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, FileImage, File as FileIcon } from "lucide-react";
import { FileAttachment } from "@/components/FileAttachment";
import { toast } from "sonner";
import type { Message, Profile } from "@/types";
import Header from "@/components/Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { sanitizeMessage } from "@/utils/sanitize";

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
  const [showThread, setShowThread] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState("");

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
    if (!user || !selectedUserId || (!newMessage.trim() && !attachmentUrl)) return;

    // Sanitize message content to prevent XSS
    const sanitizedContent = newMessage.trim() 
      ? sanitizeMessage(newMessage.trim()) 
      : '📎 Attachment';

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: selectedUserId,
        content: sanitizedContent,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        delivered_at: new Date().toISOString(),
      });

    if (error) {
      toast.error('Failed to send message');
      return;
    }

    setNewMessage("");
    setAttachmentUrl("");
    setAttachmentType("");
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        Please log in to view messages
      </div>
    );
  }

  const isMobile = useIsMobile();
  const selectedConversation = conversations.find(c => c.userId === selectedUserId);

  const handleSelectConversation = (userId: string) => {
    setSelectedUserId(userId);
    if (isMobile) {
      setShowThread(true);
    }
  };

  const handleBackToList = () => {
    setShowThread(false);
    setSelectedUserId(null);
  };

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pb-mobile-nav max-w-7xl">
        {/* Mobile: Conditionally show list OR thread */}
        {isMobile ? (
          <>
            {!showThread ? (
              <div>
                <h1 className="text-2xl font-bold mb-6">Messages</h1>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Conversations</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-250px)]">
                      {conversations.map((conv) => (
                        <div
                          key={conv.userId}
                          onClick={() => handleSelectConversation(conv.userId)}
                          className="p-4 cursor-pointer hover:bg-accent border-b transition-colors active:scale-[0.98] min-h-[72px]"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 flex-shrink-0">
                              <AvatarImage src={conv.userAvatar} />
                              <AvatarFallback>{conv.userName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-base truncate">{conv.userName}</div>
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {conv.lastMessage}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(conv.lastMessageTime).toLocaleString('en-MY', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                            {conv.unreadCount > 0 && (
                              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0 animate-pulse">
                                {conv.unreadCount}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {conversations.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                          <p className="text-base">No conversations yet</p>
                          <p className="text-sm mt-2">Messages will appear here when you start chatting</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="h-[calc(100vh-80px)] flex flex-col">
                {/* Thread Header with Back Button */}
                <div className="sticky top-0 z-10 bg-card border-b p-4 flex items-center gap-3 min-h-[60px]">
                  <Button variant="ghost" size="icon" onClick={handleBackToList} className="flex-shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={selectedConversation?.userAvatar} />
                    <AvatarFallback>{selectedConversation?.userName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-base truncate">{selectedConversation?.userName}</span>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                            msg.sender_id === user.id
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm'
                          }`}
                        >
                          {msg.attachment_url && (
                            <div className="mb-2">
                              {msg.attachment_type === 'image' ? (
                                <img 
                                  src={msg.attachment_url} 
                                  alt="Attachment" 
                                  className="rounded-lg max-w-full h-auto"
                                />
                              ) : (
                                <a 
                                  href={msg.attachment_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm underline"
                                >
                                  <FileIcon className="h-4 w-4" />
                                  View Document
                                </a>
                              )}
                            </div>
                          )}
                          <div className="text-base break-words">{msg.content}</div>
                          <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString('en-MY', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            {msg.sender_id === user.id && msg.read_at && (
                              <span className="ml-1">✓✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Input Bar - Sticky at bottom */}
                <div className="sticky bottom-0 bg-card border-t p-4">
                  <div className="space-y-2">
                    <FileAttachment 
                      onFileSelect={(url, type) => {
                        setAttachmentUrl(url);
                        setAttachmentType(type);
                      }}
                      disabled={false}
                    />
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        className="h-12 text-base"
                      />
                      <Button 
                        onClick={sendMessage} 
                        size="icon"
                        disabled={!newMessage.trim() && !attachmentUrl}
                        className="h-12 w-12 flex-shrink-0"
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Desktop: Show both list and thread side by side */}
            <h1 className="text-3xl font-bold mb-6">Messages</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Conversations List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    {conversations.map((conv) => (
                      <div
                        key={conv.userId}
                        onClick={() => setSelectedUserId(conv.userId)}
                        className={`p-4 cursor-pointer hover:bg-accent border-b transition-colors min-h-[60px] ${
                          selectedUserId === conv.userId ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={conv.userAvatar} />
                            <AvatarFallback>{conv.userName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-base truncate">{conv.userName}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage}
                            </div>
                          </div>
                          {conv.unreadCount > 0 && (
                            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">
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
                <CardContent className="p-6">
                  {selectedUserId ? (
                    <>
                      <ScrollArea className="h-[480px] mb-4 pr-2">
                        <div className="space-y-4">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg p-3 ${
                                  msg.sender_id === user.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <div className="text-base break-words">{msg.content}</div>
                                <div className="text-xs opacity-70 mt-1">
                                  {new Date(msg.created_at).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="space-y-2">
                        <FileAttachment 
                          onFileSelect={(url, type) => {
                            setAttachmentUrl(url);
                            setAttachmentType(type);
                          }}
                          disabled={false}
                        />
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
                            disabled={!newMessage.trim() && !attachmentUrl}
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-[540px] flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                      <p className="text-lg mb-2">Select a conversation</p>
                      <p className="text-sm">Choose a conversation from the list to start messaging</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
