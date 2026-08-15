import { db as erpDb } from "../data";
import { orderService } from "./orderService";
import { inventoryService } from "./inventoryService";
import { productService } from "./productService";
import { userService } from "./userService";

export type SyncActionType = 'CREATE_ORDER' | 'UPDATE_STOCK' | 'CREATE_CLIENT' | 'ADD_PAYMENT';

export interface SyncTask {
  id: string;
  type: SyncActionType;
  payload: any;
  status: 'pending' | 'synced' | 'error';
  timestamp: number;
}

export const syncService = {
  isProcessing: false,

  notifyStatus(customStatus?: { isSyncing?: boolean; currentTask?: string; progress?: number }) {
    const queue: SyncTask[] = erpDb.getSyncQueue();
    const pendingTasks = queue.filter(t => t.status === 'pending');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wakat_sync_status_updated', {
        detail: {
          isSyncing: customStatus?.isSyncing ?? this.isProcessing,
          pendingCount: pendingTasks.length,
          totalCount: queue.length,
          queue,
          currentTask: customStatus?.currentTask || (pendingTasks.length > 0 ? pendingTasks[0].type : null),
          progress: customStatus?.progress ?? (pendingTasks.length === 0 ? 100 : 0)
        }
      }));
    }
  },

  addToQueue(type: SyncActionType, payload: any) {
    const queue = erpDb.getSyncQueue();
    const newTask: SyncTask = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      status: 'pending',
      timestamp: Date.now()
    };
    erpDb.saveSyncQueue([...queue, newTask]);
    this.notifyStatus();
    this.processQueue(); // Try to process immediately if online
  },

  async processQueue() {
    if (!navigator.onLine) {
      this.notifyStatus({ isSyncing: false });
      return;
    }
    
    const queue: SyncTask[] = erpDb.getSyncQueue();
    const pendingTasks = queue.filter(t => t.status === 'pending');
    
    if (pendingTasks.length === 0) {
      this.isProcessing = false;
      this.notifyStatus({ isSyncing: false, progress: 100 });
      return;
    }

    this.isProcessing = true;
    const totalPending = pendingTasks.length;

    for (let i = 0; i < pendingTasks.length; i++) {
      const task = pendingTasks[i];
      const progressPercent = Math.round(((i + 1) / totalPending) * 100);

      this.notifyStatus({
        isSyncing: true,
        currentTask: task.type,
        progress: progressPercent
      });

      // Simulate a small network latency delay if running locally so users see progress feedback
      await new Promise(resolve => setTimeout(resolve, 350));

      try {
        await this.executeTask(task);
        task.status = 'synced';
      } catch (err) {
        console.error(`Sync error for task ${task.id}:`, err);
        task.status = 'error';
      }
      
      erpDb.saveSyncQueue(queue);
    }

    this.isProcessing = false;
    this.notifyStatus({ isSyncing: false, progress: 100 });
  },

  async executeTask(task: SyncTask) {
    switch (task.type) {
      case 'CREATE_ORDER':
        await orderService.createOrder(task.payload);
        break;
      case 'UPDATE_STOCK':
        await inventoryService.updateInventoryItem(task.payload);
        break;
      case 'CREATE_CLIENT':
        // Assuming we add a clientService later
        console.log("Syncing client:", task.payload);
        break;
      case 'ADD_PAYMENT':
        // Assuming we add a paymentService later
        console.log("Syncing payment:", task.payload);
        break;
    }
  }
};
