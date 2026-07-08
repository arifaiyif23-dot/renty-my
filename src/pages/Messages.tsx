import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, File as FileIcon, Loader2 } from "lucide-react";
import { FileAttachment } from "@/components/FileAttachment";
import { EmojiPicker } from "@/components/EmojiPicker";
import { toast } from "sonner";
import type { Message, Profile } from "@/types";
import Header from "@/components/Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { sanitizeMessage } from "@/utils/sanitize";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";


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
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showThread, setShowThread] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const isMobile = useIsMobile();
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  
  const conversationId = useMemo(() => {
    if (!user?.id || !selectedUserId) return '';
    return [user.id, selectedUserId].sort().join('_');
  }, [selectedUserId, user?.id]);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId, user?.id || '');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertMessage = (incomingMessage: any) => {
    setMessages(prev => {
      const exists = prev.some(msg => msg.id === incomingMessage.id);
      if (exists) {
        return prev.map(msg => msg.id === incomingMessage.id ? { ...msg, ...incomingMessage } : msg);
      }

      const withoutOptimistic = prev.filter(msg => !(msg.pending && msg.content === incomingMessage.content));
      return [...withoutOptimistic, incomingMessage].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  };

  useEffect(() => {
    const state = location.state as { recipientId?: string } | null;
    if (state?.recipientId && user) {
      setSelectedUserId(state.recipientId);
      setShowThread(true);
    }
  }, [location.state, user]);

  useEffect(() => {
    if (user) {
      fetchConversations();

      const channel = supabase
        .channel(`messages-list-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const changedMessage = (payload.new || payload.old) as { sender_id?: string; recipient_id?: string } | null;
            if (
              changedMessage &&
              (changedMessage.sender_id === user.id || changedMessage.recipient_id === user.id)
            ) {
              fetchConversations(true);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Messages channel error');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    if (selectedUserId && user) {
      fetchMessages(selectedUserId);
      
      // Mark messages as read
      const markMessagesRead = async () => {
        await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('sender_id', selectedUserId)
          .eq('recipient_id', user.id)
          .is('read_at', null);
      };

      markMessagesRead().catch(err => console.error('Failed to mark messages read:', err));
      
      const channel = supabase
        .channel(`messages-thread-${user.id}-${selectedUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (!newMsg) return;
            if (
              (newMsg.sender_id === selectedUserId && newMsg.recipient_id === user.id) ||
              (newMsg.sender_id === user.id && newMsg.recipient_id === selectedUserId)
            ) {
              upsertMessage(newMsg);
              fetchConversations(true);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Messages thread channel error');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUserId, user]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, typingUsers.length]);

  const fetchConversations = async (silent = false) => {
    if (!user) return;

    if (!silent) setIsLoadingConversations(true);

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      if (!silent) setIsLoadingConversations(false);
      toast.error("Failed to load conversations");
      return;
    }

    const conversationMap = new Map<string, Conversation>();
    
    data?.forEach((msg: any) => {
      const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      const otherUser = msg.sender_id === user.id ? msg.recipient : msg.sender;
      const isUnreadForMe = msg.recipient_id === user.id && !msg.is_read;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUser?.full_name || 'Unknown User',
          userAvatar: otherUser?.avatar_url,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unreadCount: isUnreadForMe ? 1 : 0,
        });
      } else if (isUnreadForMe) {
        const conversation = conversationMap.get(otherUserId)!;
        conversation.unreadCount += 1;
      }
    });

    setConversations(Array.from(conversationMap.values()));
    if (!silent) setIsLoadingConversations(false);
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;

    setIsLoadingMessages(true);

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setIsLoadingMessages(false);
      toast.error("Failed to load messages");
      return;
    }

    setMessages(data || []);

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', user.id);

    setIsLoadingMessages(false);
  };

  const sendMessage = async () => {
    if (!user || !selectedUserId || isSending || (!newMessage.trim() && !attachmentUrl)) return;

    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Sanitize message content to prevent XSS
    const sanitizedContent = newMessage.trim() 
      ? sanitizeMessage(newMessage.trim()) 
      : 'Attachment';

    const optimisticId = `pending-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: user.id,
      recipient_id: selectedUserId,
      content: sanitizedContent,
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
      delivered_at: null,
      read_at: null,
      is_read: false,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");
    setAttachmentUrl("");
    setAttachmentType("");
    setIsSending(true);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: selectedUserId,
        content: sanitizedContent,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        delivered_at: new Date().toISOString(),
      })
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .single();

    setIsSending(false);

    if (error) {
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      setNewMessage(sanitizedContent);
      toast.error('Failed to send message');
      return;
    }

    setMessages(prev => prev.map(msg => msg.id === optimisticId ? data : msg));
    fetchConversations(true);
  };

  const handleTyping = () => {
    startTyping();
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        Please log in to view messages
      </div>
    );
  }

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
      <div className="container mx-auto p-3 md:p-4 pb-mobile-nav max-w-7xl">
        {/* Mobile: Conditionally show list OR thread */}
        {isMobile ? (
          <>
            {!showThread ? (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">Messages</h1>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Conversations</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-250px)]">
                      {isLoadingConversations ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading conversations
                        </div>
                      ) : conversations.map((conv) => (
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
                              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                {conv.unreadCount}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {!isLoadingConversations && conversations.length === 0 && (
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
              <div className="h-[calc(100dvh-88px)] flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                {/* Thread Header with Back Button */}
                <div className="z-10 bg-card border-b p-3 flex items-center gap-3 min-h-[60px]">
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
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-3">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading messages
                      </div>
                    ) : messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'} animate-fade-in`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
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
                            {msg.sender_id === user.id && (
                              <span className="ml-1">
                                {msg.pending ? 'sending' : msg.read_at ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Typing Indicator */}
                    {typingUsers.length > 0 && (
                      <div className="flex justify-start animate-fade-in">
                        <div className="bg-muted rounded-2xl px-4 py-3 rounded-bl-sm">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messageEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Bar - Sticky at bottom */}
                <div className="bg-card border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          handleTyping();
                        }}
                        placeholder="Type a message..."
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        className="h-12 text-base flex-1"
                      />
                      <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                      <Button 
                        onClick={sendMessage} 
                        size="icon"
                        disabled={isSending || (!newMessage.trim() && !attachmentUrl)}
                        className="h-12 w-12 flex-shrink-0"
                      >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
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
              <Card className="lg:col-span-1 border-border/70 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    {isLoadingConversations ? (
                      <div className="flex items-center justify-center p-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading conversations
                      </div>
                    ) : conversations.map((conv) => (
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
                    {!isLoadingConversations && conversations.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>No conversations yet</p>
                        <p className="text-xs mt-2">Messages will appear here when you start chatting</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Messages Thread */}
              <Card className="lg:col-span-2 border-border/70 shadow-sm">
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
                          {isLoadingMessages ? (
                            <div className="flex items-center justify-center py-10 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading messages
                            </div>
                          ) : messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg p-3 shadow-sm ${
                                  msg.sender_id === user.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
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
                                <div className="text-xs opacity-70 mt-1">
                                  {new Date(msg.created_at).toLocaleTimeString()}
                                  {msg.sender_id === user.id && (
                                    <span className="ml-2">{msg.pending ? 'sending' : msg.read_at ? '✓✓' : '✓'}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messageEndRef} />
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
                            onChange={(e) => {
                              setNewMessage(e.target.value);
                              handleTyping();
                            }}
                            placeholder="Type a message..."
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            className="min-h-[44px]"
                          />
                          <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                          <Button 
                            onClick={sendMessage} 
                            size="icon"
                            disabled={isSending || (!newMessage.trim() && !attachmentUrl)}
                            className="min-h-[44px] min-w-[44px]"
                          >
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
