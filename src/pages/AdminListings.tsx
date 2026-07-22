import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/AdminLayout";
import { toast } from "sonner";
import { format } from "date-fns";
import { Package, Search, Eye, EyeOff, Loader2, Filter } from "lucide-react";

interface AdminItem {
  id: string;
  title: string;
  category: string;
  price_per_day: number;
  location: string;
  is_available: boolean;
  listing_status: string;
  created_at: string;
  owner: { full_name: string } | null;
  item_images: { image_url: string }[] | null;
}

export default function AdminListings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterStatus]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("items")
        .select("id, title, category, price_per_day, location, is_available, listing_status, created_at, owner:profiles!owner_id(full_name), item_images(image_url)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterCategory !== "all") {
        query = query.eq("category", filterCategory);
      }
      if (filterStatus === "visible") {
        query = query.eq("is_available", true);
      } else if (filterStatus === "hidden") {
        query = query.eq("is_available", false);
      } else if (filterStatus === "active") {
        query = query.eq("listing_status", "active");
      } else if (filterStatus === "draft") {
        query = query.eq("listing_status", "draft");
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (itemId: string, current: boolean) => {
    setProcessing(itemId);
    try {
      const { error } = await supabase
        .from("items")
        .update({ is_available: !current })
        .eq("id", itemId);

      if (error) throw error;

      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, is_available: !current } : i))
      );
      toast.success(current ? "Listing hidden" : "Listing shown");
    } catch (error) {
      console.error("Error toggling visibility:", error);
      toast.error("Failed to update listing");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.owner?.full_name?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Listing Management</h1>
            <p className="text-sm text-muted-foreground">View, search, and moderate all listings</p>
          </div>
        </div>

        <GlassCard className="mb-6">
          
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, owner, or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-xl pl-10"
                  />
                </div>
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="rounded-xl">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                  <SelectItem value="tools">Tools</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="visible">Visible</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          
        </GlassCard>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard>
            
              No listings found
            
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <GlassCard key={item.id} className={!item.is_available ? "opacity-70" : ""}>
                
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {item.item_images?.[0]?.image_url && (
                        <img
                          src={item.item_images[0].image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{item.title}</span>
                        <Badge variant="secondary" className="capitalize text-xs rounded-full">
                          {item.category}
                        </Badge>
                        {item.is_available ? (
                          <Badge className="bg-success text-xs rounded-full">Visible</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs rounded-full">Hidden</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span>Owner: {item.owner?.full_name || "Unknown"}</span>
                        <span>RM{item.price_per_day}/day</span>
                        <span>{item.location}</span>
                        <span>Listed {format(new Date(item.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button className="rounded-xl"
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/items/${item.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button className="rounded-xl"
                        size="sm"
                        variant={item.is_available ? "secondary" : "default"}
                        onClick={() => toggleVisibility(item.id, item.is_available)}
                        disabled={processing === item.id}
                      >
                        {processing === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : item.is_available ? (
                          <EyeOff className="h-4 w-4 mr-1" />
                        ) : (
                          <Eye className="h-4 w-4 mr-1" />
                        )}
                        {item.is_available ? "Hide" : "Show"}
                      </Button>
                    </div>
                  </div>
                
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
