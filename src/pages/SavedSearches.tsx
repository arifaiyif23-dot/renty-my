import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Search, Bell, BellOff, Trash2, Loader2, ArrowLeft, Save, Plus, Clock } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import type { SavedSearch } from "@/types";

export default function SavedSearches() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editSearch, setEditSearch] = useState<SavedSearch | null>(null);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    if (user) loadSearches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSearches = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSearches(data || []);
      fetchNewCounts(data || []);
    } catch {
      toast.error(t("savedSearches.failedToLoad"));
    } finally {
      setLoading(false);
    }
  };

  const fetchNewCounts = useCallback(async (searchesList: SavedSearch[]) => {
    const counts: Record<string, number> = {};
    // Run counts in parallel and match the Search page's ilike semantics for
    // location (a free-text field, so exact .eq() almost always returned 0).
    await Promise.all(searchesList.map(async (s) => {
      if (!s.notify_on_new) return;
      try {
        let query = supabase.from("items").select("*", { count: "exact", head: true });
        if (s.query_text) query = query.ilike("title", `%${s.query_text}%`);
        if (s.category && s.category !== "all") query = query.eq("category", s.category);
        if (s.location) query = query.ilike("location", `%${s.location}%`);
        query = query.gte("created_at", s.created_at);
        const { count } = await query;
        if (count && count > 0) counts[s.id] = count;
      } catch { /* skip */ }
    }));
    setNewCounts(counts);
  }, []);

  const toggleNotify = async (search: SavedSearch) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .update({ notify_on_new: !search.notify_on_new })
        .eq("id", search.id);

      if (error) throw error;
      setSearches((prev) => {
        const updated = prev.map((s) => (s.id === search.id ? { ...s, notify_on_new: !s.notify_on_new } : s));
        fetchNewCounts(updated);
        return updated;
      });
      toast.success(search.notify_on_new ? t("savedSearches.notificationsDisabled") : t("savedSearches.notificationsEnabled"));
    } catch {
      toast.error(t("savedSearches.failedToUpdate"));
    }
  };

  const deleteSearch = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("saved_searches").delete().eq("id", deleteId);
      if (error) throw error;
      setSearches((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success(t("savedSearches.searchDeleted"));
    } catch {
      toast.error(t("savedSearches.failedToDelete"));
    } finally {
      setDeleteId(null);
    }
  };

  const updateLabel = async () => {
    if (!editSearch || !labelInput.trim()) return;
    try {
      const { error } = await supabase
        .from("saved_searches")
        .update({ label: labelInput.trim() })
        .eq("id", editSearch.id);

      if (error) throw error;
      setSearches((prev) =>
        prev.map((s) => (s.id === editSearch.id ? { ...s, label: labelInput.trim() } : s))
      );
      toast.success(t("savedSearches.labelUpdated"));
      setEditSearch(null);
    } catch {
      toast.error(t("savedSearches.failedToUpdateLabel"));
    }
  };

  if (loading) {
    return (
      <PageLayout variant="narrow" className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="narrow">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            icon={<Search className="h-5 w-5 text-primary" />}
            title={t("savedSearches.title")}
            subtitle={t("savedSearches.subtitle")}
            titleClassName="text-xl"
            subtitleClassName="text-xs"
          />
        </div>

        {searches.length === 0 ? (
          <GlassCard padding="lg" className="text-center py-8">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">{t("savedSearches.noSearches")}</p>
            <Button variant="outline" className="rounded-lg" asChild>
              <Link to="/search">
                <Plus className="h-4 w-4 mr-2" />
                {t("savedSearches.browseItems")}
              </Link>
            </Button>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {searches.map((search) => (
              <GlassCard key={search.id} variant="subtle" padding="md" className="hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {search.label || search.query_text || t("savedSearches.unnamedSearch")}
                      </p>
                      {newCounts[search.id] && (
                        <Badge variant="default" className="shrink-0 text-[10px] h-5 px-1.5">
                          {newCounts[search.id]} {t("savedSearches.new")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {search.query_text && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          "{search.query_text}"
                        </span>
                      )}
                      {search.category && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{search.category}</span>
                      )}
                      {search.location && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{search.location}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {t("savedSearches.saved")} {format(new Date(search.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg h-10 w-10"
                      onClick={() => {
                        setEditSearch(search);
                        setLabelInput(search.label || "");
                      }}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg h-10 w-10"
                      onClick={() => toggleNotify(search)}
                    >
                      {search.notify_on_new ? (
                        <Bell className="h-4 w-4 text-primary" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg h-10 w-10"
                      onClick={() => setDeleteId(search.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("savedSearches.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("savedSearches.cannotUndo")}
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" className="rounded-lg" onClick={deleteSearch}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSearch} onOpenChange={() => setEditSearch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("savedSearches.editLabelTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder={t("savedSearches.labelPlaceholder")}
            className="rounded-lg"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setEditSearch(null)}>{t("common.cancel")}</Button>
            <Button className="rounded-lg" onClick={updateLabel}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
