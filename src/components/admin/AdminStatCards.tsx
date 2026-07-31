import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from "@/components/ui/button";
import { Users, Package, TrendingUp, CheckCircle, AlertTriangle, Flag, RefreshCw, FileCheck } from "lucide-react";

interface DashboardStats {
  pendingVerifications: number;
  pendingFraudAlerts: number;
  totalUsers: number;
  activeListings: number;
  activeRentals: number;
  completedRentals: number;
  platformRevenue: number;
  totalReports: number;
  openDisputes: number;
}

interface AdminStatCardsProps {
  stats: DashboardStats;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
}

export function AdminStatCards({ stats, onTabChange, onRefresh, onNavigate }: AdminStatCardsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Users</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
          <p className="text-xs text-muted-foreground">Registered</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Active Listings</span>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.activeListings}</div>
          <p className="text-xs text-muted-foreground">Available to rent</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Active Rentals</span>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold">{stats.activeRentals}</div>
          <p className="text-xs text-muted-foreground">In progress</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Completed Rentals</span>
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold">{stats.completedRentals}</div>
          <p className="text-xs text-muted-foreground">All time</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Platform Revenue</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">RM{stats.platformRevenue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">From completed payments</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pending Actions</span>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div className="text-2xl font-bold">{stats.pendingVerifications + stats.totalReports + stats.openDisputes}</div>
          <p className="text-xs text-muted-foreground">Verifications + Reports + Disputes</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Open Reports</span>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.totalReports}</div>
          <p className="text-xs text-muted-foreground">Pending review</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Open Disputes</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold">{stats.openDisputes}</div>
          <p className="text-xs text-muted-foreground">Need resolution</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Button
              className="w-full justify-start rounded-lg"
              variant="outline"
              onClick={() => onTabChange("verifications")}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Review Pending Verifications ({stats.pendingVerifications})
            </Button>
            <Button
              className="w-full justify-start rounded-lg"
              variant="outline"
              onClick={() => onTabChange("fraud-alerts")}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Check Fraud Alerts ({stats.pendingFraudAlerts})
            </Button>
            <Button
              className="w-full justify-start rounded-lg"
              variant="outline"
              onClick={() => onNavigate("/admin/listings")}
            >
              <Package className="h-4 w-4 mr-2" />
              Manage Listings ({stats.activeListings})
            </Button>
            <Button
              className="w-full justify-start rounded-lg"
              variant="outline"
              onClick={() => onNavigate("/admin/rentals")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              View Rentals
            </Button>
            <Button
              className="w-full justify-start rounded-lg"
              variant="outline"
              onClick={() => onNavigate("/admin/payments")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Payment Monitoring
            </Button>
            <Button
              className="w-full justify-start rounded-lg"
              variant="outline"
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Dashboard
            </Button>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Pending Items</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Verifications</span>
              <span className="font-bold">{stats.pendingVerifications}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Fraud Alerts</span>
              <span className="font-bold">{stats.pendingFraudAlerts}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Open Reports</span>
              <span className="font-bold">{stats.totalReports}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Open Disputes</span>
              <span className="font-bold">{stats.openDisputes}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
              <span className="font-medium">Total Pending</span>
              <span className="font-bold">{stats.pendingVerifications + stats.pendingFraudAlerts + stats.totalReports + stats.openDisputes}</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
