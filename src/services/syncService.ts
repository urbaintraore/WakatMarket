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
    this.processQueue(); // Try to process immediately if online
  },

  async processQueue() {
    if (!navigator.onLine) return;
    
    const queue = erpDb.getSyncQueue();
    const pendingTasks = queue.filter(t => t.status === 'pending');
    
    if (pendingTasks.length === 0) return;

    for (const task of pendingTasks) {
      try {
        await this.executeTask(task);
        task.status = 'synced';
      } catch (err) {
        console.error(`Sync error for task ${task.id}:`, err);
        task.status = 'error';
      }
    }

    erpDb.saveSyncQueue(queue);
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
