import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ShieldAlert, CheckCircle, Loader2 } from "lucide-react";

interface AdminVerificationFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  filterDocType: string;
  onFilterDocTypeChange: (val: string) => void;
  filterRiskLevel: string;
  onFilterRiskLevelChange: (val: string) => void;
  selectedCount: number;
  processing: boolean;
  onBatchApprove: () => void;
  onClearSelection: () => void;
}

export function AdminVerificationFilterBar({
  searchQuery,
  onSearchQueryChange,
  filterStatus,
  onFilterStatusChange,
  filterDocType,
  onFilterDocTypeChange,
  filterRiskLevel,
  onFilterRiskLevelChange,
  selectedCount,
  processing,
  onBatchApprove,
  onClearSelection,
}: AdminVerificationFilterBarProps) {
  return (
    <GlassCard className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or IC number..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="rounded-lg pl-10"
            />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="rounded-lg">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDocType} onValueChange={onFilterDocTypeChange}>
          <SelectTrigger className="rounded-lg">
            <SelectValue placeholder="Document Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mykad">MyKad</SelectItem>
            <SelectItem value="passport">Passport</SelectItem>
            <SelectItem value="driving_license">Driving License</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Select value={filterRiskLevel} onValueChange={onFilterRiskLevelChange}>
          <SelectTrigger className="w-full sm:w-[200px] rounded-lg">
            <ShieldAlert className="h-4 w-4 mr-2 shrink-0" />
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 flex-wrap">
          {selectedCount > 0 && (
            <>
              <Badge className="rounded-full" variant="secondary">{selectedCount} selected</Badge>
              <Button
                size="sm"
                variant="success"
                onClick={onBatchApprove}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Batch Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onClearSelection}
                className="rounded-lg"
              >
                Clear Selection
              </Button>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
