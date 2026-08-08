import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Keyboard, Loader2, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VerificationAnalytics } from "@/components/VerificationAnalytics";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { useAdminKeyboardShortcuts } from "@/hooks/use-admin-keyboard-shortcuts";
import { useAdminVerificationData } from "@/hooks/use-admin-verification-data";
import { useAdminVerificationActions } from "@/hooks/use-admin-verification-actions";
import { AdminVerificationStats } from "@/components/admin/AdminVerificationStats";
import { AdminVerificationFilterBar } from "@/components/admin/AdminVerificationFilterBar";
import { AdminVerificationListItem } from "@/components/admin/AdminVerificationListItem";
import { AdminFraudAlertList } from "@/components/admin/AdminFraudAlertList";
import { AdminVerificationActionDialog } from "@/components/admin/AdminVerificationActionDialog";

export default function AdminVerification() {
  const {
    connectionState,
    verifications,
    pendingVerifications,
    fraudAlerts,
    stats,
    loading,
    refreshing,
    filterStatus,
    setFilterStatus,
    filterDocType,
    setFilterDocType,
    filterRiskLevel,
    setFilterRiskLevel,
    searchQuery,
    setSearchQuery,
    refresh,
  } = useAdminVerificationData();

  const {
    selectedVerification,
    showDialog,
    actionType,
    rejectionReason,
    setRejectionReason,
    adminNotes,
    setAdminNotes,
    selectedIds,
    processing,
    showDocViewer,
    selectedIndex,
    setSelectedIndex,
    handleAction,
    handleBatchApprove,
    toggleSelection,
    toggleSelectAll,
    openActionDialog,
    openDocViewer,
    setShowDialog,
    setShowDocViewer,
    setSelectedVerification,
  } = useAdminVerificationActions({ onSuccess: refresh });

  const [activeTab, setActiveTab] = useState("verifications");
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const currentPendingVerification = selectedIndex >= 0 && selectedIndex < pendingVerifications.length
    ? pendingVerifications[selectedIndex]
    : null;

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex >= pendingVerifications.length) {
      setSelectedVerification(null);
      setSelectedIndex(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVerifications.length, selectedIndex]);

  useAdminKeyboardShortcuts({
    onApprove: currentPendingVerification ? () => openActionDialog(currentPendingVerification, 'approve') : undefined,
    onReject: currentPendingVerification ? () => openActionDialog(currentPendingVerification, 'reject') : undefined,
    onViewDocuments: currentPendingVerification ? () => openDocViewer(currentPendingVerification, selectedIndex) : undefined,
    onNextItem: () => {
      if (pendingVerifications.length > 0) {
        const newIndex = selectedIndex < pendingVerifications.length - 1 ? selectedIndex + 1 : 0;
        setSelectedVerification(pendingVerifications[newIndex]);
        openDocViewer(pendingVerifications[newIndex], newIndex);
      }
    },
    onPrevItem: () => {
      if (pendingVerifications.length > 0) {
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : pendingVerifications.length - 1;
        setSelectedVerification(pendingVerifications[newIndex]);
        openDocViewer(pendingVerifications[newIndex], newIndex);
      }
    },
    onRefresh: refresh,
    enabled: activeTab === 'verifications' && !showDialog && !showDocViewer
  });

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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold mb-2">Verification & Security Dashboard</h1>
            <p className="text-muted-foreground">Review verifications, manage fraud alerts, and approve users</p>
          </div>
          {refreshing && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="rounded-lg" variant="ghost" size="icon" onClick={() => setShowShortcutsHelp(!showShortcutsHelp)} aria-label="Show keyboard shortcuts">
                  <Keyboard className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p className="font-semibold mb-2">Keyboard Shortcuts</p>
                  <p><kbd className="bg-muted px-1 rounded">A</kbd> Approve selected</p>
                  <p><kbd className="bg-muted px-1 rounded">R</kbd> Reject selected</p>
                  <p><kbd className="bg-muted px-1 rounded">V</kbd> View documents</p>
                  <p><kbd className="bg-muted px-1 rounded">↑/K</kbd> Previous item</p>
                  <p><kbd className="bg-muted px-1 rounded">↓/J</kbd> Next item</p>
                  <p><kbd className="bg-muted px-1 rounded">Shift+R</kbd> Refresh</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {connectionState === 'connected' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span>Live Updates Active</span>
            </div>
          )}
        </div>
      </div>

      {stats && <AdminVerificationStats stats={stats} />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="verifications">
            Verifications ({stats?.pendingCount || 0})
          </TabsTrigger>
          <TabsTrigger value="fraud">
            Fraud Alerts ({fraudAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <VerificationAnalytics />
        </TabsContent>

        <TabsContent value="verifications">
          <AdminVerificationFilterBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            filterDocType={filterDocType}
            onFilterDocTypeChange={setFilterDocType}
            filterRiskLevel={filterRiskLevel}
            onFilterRiskLevelChange={setFilterRiskLevel}
            selectedCount={selectedIds.size}
            processing={processing}
            onBatchApprove={handleBatchApprove}
            onClearSelection={() => selectedIds.clear()}
          />

          {verifications.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === verifications.length}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All
              </label>
            </div>
          )}

          <div className="grid gap-4">
            {verifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No verification requests found
              </div>
            ) : (
              verifications.map((verification) => (
                <AdminVerificationListItem
                  key={verification.id}
                  verification={verification}
                  selected={selectedIds.has(verification.id)}
                  onToggleSelection={toggleSelection}
                  onApprove={(v) => openActionDialog(v, 'approve')}
                  onReject={(v) => openActionDialog(v, 'reject')}
                  onViewDocuments={openDocViewer}
                  pendingIndex={pendingVerifications.findIndex(v => v.id === verification.id)}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="fraud">
          <AdminFraudAlertList alerts={fraudAlerts} onRefresh={refresh} />
        </TabsContent>
      </Tabs>

      <AdminVerificationActionDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        actionType={actionType}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
        adminNotes={adminNotes}
        onAdminNotesChange={setAdminNotes}
        processing={processing}
        onConfirm={handleAction}
      />

      <DocumentViewerModal
        open={showDocViewer}
        onOpenChange={setShowDocViewer}
        verification={selectedVerification}
        onApprove={selectedVerification?.status === 'pending' ? () => {
          setShowDocViewer(false);
          openActionDialog(selectedVerification, 'approve');
        } : undefined}
        onReject={selectedVerification?.status === 'pending' ? () => {
          setShowDocViewer(false);
          openActionDialog(selectedVerification, 'reject');
        } : undefined}
      />
    </AdminLayout>
  );
}
