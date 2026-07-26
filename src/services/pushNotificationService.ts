import { InventoryItem, Product } from "../types";
import { formatCFA } from "../data";
import wakatLogo from "../assets/images/wakatmarket_logo_1785061321209.jpg";

// Cache notified item IDs to avoid spamming identical stock alerts in a single session
const notifiedStockAlerts = new Set<string>();
const notifiedPaymentAlerts = new Set<string>();

class PushNotificationService {
  /**
   * Request browser permission for native Web Push Notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("Ce navigateur ne prend pas en charge les notifications push.");
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      console.log(`[PushNotificationService] Push notification permission: ${permission}`);
      if (permission === "granted") {
        this.playNotificationSound("payment");
        this.sendPushNotification({
          title: "Notifications WakatMarket activées ! 🔔",
          body: "Vous recevrez désormais des alertes en temps réel pour vos paiements et vos stocks critiques.",
          tag: "welcome-notif"
        });
      }
      return permission;
    } catch (err) {
      console.error("Erreur lors de la demande de permission push:", err);
      return "denied";
    }
  }

  /**
   * Get current browser notification permission state
   */
  getPermissionStatus(): NotificationPermission {
    if (!("Notification" in window)) return "denied";
    return Notification.permission;
  }

  /**
   * Synthesize audio chime feedback using Web Audio API
   */
  playNotificationSound(type: "payment" | "stock_warning" | "general" = "general") {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "payment") {
        // High-pitch double bell ring (C6 -> G6)
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.5, now); // C6
        osc.frequency.setValueAtTime(1567.98, now + 0.12); // G6

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "stock_warning") {
        // Urgent double pulse tone (E5 -> C5)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.setValueAtTime(523.25, now + 0.15); // C5

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Gentle ping (A5)
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn("[PushNotificationService] Audio chime synthesis issue:", e);
    }
  }

  /**
   * Send a native browser push notification
   */
  sendPushNotification(options: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    onClickUrl?: string;
  }) {
    // Always play pleasant audio chime
    this.playNotificationSound(
      options.tag?.includes("payment") ? "payment" : options.tag?.includes("stock") ? "stock_warning" : "general"
    );

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notif = new Notification(options.title, {
          body: options.body,
          icon: options.icon || wakatLogo,
          tag: options.tag || `wakat-notif-${Date.now()}`,
          requireInteraction: true,
          silent: false,
        });

        notif.onclick = (e) => {
          e.preventDefault();
          window.focus();
          if (options.onClickUrl) {
            window.location.href = options.onClickUrl;
          }
          notif.close();
        };
      } catch (err) {
        console.warn("[PushNotificationService] Failed to display native push notification:", err);
      }
    } else {
      console.log(`[PushNotificationService] Native push disabled or ungranted. Notification fallback logged: "${options.title}: ${options.body}"`);
    }
  }

  /**
   * Notify vendor when a payment is received
   */
  notifyPaymentReceived(
    vendeurId: string,
    amount: number,
    payerName: string,
    referenceRef: string
  ) {
    const alertKey = `${vendeurId}_${referenceRef}_${amount}`;
    if (notifiedPaymentAlerts.has(alertKey)) return;
    notifiedPaymentAlerts.add(alertKey);

    const formattedAmount = formatCFA(amount);
    const title = "💰 Paiement reçu !";
    const body = `Paiement de ${formattedAmount} reçu de la part de "${payerName}" (Réf: ${referenceRef}). Votre solde a été mis à jour.`;

    this.sendPushNotification({
      title,
      body,
      tag: `payment-${referenceRef}`,
    });
  }

  /**
   * Notify vendor when an item reaches critical stock threshold
   */
  notifyStockCritical(
    vendeurId: string,
    productName: string,
    currentStock: number,
    threshold: number
  ) {
    const alertKey = `${vendeurId}_${productName}_${currentStock}`;
    if (notifiedStockAlerts.has(alertKey)) return;
    notifiedStockAlerts.add(alertKey);

    const title = "⚠️ Alerte Stock Critique !";
    const body = `Le produit "${productName}" n'a plus que ${currentStock} unité(s) en stock (seuil d'alerte: ${threshold}). Réapprovisionnez au plus vite !`;

    this.sendPushNotification({
      title,
      body,
      tag: `stock-${productName}`,
    });
  }

  /**
   * Scan seller inventory and trigger alerts for items below critical threshold
   */
  checkAndNotifyCriticalStocks(
    inventory: InventoryItem[],
    products: Product[],
    sellerId: string
  ) {
    if (!sellerId) return;

    const sellerItems = inventory.filter((item) => item.ownerId === sellerId);
    sellerItems.forEach((item) => {
      const threshold = item.threshold || 10;
      if (item.stock <= threshold) {
        const prod = products.find((p) => p.id === item.productId);
        const name = prod ? prod.name : `Produit #${item.productId.slice(0, 6)}`;
        this.notifyStockCritical(sellerId, name, item.stock, threshold);
      }
    });
  }
}

export const pushNotificationService = new PushNotificationService();
