import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Bell, BellOff, Trash2, Loader2, ArrowLeft, Save, Plus, Clock } from "lucide-react";
import Header from "@/components/Header";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import type { SavedSearch } from "@/types";

export default function SavedSearches() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editSearch, setEditSearch] = useState<SavedSearch | null>(null);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    if (user) loadSearches();
  }, [user]);

  const loadSearches = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSearches(data || []);
    } catch (error: any) {
      toast.error("Failed to load saved searches");
    } finally {
      setLoading(false);
    }
  };

  const toggleNotify = async (search: SavedSearch) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .update({ notify_on_new: !search.notify_on_new })
        .eq("id", search.id);

      if (error) throw error;
      setSearches((prev) =>
        prev.map((s) => (s.id === search.id ? { ...s, notify_on_new: !s.notify_on_new } : s))
      );
      toast.success(search.notify_on_new ? "Notifications disabled" : "Notifications enabled");
    } catch (error: any) {
      toast.error("Failed to update");
    }
  };

  const deleteSearch = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("saved_searches").delete().eq("id", deleteId);
      if (error) throw error;
      setSearches((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success("Search deleted");
    } catch (error: any) {
      toast.error("Failed to delete");
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
      toast.success("Label updated");
      setEditSearch(null);
    } catch (error: any) {
      toast.error("Failed to update label");
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 max-w-2xl pb-mobile-nav flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-2xl pb-mobile-nav">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Search className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Saved Searches</CardTitle>
                <CardDescription>Save search criteria to quickly find items later</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {searches.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No saved searches yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to="/search">
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Items
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {searches.map((search) => (
                  <Card key={search.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {search.label || search.query_text || "Unnamed Search"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {search.query_text && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                "{search.query_text}"
                              </span>
                            )}
                            {search.category && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">{search.category}</span>
                            )}
                            {search.location && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">{search.location}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Saved {format(new Date(search.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditSearch(search);
                              setLabelInput(search.label || "");
                            }}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
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
                            size="sm"
                            onClick={() => setDeleteId(search.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Saved Search?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSearch}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Label Dialog */}
      <Dialog open={!!editSearch} onOpenChange={() => setEditSearch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Search Label</DialogTitle>
          </DialogHeader>
          <Input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Enter a name for this search"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSearch(null)}>Cancel</Button>
            <Button onClick={updateLabel}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
