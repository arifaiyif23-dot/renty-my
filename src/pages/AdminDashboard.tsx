import { useNavigate, Link } from "react-router-dom";
import { Loader2, TrendingUp, AlertTriangle, Shield, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/AdminLayout";
import EmailAnalytics from "@/components/EmailAnalytics";
import { useAdminDashboard } from "@/hooks/use-admin-dashboard";
import { AdminStatCards } from "@/components/admin/AdminStatCards";
import { AdminFraudAlertsPanel } from "@/components/admin/AdminFraudAlertsPanel";
import { AdminVerificationsPanel } from "@/components/admin/AdminVerificationsPanel";
import { AdminBulkActionDialog } from "@/components/admin/AdminBulkActionDialog";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    loading,
    stats,
    activeTab,
    setActiveTab,
    fraudFilterStatus,
    setFraudFilterStatus,
    fraudSearchQuery,
    setFraudSearchQuery,
    handleFraudAlertAction,
    verificationFilterStatus,
    setVerificationFilterStatus,
    verificationSearchQuery,
    setVerificationSearchQuery,
    selectedVerifications,
    toggleVerificationSelection,
    selectAllVerifications,
    clearSelection,
    showBulkDialog,
    setShowBulkDialog,
    bulkAction,
    setBulkAction,
    bulkRejectionReason,
    setBulkRejectionReason,
    processing,
    handleBulkAction,
    filteredFraudAlerts,
    filteredVerifications,
    fetchAllData,
  } = useAdminDashboard();

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage verifications, fraud alerts, and platform security</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/admin/health">System Health</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/disputes">Disputes</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/payouts">Payouts</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/automation">Automation</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/settings">Settings</Link></Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="fraud-alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Fraud Alerts
              {stats.pendingFraudAlerts > 0 && (
                <Badge className="ml-2 rounded-full" variant="destructive">{stats.pendingFraudAlerts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verifications">
              <Shield className="h-4 w-4 mr-2" />
              Verifications
              {stats.pendingVerifications > 0 && (
                <Badge className="ml-2 rounded-full" variant="secondary">{stats.pendingVerifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <AdminStatCards
              stats={stats}
              onTabChange={setActiveTab}
              onRefresh={fetchAllData}
              onNavigate={navigate}
            />
          </TabsContent>

          <TabsContent value="fraud-alerts">
            <AdminFraudAlertsPanel
              alerts={filteredFraudAlerts}
              filterStatus={fraudFilterStatus}
              onFilterStatusChange={setFraudFilterStatus}
              searchQuery={fraudSearchQuery}
              onSearchQueryChange={setFraudSearchQuery}
              onAction={handleFraudAlertAction}
            />
          </TabsContent>

          <TabsContent value="verifications">
            <AdminVerificationsPanel
              verifications={filteredVerifications}
              filterStatus={verificationFilterStatus}
              onFilterStatusChange={setVerificationFilterStatus}
              searchQuery={verificationSearchQuery}
              onSearchQueryChange={setVerificationSearchQuery}
              selectedVerifications={selectedVerifications}
              onToggleSelection={toggleVerificationSelection}
              onSelectAll={selectAllVerifications}
              onClearSelection={clearSelection}
              onBulkApprove={() => { setBulkAction('approve'); setShowBulkDialog(true); }}
              onBulkReject={() => { setBulkAction('reject'); setShowBulkDialog(true); }}
            />
          </TabsContent>

          <TabsContent value="email">
            <EmailAnalytics />
          </TabsContent>
        </Tabs>

        <AdminBulkActionDialog
          open={showBulkDialog}
          onOpenChange={setShowBulkDialog}
          action={bulkAction}
          selectedCount={selectedVerifications.size}
          rejectionReason={bulkRejectionReason}
          onRejectionReasonChange={setBulkRejectionReason}
          processing={processing}
          onConfirm={handleBulkAction}
        />
      </div>
    </AdminLayout>
  );
}
