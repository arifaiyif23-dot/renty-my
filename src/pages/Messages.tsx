import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSuspensionCheck } from "@/hooks/use-suspension-check";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, File as FileIcon, Loader2, RefreshCw } from "lucide-react";
import { FileAttachment } from "@/components/FileAttachment";
import { EmojiPicker } from "@/components/EmojiPicker";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Message } from "@/types";
import { PageLayout } from "@/components/PageLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { sanitizeMessage } from "@/utils/sanitize";
import { safeFormatDate } from "@/utils/securityHelpers";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";


interface Conversation {
  userId: string;
  userName: string;
  userAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const ConversationItem = memo(({ conv, onSelect, isSelected }: { conv: Conversation; onSelect: (id: string) => void; isSelected?: boolean }) => (
  <div
    key={conv.userId}
    onClick={() => onSelect(conv.userId)}
    className={`p-4 cursor-pointer hover:bg-muted/50 border-b press min-h-[72px] rounded-lg ${isSelected ? 'bg-muted/50' : ''}`}
  >
    <div className="flex items-center gap-3">
      <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-primary/10">
        <AvatarImage src={conv.userAvatar} />
        <AvatarFallback>{conv.userName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base truncate">{conv.userName}</div>
        <div className="text-sm text-muted-foreground line-clamp-2">
          {conv.lastMessage}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {safeFormatDate(conv.lastMessageTime, (d) => d.toLocaleString('en-MY', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }))}
        </div>
      </div>
      {conv.unreadCount > 0 && (
        <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {conv.unreadCount}
        </div>
      )}
    </div>
  </div>
));

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showThread, setShowThread] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const isMobile = useIsMobile();
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAndRefresh = useCallback(async () => { fetchConversations(); }, [user]);
  const { isRefreshing, pullDistance } = usePullToRefresh(fetchAndRefresh);

  const conversationId = useMemo(() => {
    if (!user?.id || !selectedUserId) return '';
    return [user.id, selectedUserId].sort().join('_');
  }, [selectedUserId, user?.id]);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId, user?.id || '');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertMessage = (incomingMessage: Message) => {
    setMessages(prev => {
      const exists = prev.some(msg => msg.id === incomingMessage.id);
      if (exists) {
        return prev.map(msg => msg.id === incomingMessage.id ? { ...msg, ...incomingMessage } : msg);
      }

      const withoutOptimistic = prev.filter(msg => !(msg.pending && msg.content === incomingMessage.content));
      return [...withoutOptimistic, incomingMessage].sort(
        (a, b) => { try { return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); } catch { return 0; } }
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

      // Subscribe to messages where user is sender or recipient (server-side filters)
      const sentChannel = supabase
        .channel(`messages-sent-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
          () => { fetchConversations(true); }
        )
        .subscribe();

      const receivedChannel = supabase
        .channel(`messages-received-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
          () => { fetchConversations(true); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sentChannel);
        supabase.removeChannel(receivedChannel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      markMessagesRead().catch(err => { console.error('Failed to mark messages read:', err); });
      // Optimistically zero this conversation's unread count (don't wait for realtime)
      setConversations(prev => prev.map(c => c.userId === selectedUserId ? { ...c, unreadCount: 0 } : c));
      
      const threadChannel = supabase
        .channel(`messages-thread-${user.id}-${selectedUserId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `sender_id=in.(${user.id},${selectedUserId})` },
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
        .subscribe();

      return () => {
        supabase.removeChannel(threadChannel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, user]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, typingUsers.length]);

  const fetchConversations = async (silent = false) => {
    if (!user) return;

    if (!silent) setIsLoadingConversations(true);

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, is_read, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching conversations:', error);
      if (!silent) {
        setIsLoadingConversations(false);
        setConversationsError(error.message);
      }
      toast.error(t("messages.failedToLoadConversations"));
      return;
    }

    setConversationsError(null);
    const conversationMap = new Map<string, Conversation>();
    
    data?.forEach((msg: Message & { sender?: { full_name: string; avatar_url?: string }; recipient?: { full_name: string; avatar_url?: string } }) => {
      const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      const otherUser = msg.sender_id === user.id ? msg.recipient : msg.sender;
      const isUnreadForMe = msg.recipient_id === user.id && !msg.is_read;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUser?.full_name || t('messages.unknownUser'),
          userAvatar: otherUser?.avatar_url,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unreadCount: isUnreadForMe ? 1 : 0,
        });
      } else if (isUnreadForMe) {
        const conversation = conversationMap.get(otherUserId);
        if (conversation) conversation.unreadCount += 1;
      }
    });

    setConversations(Array.from(conversationMap.values()));
    if (!silent) setIsLoadingConversations(false);
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(otherUserId)) {
      console.error('Invalid user ID format');
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, is_read, read_at, attachment_url, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), recipient:profiles!messages_recipient_id_fkey(full_name, avatar_url)')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      setIsLoadingMessages(false);
      toast.error(t("messages.failedToLoadMessages"));
      return;
    }

    setMessages(data || []);

    // Mark messages as read (only unread ones to avoid redundant updates)
    const { error: readError } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (readError) console.error('Failed to mark messages as read:', readError);

    setIsLoadingMessages(false);
  };

  const { checkNotSuspended } = useSuspensionCheck();

  const sendMessage = async () => {
    if (!user || !selectedUserId || isSending || (!newMessage.trim() && !attachmentUrl)) return;
    if (!checkNotSuspended(t('messages.sendAction'))) return;

    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Sanitize message content to prevent XSS
    const sanitizedContent = newMessage.trim() 
      ? sanitizeMessage(newMessage.trim()) 
      : t('messages.attachment');

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
      console.error('Send message error:', error.message);
      toast.error(error.message ? `${t('messages.failedToSendMessage')}: ${error.message}` : t('messages.failedToSendMessage'));
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
        {t('messages.pleaseLogin')}
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
    <PageLayout>
      {pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none">
          <div
            className="bg-primary text-primary-foreground rounded-full p-2 shadow-3"
            style={{ transform: `rotate(${pullDistance * 2}deg)`, opacity: Math.min(pullDistance / 80, 1) }}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}
      <div className="container mx-auto p-3 md:p-4 pb-mobile-nav max-w-7xl">
        {/* Mobile: Conditionally show list OR thread */}
        {isMobile ? (
          <>
            {!showThread ? (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">{t('messages.title')}</h1>
                <GlassCard variant="subtle" padding="md">
                  <h2 className="text-lg font-semibold pb-3">{t('messages.conversations')}</h2>
                  <ScrollArea className="h-[calc(100vh-250px)]">
                    {isLoadingConversations ? (
                      <div className="flex items-center justify-center p-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('messages.loadingConversations')}
                      </div>
                    ) : conversations.map((conv) => (
                      <ConversationItem
                        key={conv.userId}
                        conv={conv}
                        onSelect={handleSelectConversation}
                      />
                    ))}
                    {!isLoadingConversations && conversationsError && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p className="text-base">{t('messages.failedToLoadConversations')}</p>
                        <p className="text-sm mt-2">{conversationsError}</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchConversations()}>
                          <Loader2 className={`h-4 w-4 mr-1 ${isLoadingConversations ? 'animate-spin' : ''}`} />
                          {t('messages.retry')}
                        </Button>
                      </div>
                    )}
                    {!isLoadingConversations && !conversationsError && conversations.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p className="text-base">{t('messages.noConversations')}</p>
                        <p className="text-sm mt-2">{t('messages.noConversationsDesc')}</p>
                      </div>
                    )}
                  </ScrollArea>
                </GlassCard>
              </div>
            ) : (
              <div className="h-[calc(100dvh-152px)] flex flex-col overflow-hidden rounded-lg border bg-card shadow-1">
                {/* Thread Header with Back Button */}
                <div className="z-10 bg-card border-b p-3 flex items-center gap-3 min-h-[60px]">
                  <Button variant="ghost" size="icon" onClick={handleBackToList} className="flex-shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-primary/10">
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
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('messages.loadingMessages')}
                      </div>
                    ) : messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'} animate-fade-in`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-4 py-2.5 shadow-1 ${
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
                                  alt={t('messages.attachment')} 
                                  className="rounded-lg max-w-full h-auto"
                                  loading="lazy"
                                />
                              ) : (
                                <a 
                                  href={msg.attachment_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm underline"
                                >
                                  <FileIcon className="h-4 w-4" />
                                  {t('messages.viewDocument')}
                                </a>
                              )}
                            </div>
                          )}
                          <div className="text-base break-words">{msg.content}</div>
                          <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                            <span>
                              {safeFormatDate(msg.created_at, (d) => d.toLocaleTimeString('en-MY', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }))}
                            </span>
                            {msg.sender_id === user.id && (
                              <span className="ml-1">
                                {msg.pending ? t('messages.sending') : msg.read_at ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Typing Indicator */}
                    {typingUsers.length > 0 && (
                      <div className="flex justify-start animate-fade-in">
                        <div className="bg-muted rounded-lg px-4 py-3 rounded-bl-sm">
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

                {/* Input Bar - sits just above the mobile bottom nav */}
                <div className="bg-card border-t p-3">
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
                        placeholder={t('messages.typeMessage')}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && sendMessage()}
                        className="h-12 text-base flex-1 rounded-lg"
                      />
                      <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                      <Button 
                        onClick={sendMessage} 
                        size="icon"
                        disabled={isSending || (!newMessage.trim() && !attachmentUrl)}
                        className="h-12 w-12 flex-shrink-0 rounded-lg"
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
            <h1 className="text-3xl font-bold mb-6">{t('messages.title')}</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Conversations List */}
              <GlassCard variant="subtle" padding="md" className="lg:col-span-1">
                <h2 className="text-lg font-semibold pb-3">{t('messages.conversations')}</h2>
                <ScrollArea className="h-[600px]">
                  {isLoadingConversations ? (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('messages.loadingConversations')}
                    </div>
                  ) : conversations.map((conv) => (
                    <ConversationItem
                      key={conv.userId}
                      conv={conv}
                      onSelect={setSelectedUserId}
                      isSelected={selectedUserId === conv.userId}
                    />
                  ))}
                  {!isLoadingConversations && conversationsError && (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>{t('messages.failedToLoadConversations')}</p>
                      <p className="text-xs mt-2">{conversationsError}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchConversations()}>
                        <Loader2 className={`h-4 w-4 mr-1 ${isLoadingConversations ? 'animate-spin' : ''}`} />
                        {t('messages.retry')}
                      </Button>
                    </div>
                  )}
                  {!isLoadingConversations && !conversationsError && conversations.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>{t('messages.noConversations')}</p>
                      <p className="text-xs mt-2">{t('messages.noConversationsDesc')}</p>
                    </div>
                  )}
                </ScrollArea>
              </GlassCard>

              {/* Messages Thread */}
              <GlassCard variant="subtle" padding="md" className="lg:col-span-2">
                <h2 className="text-lg font-semibold pb-3">
                  {selectedUserId
                    ? conversations.find(c => c.userId === selectedUserId)?.userName
                    : t('messages.selectConversation')}
                </h2>
                {selectedUserId ? (
                  <>
                    <ScrollArea className="h-[480px] mb-4 pr-2">
                      <div className="space-y-4">
                        {isLoadingMessages ? (
                          <div className="flex items-center justify-center py-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('messages.loadingMessages')}
                          </div>
                        ) : messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 shadow-1 ${
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
                                      alt={t('messages.attachment')} 
                                      className="rounded-lg max-w-full h-auto"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <a 
                                      href={msg.attachment_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-sm underline"
                                    >
                                      <FileIcon className="h-4 w-4" />
                                      {t('messages.viewDocument')}
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className="text-base break-words">{msg.content}</div>
                              <div className="text-xs opacity-70 mt-1">
                                {safeFormatDate(msg.created_at, (d) => d.toLocaleTimeString())}
                                {msg.sender_id === user.id && (
                                  <span className="ml-2">{msg.pending ? t('messages.sending') : msg.read_at ? '✓✓' : '✓'}</span>
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
                          placeholder={t('messages.typeMessage')}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && sendMessage()}
                          className="min-h-[44px] rounded-lg"
                        />
                        <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                        <Button 
                          onClick={sendMessage} 
                          size="icon"
                          disabled={isSending || (!newMessage.trim() && !attachmentUrl)}
                          className="min-h-[44px] min-w-[44px] rounded-lg"
                        >
                          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[540px] flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                    <p className="text-lg mb-2">{t('messages.selectConversation')}</p>
                    <p className="text-sm">{t('messages.selectConversationDesc')}</p>
                  </div>
                )}
              </GlassCard>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
