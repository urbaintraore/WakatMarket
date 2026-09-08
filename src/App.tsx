/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users, Shield, ShieldCheck, Landmark, Truck, ShoppingCart, ShoppingBag, 
  Settings, Sparkles, RefreshCw, BarChart2, MessageSquare, 
  Scan, Bell, LogOut, Sun, Moon, HelpCircle, AlertCircle, 
  Smartphone, Mail, Lock, PhoneCall, Globe, Heart, MapPin, UserCog,
  UserCheck, UserX, WifiOff, LayoutGrid, X, Clock, Loader2, Trash2, Scale, Cloud, Menu, Zap, ChevronLeft, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { UserRole, UserProfile, Product, InventoryItem, Order, OrderStatus, ChatMessage, MessageType, AIRecommendation, LightClient, StockMovement, DebtPayment, Connection, isConnectionActive, normalizeUserRole, isBonkoungou, isRootAdminEmail } from "./types";
import {
  db, getGeoHierarchy, estimateShipping, triggerAIAnalysis, formatCFA, generateOTP, calculateApplicablePrice
} from "./data";
import { useAuth } from "./hooks/useAuth";
import { userService, FirebaseUser } from "./services/userService";
import { inventoryService } from "./services/inventoryService";
import { productService } from "./services/productService";
import { orderService } from "./services/orderService";
import { venteService } from "./services/venteService";
import { connectionService } from "./services/connectionService";

import { chatService } from "./services/chatService";
import { syncService } from "./services/syncService";
import { offlineStorage } from "./services/offlineStorage";
import { firebaseConfigError, isFirebaseConfigured, isNetworkError, firestoreGetAll, firestoreDelete } from "./firebase";

import { ProfileEditModal } from "./components/ProfileEditModal";
import { ProductDetailModal } from "./components/ProductDetailModal";
import { OnboardingTour } from "./components/OnboardingTour";
import { ResetPasswordModal } from "./components/ResetPasswordModal";
import DeleteUserConfirmationModal from "./components/DeleteUserConfirmationModal";
import { DiagnosticModule } from "./components/DiagnosticModule";
import { pushNotificationService } from "./services/pushNotificationService";
import wakatLogo from "./assets/images/wakatmarket_logo_1785061321209.jpg";

// Dashboards
import {
  AdminDashboard, ManufacturerDashboard, WholesalerDashboard,
  RetailerDashboard, ClientDashboard, DriverDashboard, SemiWholesalerDashboard
} from "./components/RoleDashboards";

// Specialized Widgets
import BarcodeScanner from "./components/BarcodeScanner";
import AICopilot from "./components/AICopilot";
import ReportsModule from "./components/ReportsModule";
import ChatModule from "./components/ChatModule";
import SupportModal from "./components/SupportModal";
import { PWAInstallModal } from "./components/PWAInstallModal";
import { PaiementsAValiderModule } from "./components/PaiementsAValiderModule";
import { PreuvePaiementUploadModal } from "./components/PreuvePaiementUploadModal";
import { NotificationBell } from "./components/NotificationBell";
import { QuickActionsBar } from "./components/QuickActionsBar";
import { B2BProductComparator } from "./components/B2BProductComparator";
import { AddressAutocomplete } from "./components/AddressAutocomplete";
import LandingPage from "./components/LandingPage";
import { AuthScreen } from "./components/AuthScreen";
import { WidgetGrid, WidgetCard, OrderWidgetCard } from "./components/WidgetGrid";
export { WidgetGrid, WidgetCard, OrderWidgetCard };
export type { WidgetGridProps } from "./components/WidgetGrid";

export default function App() {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [showComparator, setShowComparator] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPWAInstallModal, setShowPWAInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [confirmDeleteAction, setConfirmDeleteAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [userToDeleteForConfirmation, setUserToDeleteForConfirmation] = useState<UserProfile | null>(null);
  const [showPaiementsAValider, setShowPaiementsAValider] = useState(false);
  const [orderForPaymentProof, setOrderForPaymentProof] = useState<Order | null>(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("ALL");
  const [syncStatus, setSyncStatus] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    failedCount: number;
    totalCount: number;
    progress: number;
    lastError?: string;
  }>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    totalCount: 0,
    progress: 100
  });
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<string>(() => {
    return localStorage.getItem("wakat_last_successful_sync") || new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  });
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("wakat_erp_v2_theme");
    if (saved) {
      return saved === "dark";
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [autoSystemTheme, setAutoSystemTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem("wakat_erp_autosync_theme");
    if (saved !== null) {
      return saved === "true";
    }
    return !localStorage.getItem("wakat_erp_v2_theme");
  });

  useEffect(() => {
    localStorage.setItem("wakat_erp_autosync_theme", String(autoSystemTheme));
    
    const hasManualOverride = localStorage.getItem("wakat_erp_v2_theme") !== null;
    const shouldSyncWithSystem = autoSystemTheme || !hasManualOverride;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (shouldSyncWithSystem) {
      setDarkMode(mediaQuery.matches);
    }

    const handleChange = (e: MediaQueryListEvent) => {
      const currentManualOverride = localStorage.getItem("wakat_erp_v2_theme") !== null;
      if (autoSystemTheme || !currentManualOverride) {
        setDarkMode(e.matches);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Compatibility fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [autoSystemTheme]);

  const {
    firebaseUser,
    dbUser,
    logout,
    loading: authLoading,
    updateProfile
  } = useAuth();

  const [isRealUserAuthenticated, setIsRealUserAuthenticated] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [firestorePermissionError, setFirestorePermissionError] = useState<{ message: string; path?: string; rawError?: string } | null>(null);

  useEffect(() => {
    const handlePermissionError = (e: any) => {
      if (e.detail) {
        setFirestorePermissionError(e.detail);
      }
    };
    window.addEventListener("wakat_firestore_permission_error", handlePermissionError);

    // Programmatic openers used by shared components (chat / comparator) now that
    // the header toggles have been moved into the sidebar.
    const openChat = () => setShowChat((v) => !v);
    const openComparator = () => setShowComparator((v) => !v);
    window.addEventListener("wakat:open-chat", openChat);
    window.addEventListener("wakat:open-comparator", openComparator);

    return () => {
      window.removeEventListener("wakat_firestore_permission_error", handlePermissionError);
      window.removeEventListener("wakat:open-chat", openChat);
      window.removeEventListener("wakat:open-comparator", openComparator);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash === "#diagnostic" || window.location.pathname === "/diagnostic") {
        setShowDiagnostic(true);
      }

      // Check if global prompt was already captured by main.tsx
      if ((window as any).__DEFERRED_PWA_PROMPT__) {
        setDeferredPrompt((window as any).__DEFERRED_PWA_PROMPT__);
      }

      // PWA Install prompt listener
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        (window as any).__DEFERRED_PWA_PROMPT__ = e;
        setDeferredPrompt(e);
        console.log("[PWA] beforeinstallprompt captured and ready in App.");
      };

      const handleCustomPromptReady = (e: any) => {
        if (e.detail) {
          setDeferredPrompt(e.detail);
        }
      };

      const handleAppInstalled = () => {
        setIsPWAInstalled(true);
        setDeferredPrompt(null);
        (window as any).__DEFERRED_PWA_PROMPT__ = null;
        (window as any).__PWA_INSTALLED__ = true;
        console.log("[PWA] App successfully installed!");
        addNotification("Application WakatMarket installée avec succès !");
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("pwa-prompt-ready", handleCustomPromptReady);
      window.addEventListener("appinstalled", handleAppInstalled);
      window.addEventListener("pwa-installed", handleAppInstalled);

      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        (window as any).__PWA_INSTALLED__ === true
      ) {
        setIsPWAInstalled(true);
      }

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("pwa-prompt-ready", handleCustomPromptReady);
        window.removeEventListener("appinstalled", handleAppInstalled);
        window.removeEventListener("pwa-installed", handleAppInstalled);
      };
    }
  }, []);

  const triggerPWAInstall = async () => {
    const promptToUse = deferredPrompt || (typeof window !== "undefined" ? (window as any).__DEFERRED_PWA_PROMPT__ : null);
    if (promptToUse && typeof promptToUse.prompt === "function") {
      try {
        await promptToUse.prompt();
        const choice = await promptToUse.userChoice;
        if (choice && choice.outcome === "accepted") {
          setIsPWAInstalled(true);
          setDeferredPrompt(null);
          (window as any).__DEFERRED_PWA_PROMPT__ = null;
          (window as any).__PWA_INSTALLED__ = true;
          addNotification("Application WakatMarket installée avec succès !");
        } else {
          setShowPWAInstallModal(true);
        }
      } catch (err) {
        console.warn("[PWA] Erreur lors du déclenchement du prompt natif:", err);
        setShowPWAInstallModal(true);
      }
    } else {
      setShowPWAInstallModal(true);
    }
  };


  // DB States
  const [users, setUsers] = useState<UserProfile[]>(() => db.getUsers());
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => db.getInventory());
  const [orders, setOrders] = useState<Order[]>(() => db.getOrders());
  const [messages, setMessages] = useState<ChatMessage[]>(() => db.getMessages());
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(() => db.getRecommendations());
  const [platformStats, setPlatformStats] = useState(() => db.getPlatformStats());
  const [lightClients, setLightClients] = useState<LightClient[]>(() => db.getLightClients());
  const [connections, setConnections] = useState<Connection[]>(() => db.getConnections());
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => db.getStockMovements());
  const [payments, setPayments] = useState<DebtPayment[]>(() => db.getPayments());
  const [syncQueue, setSyncQueue] = useState<any[]>(() => db.getSyncQueue());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Active User session (récupérée via l'auth ou une session Firebase restaurée)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (currentUser?.id && typeof localStorage !== "undefined") {
      localStorage.setItem("wakat_active_user_id", currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    setIsRealUserAuthenticated(!!firebaseUser && !!dbUser);
  }, [firebaseUser, dbUser]);

  // Firebase Sync for users
  useEffect(() => {
    
    if (isRealUserAuthenticated) {
      const unsubscribe = userService.subscribeToAllUsers((fbUsers) => {
        const mappedUsers: UserProfile[] = fbUsers.map(u => {
          return {
            id: u.uid,
            name: `${u.prénom || ""} ${u.nom || ""}`.trim() || "Utilisateur",
            email: u.email,
            phone: u.téléphone,
            role: (u.rôle as any),
            status: u.statut as any,
            country: u.pays || "Burkina Faso",
            region: u.ville || "Ouagadougou",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            companyName: u.companyName || `${u.nom || "Entreprise"} Entreprise`
          };
        });
        const dedupedUsers = deduplicateUsers(mappedUsers);
        setUsers(dedupedUsers);
      });
      return () => unsubscribe();
    }
  }, [isRealUserAuthenticated]);

  // Firebase Sync for products
  useEffect(() => {
    
    if (isRealUserAuthenticated) {
      const unsubscribe = productService.subscribeToProducts((fbProducts) => {
        if (fbProducts && fbProducts.length > 0) {
          setProducts(fbProducts);
          db.saveProducts(fbProducts);
        }
      });
      return () => unsubscribe();
    }
  }, [isRealUserAuthenticated]);

  // Firebase Sync for inventory
  useEffect(() => {
    
    if (isRealUserAuthenticated) {
      const unsubscribe = inventoryService.subscribeToInventory((fbInventory) => {
        if (fbInventory && fbInventory.length > 0) {
          setInventory(prev => {
            const updatedMap = new Map<string, InventoryItem>();
            prev.forEach(item => {
              if (item && item.id) updatedMap.set(item.id, item);
            });
            fbInventory.forEach(item => {
              if (item && item.id) updatedMap.set(item.id, item);
            });
            const nextList = Array.from(updatedMap.values());
            db.saveInventory(nextList);
            return nextList;
          });
        }
      });
      return () => unsubscribe();
    }
  }, [isRealUserAuthenticated]);

  // Silent background cleanup of any remaining mock/fictional inventory items
  useEffect(() => {
    const runDeepCleanup = async () => {
      if (!isRealUserAuthenticated) return;
      
      // 1. Clean local state and db inventory items matching mock conditions
      if (inventory.length > 0) {
        const mockItems = inventory.filter(i => 
          i.id.includes("bonk") || 
          i.id.includes("sayouba") || 
          (i.ownerId && (i.ownerId.includes("bonk") || i.ownerId.includes("sayouba") || i.ownerId.includes("ujk.b") || i.ownerId.includes("ujkz")))
        );
        if (mockItems.length > 0) {
          for (const item of mockItems) {
            await inventoryService.deleteInventoryItem(item.id).catch(err => {
              console.error("Failed to delete mock item from database:", item.id, err);
            });
          }
          const cleanInventory = inventory.filter(i => 
            !i.id.includes("bonk") && 
            !i.id.includes("sayouba") && 
            !(i.ownerId && (i.ownerId.includes("bonk") || i.ownerId.includes("sayouba") || i.ownerId.includes("ujk.b") || i.ownerId.includes("ujkz")))
          );
          syncInventory(cleanInventory);
        }
      }
    };

    runDeepCleanup();
  }, [isRealUserAuthenticated]);

  // Sub-collection user stock sync
  useEffect(() => {
    if (currentUser?.id) {
      const unsub = inventoryService.subscribeToUserStock(currentUser.id, (subItems) => {
        if (subItems && subItems.length > 0) {
          setInventory(prev => {
            const updatedMap = new Map<string, InventoryItem>();
            prev.forEach(item => {
              if (item && item.id) updatedMap.set(item.id, item);
            });
            subItems.forEach(item => {
              if (item && item.id) updatedMap.set(item.id, item);
            });
            const nextList = Array.from(updatedMap.values());
            db.saveInventory(nextList);
            return nextList;
          });
        }
      });
      return () => unsub();
    }
  }, [currentUser?.id]);

  // Firebase Sync for orders
  useEffect(() => {
    
    if (isRealUserAuthenticated) {
      const unsubscribe = orderService.subscribeToOrders((fbOrders) => {
        if (fbOrders && fbOrders.length > 0) {
          setOrders(prev => {
            const updatedMap = new Map<string, Order>();
            prev.forEach(item => {
              if (item && item.id) updatedMap.set(item.id, item);
            });
            fbOrders.forEach(item => {
              if (item && item.id) updatedMap.set(item.id, item);
            });
            const nextList = Array.from(updatedMap.values());
            db.saveOrders(nextList);
            return nextList;
          });
        }
      });
      return () => unsubscribe();
    }
  }, [isRealUserAuthenticated]);

  // Sync currentUser with real Firebase user
  useEffect(() => {
    if (isRealUserAuthenticated && dbUser) {
      const normEmail = dbUser.email ? dbUser.email.toLowerCase().trim() : "";
      const determinedRole = isRootAdminEmail(normEmail)
        ? UserRole.ADMIN
        : normalizeUserRole(dbUser.rôle || dbUser.role || UserRole.CLIENT);

      const mapped: UserProfile = {
        id: dbUser.uid,
        name: `${dbUser.prénom || ""} ${dbUser.nom || ""}`.trim() || "Utilisateur",
        email: dbUser.email,
        phone: dbUser.téléphone,
        role: determinedRole,
        status: dbUser.statut as any,
        country: dbUser.pays || "Burkina Faso",
        region: dbUser.ville || "Ouagadougou",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        companyName: dbUser.companyName || `${dbUser.nom || "Entreprise"} Entreprise`
      };
      setCurrentUser(mapped);
    }
  }, [isRealUserAuthenticated, dbUser]);

  // UI state managers
  const [initialLoadingTimeout, setInitialLoadingTimeout] = useState(false);
  // Whether the user has explicitly chosen to enter the platform (landing gate).
  // The landing page is shown first to redirect every actor towards his own space.
  const [enteredApp, setEnteredApp] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Deduplicate helper
  const deduplicate = <T extends { id: string }>(arr: T[]): T[] => {
    const map = new Map<string, T>();
    arr.forEach(item => {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const deduplicateUsers = (arr: UserProfile[]): UserProfile[] => {
    const map = new Map<string, UserProfile>();
    const idMap = new Map<string, string>();
    const emailMap = new Map<string, string>();
    const companyMap = new Map<string, string>();

    arr.forEach(u => {
      if (!u) return;

      const normEmail = u.email ? u.email.toLowerCase().trim() : "";
      const normCompany = u.companyName ? u.companyName.toLowerCase().trim() : "";

      const cleanEmail = u.email ? u.email.toLowerCase().trim() : "";
      const cleanCompany = u.companyName ? u.companyName.toLowerCase().trim() : "";

      let targetId: string | undefined = undefined;

      if (cleanEmail && emailMap.has(cleanEmail)) {
        targetId = emailMap.get(cleanEmail);
      } else if (cleanCompany && cleanCompany !== "entreprise" && cleanCompany !== "sans entreprise" && companyMap.has(cleanCompany)) {
        targetId = companyMap.get(cleanCompany);
      } else if (u.id && idMap.has(u.id)) {
        targetId = idMap.get(u.id);
      } else if (u.id && map.has(u.id)) {
        targetId = u.id;
      }

      if (targetId && map.has(targetId)) {
        const existing = map.get(targetId)!;
        const merged: UserProfile = {
          ...existing,
          ...u,
          id: targetId,
          role: u.role || existing.role,
          companyName: u.companyName || existing.companyName,
          name: u.name || existing.name
        };
        map.set(targetId, merged);
        if (u.id) idMap.set(u.id, targetId);
        if (cleanEmail) emailMap.set(cleanEmail, targetId);
        if (cleanCompany && cleanCompany !== "entreprise" && cleanCompany !== "sans entreprise") companyMap.set(cleanCompany, targetId);
      } else {
        const idToUse = u.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        u.id = idToUse;
        map.set(idToUse, u);
        if (u.id) idMap.set(u.id, idToUse);
        if (cleanEmail) emailMap.set(cleanEmail, idToUse);
        if (cleanCompany && cleanCompany !== "entreprise" && cleanCompany !== "sans entreprise") companyMap.set(cleanCompany, idToUse);
      }
    });

    return Array.from(map.values()).filter(u => (u.status as any) !== "DELETED");
  };

  // Synchronize Firebase User profile to Active ERP Session
  useEffect(() => {
    if (firebaseUser) {
      const profileSource = dbUser || {
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        nom: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Utilisateur",
        prénom: "",
        email: firebaseUser.email || "",
        téléphone: firebaseUser.phoneNumber || "",
        phone: firebaseUser.phoneNumber || "",
        rôle: isRootAdminEmail(firebaseUser.email) ? UserRole.ADMIN : UserRole.CLIENT,
        role: isRootAdminEmail(firebaseUser.email) ? UserRole.ADMIN : UserRole.CLIENT,
        statut: "ACTIF"
      };

      const existingUser = users.find(u => u.id === profileSource.uid);

      const activeProfile: UserProfile = {
        id: profileSource.uid,
        name: `${profileSource.prénom || ""} ${profileSource.nom || ""}`.trim() || profileSource.email?.split("@")[0] || "Utilisateur",
        email: profileSource.email,
        phone: profileSource.téléphone || profileSource.phone,
        role: isRootAdminEmail(profileSource.email)
          ? UserRole.ADMIN 
          : normalizeUserRole(profileSource.rôle || profileSource.role || UserRole.CLIENT),
        status: (profileSource.statut as any) || "ACTIVE",
        country: profileSource.pays || "Burkina Faso",
        region: profileSource.ville || "Ouagadougou",
        sector: profileSource.quartier,
        latitude: profileSource.latitude,
        longitude: profileSource.longitude,
        avatar: firebaseUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        balance: existingUser?.balance || 0,
        companyName: profileSource.companyName || existingUser?.companyName || `${profileSource.nom || "Entreprise"} Entreprise`,
        address: profileSource.ville && profileSource.quartier ? `${profileSource.quartier}, ${profileSource.ville}` : "Non spécifié"
      };
      
      // Update local ERP database of users with full deduplication
      setUsers((prev) => {
        const newList = deduplicateUsers([...prev, activeProfile]);
        db.saveUsers(newList);
        return newList;
      });
      
      setCurrentUser(activeProfile);
      setIsRealUserAuthenticated(true);
    } else {
      setIsRealUserAuthenticated(false);
      // Pas de session Firebase active : aucun accès sans authentification (tous environnements).
      // L'écran AuthScreen est le seul moyen d'entrer dans l'application.
      setCurrentUser(null);
    }
  }, [firebaseUser, dbUser]);

  // Dès qu'un profil actif est disponible (session restaurée, login ou choix de rôle),
  // on bascule de la landing page vers l'espace applicatif correspondant à son rôle.
  useEffect(() => {
    if (currentUser) {
      setEnteredApp(true);
    }
  }, [currentUser]);

  // Synchroniser tous les autres utilisateurs réels depuis Firebase et le stockage local
  useEffect(() => {
    let active = true;
    const fetchRealUsers = async () => {
      try {
        const fbUsers = await userService.getAllUsers();
        if (!active) return;
        const allStored = db.getUsers();
        const combinedMap = new Map<string, UserProfile>();
        allStored.forEach(u => combinedMap.set(u.id, u));

        if (fbUsers && fbUsers.length > 0) {
          fbUsers.forEach((u) => {
            const existing = combinedMap.get(u.uid);
            const mappedUser: UserProfile = {
              id: u.uid,
              name: `${u.prénom || ""} ${u.nom || ""}`.trim() || u.email?.split("@")[0] || "Utilisateur",
              email: u.email || "",
              phone: u.téléphone || "",
              role: ((u.rôle as UserRole) || UserRole.CLIENT),
              status: (u.statut as any) || "ACTIVE",
              country: u.pays || "Burkina Faso",
              region: u.ville || "Ouagadougou",
              sector: u.quartier,
              latitude: u.latitude,
              longitude: u.longitude,
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
              balance: existing?.balance || 0,
              companyName: u.companyName || `${u.nom || u.email?.split("@")[0] || "Entreprise"} Entreprise`,
              address: u.ville && u.quartier ? `${u.quartier}, ${u.ville}, ${u.pays || ""}` : "Non spécifié"
            };
            combinedMap.set(mappedUser.id, mappedUser);
          });
        }

        const finalUsers = deduplicateUsers(Array.from(combinedMap.values()));
        setUsers(finalUsers);
        db.saveUsers(finalUsers);
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("[App] Synchronisation utilisateurs en mode hors-ligne.");
        } else {
          console.error("Erreur de chargement des utilisateurs :", err);
        }
      }
    };

    fetchRealUsers();
    
    const fetchCloudData = async () => {
      if (dbUser) {
        try {
          const [cloudProducts, cloudInventory, cloudOrders] = await Promise.all([
            productService.getAllProducts(),
            inventoryService.getAllInventory(),
            orderService.getAllOrders()
          ]);
          
          if (!active) return;

          if (cloudProducts.length > 0) {
            setProducts(prev => {
              const updated = [...prev];
              cloudProducts.forEach(cp => {
                const idx = updated.findIndex(p => p.id === cp.id);
                if (idx !== -1) updated[idx] = cp;
                else updated.push(cp);
              });
              db.saveProducts(updated);
              return updated;
            });
          }

          if (cloudInventory.length > 0) {
            setInventory(prev => {
              const updated = [...prev];
              cloudInventory.forEach(ci => {
                const idx = updated.findIndex(i => i.id === ci.id);
                if (idx !== -1) updated[idx] = ci;
                else updated.push(ci);
              });
              db.saveInventory(updated);
              return updated;
            });
          }

          if (cloudOrders.length > 0) {
            setOrders(prev => {
              const updated = [...prev];
              cloudOrders.forEach(co => {
                const idx = updated.findIndex(o => o.id === co.id);
                if (idx !== -1) updated[idx] = co;
                else updated.push(co);
              });
              db.saveOrders(updated);
              return updated;
            });
          }
        } catch (err) {
          if (isNetworkError(err)) {
            console.warn("[App] Synchronisation données cloud en mode hors-ligne.");
          } else {
            console.error("Error loading cloud data:", err);
          }
        }
      }
    };
    fetchCloudData();

    return () => {
      active = false;
    };
  }, [firebaseUser, dbUser]);

  const [showScanner, setShowScanner] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showMobileToolsMenu, setShowMobileToolsMenu] = useState(false);

  // States for user profile editing
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // State for Product Detail Modal with 30-Day Recharts Price Graph
  const [viewingProductDetail, setViewingProductDetail] = useState<{
    product: Product;
    inventoryItem?: InventoryItem;
  } | null>(null);

  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser?.id) {
      try {
        const stored = localStorage.getItem(`wakat_favorites_${currentUser.id}`);
        setFavoriteProductIds(stored ? JSON.parse(stored) : []);
      } catch {
        setFavoriteProductIds([]);
      }
    } else {
      setFavoriteProductIds([]);
    }
  }, [currentUser?.id]);

  const handleToggleFavorite = (productId: string) => {
    if (!currentUser?.id) return;
    setFavoriteProductIds((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem(`wakat_favorites_${currentUser.id}`, JSON.stringify(next));
      return next;
    });
  };

  const handleSelectProduct = (product: Product) => {
    const item = inventory.find((i) => i.productId === product.id);
    setViewingProductDetail({ product, inventoryItem: item });
  };

  const handleOpenProfileEdit = () => {
    setShowProfileEdit(true);
  };

  const handleProfileUpdateSuccess = (updatedProfile: UserProfile) => {
    setCurrentUser(updatedProfile);
    setUsers(prev => {
      const index = prev.findIndex(u => u.id === updatedProfile.id);
      if (index !== -1) {
        const next = [...prev];
        next[index] = updatedProfile;
        db.saveUsers(next);
        return next;
      }
      const next = [...prev, updatedProfile];
      db.saveUsers(next);
      return next;
    });
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [realNotifications, setRealNotifications] = useState<Notification[]>([]);
  const knownNotificationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleOpenUploadProof = (e: any) => {
      if (e.detail && e.detail.order) {
        setOrderForPaymentProof(e.detail.order);
      }
    };

    const handleOpenValiderPaiements = () => {
      setShowPaiementsAValider(true);
    };

    window.addEventListener("wakat_open_upload_proof", handleOpenUploadProof);
    window.addEventListener("wakat_open_valider_paiements", handleOpenValiderPaiements);

    const handleUsersUpdated = () => {
      setUsers(db.getUsers());
    };
    const handleConnectionsUpdated = (e?: any) => {
      const allConns = db.getConnections();
      console.log(`[App.tsx:handleConnectionsUpdated]  Event received (${e?.type || 'manual'}), checking consistency across ${allConns.length} stored connection(s)...`, e?.detail);
      
      if (currentUser) {
        const userConns = allConns.filter(c => c.senderId === currentUser.id || c.receiverId === currentUser.id);
        const activeConns = userConns.filter(c => c.status === "active" || (c as any).statut === "ACTIF");
        const pendingConns = userConns.filter(c => c.status === "en_attente" || (c.status as string) === "pending");
        
        console.log(`[App.tsx:handleConnectionsUpdated]  Consistency verified for user ID="${currentUser.id}" (${currentUser.name || currentUser.companyName}): ${activeConns.length} ACTIVE partnership(s), ${pendingConns.length} pending request(s).`);
        activeConns.forEach(c => {
          const partnerId = c.senderId === currentUser.id ? c.receiverId : c.senderId;
          const partnerName = c.senderId === currentUser.id ? c.receiverName : c.senderName;
          console.log(`  -  ACTIVE Partner: #${c.id} with partner "${partnerName || partnerId}" (Sender=${c.senderId}, Receiver=${c.receiverId}, Status=${c.status})`);
        });

        setConnections(userConns);
      }
    };

    window.addEventListener("wakat_users_updated", handleUsersUpdated);
    window.addEventListener("wakat_connections_updated", handleConnectionsUpdated);
    window.addEventListener("wakat_partnership_established", handleConnectionsUpdated);

    return () => {
      window.removeEventListener("wakat_open_upload_proof", handleOpenUploadProof);
      window.removeEventListener("wakat_open_valider_paiements", handleOpenValiderPaiements);
      window.removeEventListener("wakat_users_updated", handleUsersUpdated);
      window.removeEventListener("wakat_connections_updated", handleConnectionsUpdated);
      window.removeEventListener("wakat_partnership_established", handleConnectionsUpdated);
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      console.log(`[App.tsx]  Subscribing to notifications and connections for active user ID="${currentUser.id}" (${currentUser.name || currentUser.companyName})`);
      
      // Auto-repair any pending relationship inconsistencies
      connectionService.repairPendingConnections(currentUser.id).catch(err => {
        console.warn("[App.tsx] Non-blocking notice during repairPendingConnections:", err);
      });

      const unsubConns = connectionService.subscribeToUserConnections(currentUser.id, (freshConns) => {
        console.log(`[App.tsx:subscribeToUserConnections]  Real-time connections update received for user ${currentUser.id}. Total active/pending connections: ${freshConns.length}`, freshConns);
        const verifiedActive = freshConns.filter(c => c.status === "active" || (c as any).statut === "ACTIF");
        console.log(`[App.tsx:subscribeToUserConnections]  Verified active connections count: ${verifiedActive.length}`);
        setConnections(freshConns);
      });
      
      const unsubNotifs = connectionService.subscribeToUserNotifications(currentUser.id, (notifs) => {
        console.log(`[App.tsx:subscribeToUserNotifications]  Real-time notifications update received for user ${currentUser.id}. Total notifications: ${notifs.length}`, notifs);
        // Find truly NEW unread notifications that we haven't toasted yet
        const newUnread = notifs.filter(n => !n.read && !knownNotificationIds.current.has(n.id));
        
        if (newUnread.length > 0) {
          newUnread.forEach(n => {
            addNotification(`${n.title}: ${n.message}`);
            knownNotificationIds.current.add(n.id);
          });
        }

        // Update known IDs so we don't toast them again if they reappear
        notifs.forEach(n => knownNotificationIds.current.add(n.id));
        
        setRealNotifications(notifs);
      });

      return () => {
        console.log(`[App.tsx]  Unsubscribing from connections and notifications for user ${currentUser.id}`);
        unsubConns();
        unsubNotifs();
      };
    }
  }, [currentUser?.id]);

  // Cleanup orphaned connections on initialization
  const cleanupOrphanedConnections = async () => {
    console.log("[App.tsx]  Executing cleanupOrphanedConnections at initialization...");
    try {
      const localConns = db.getConnections();
      const allUsers = db.getUsers();
      const validUserIds = new Set(allUsers.map(u => u.id));

      if (isFirebaseConfigured()) {
        try {
          const fbProfiles = await firestoreGetAll("profiles");
          if (fbProfiles && Array.isArray(fbProfiles)) {
            fbProfiles.forEach((p: any) => validUserIds.add(p.id));
          }
        } catch (e) {
          console.warn("[cleanupOrphanedConnections] Could not query Firestore profiles:", e);
        }
      }

      const activeOrPending = localConns.filter(c => 
        c.status === "active" || c.status === "en_attente" || (c.status as string) === "pending"
      );

      const orphanedIds: string[] = [];

      activeOrPending.forEach(conn => {
        const isSenderValid = conn.senderId && (validUserIds.has(conn.senderId) || (conn.senderName && conn.senderName !== "Utilisateur"));
        const isReceiverValid = conn.receiverId && (validUserIds.has(conn.receiverId) || (conn.receiverName && conn.receiverName !== "Utilisateur"));
        const isSelfReferential = conn.senderId === conn.receiverId;

        if (!conn.senderId || !conn.receiverId || isSelfReferential || (!isSenderValid && !isReceiverValid)) {
          orphanedIds.push(conn.id);
        }
      });

      if (orphanedIds.length > 0) {
        console.log(`[cleanupOrphanedConnections]  Found ${orphanedIds.length} orphaned active/pending connection(s) to remove:`, orphanedIds);
        const cleaned = localConns.filter(c => !orphanedIds.includes(c.id));
        db.saveConnections(cleaned);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("wakat_erp_v2_connections", JSON.stringify(cleaned));
        }
        await offlineStorage.setItems("relations", cleaned);
        if (currentUser) {
          setConnections(cleaned.filter(c => c.senderId === currentUser.id || c.receiverId === currentUser.id));
        }
        if (isFirebaseConfigured()) {
          try {
            await Promise.all(orphanedIds.map(id => firestoreDelete("relations", id)));
            console.log("[cleanupOrphanedConnections] Deleted orphaned relations from Firestore.");
          } catch (e) {
            console.warn("[cleanupOrphanedConnections] Firestore orphan deletion warning:", e);
          }
        }
      } else {
        console.log("[cleanupOrphanedConnections]  No orphaned connections found.");
      }
    } catch (err) {
      console.error("[cleanupOrphanedConnections] Error during cleanup:", err);
    }
  };

  useEffect(() => {
    cleanupOrphanedConnections();
  }, []);

  // Automatic real-time monitoring of seller stock levels to trigger critical stock push notifications
  useEffect(() => {
    if (currentUser && [UserRole.MANUFACTURER, UserRole.WHOLESALER, UserRole.SEMI_WHOLESALER, UserRole.RETAILER].includes(currentUser.role)) {
      pushNotificationService.checkAndNotifyCriticalStocks(inventory, products, currentUser.id);
    }
  }, [currentUser?.id, inventory, products]);

  // Sync back to db helpers
  const syncUsers = async (list: UserProfile[]) => {
    setUsers(list);
    db.saveUsers(list);
    
    // If authenticated, also update Firebase users list or handle individual deletions
    // Note: handleDeleteUser will handle specific Firebase deletions
  };

  const syncProducts = (list: Product[]) => {
    setProducts(list);
    db.saveProducts(list);
  };

  const syncInventory = (list: InventoryItem[]) => {
    setInventory(list);
    db.saveInventory(list);
  };

  const syncOrders = (list: Order[]) => {
    setOrders(list);
    db.saveOrders(list);
  };

  const syncMessages = (list: ChatMessage[]) => {
    setMessages(list);
    db.saveMessages(list);
  };

  const syncLightClients = (list: LightClient[]) => {
    setLightClients(list);
    db.saveLightClients(list);
  };

  const syncStockMovements = (list: StockMovement[]) => {
    setStockMovements(list);
    db.saveStockMovements(list);
  };

  const syncPayments = (list: DebtPayment[]) => {
    setPayments(list);
    db.savePayments(list);
  };

  // Real-time Sync Status & Queue Subscription
  useEffect(() => {
    const unsubscribe = syncService.subscribe((status, queue) => {
      setIsOnline(status.isOnline);
      setSyncStatus({
        isOnline: status.isOnline,
        isSyncing: status.isSyncing,
        pendingCount: status.pendingCount,
        failedCount: status.failedCount,
        totalCount: queue.length,
        progress: status.isSyncing ? 65 : 100,
        lastError: status.lastError
      });
      setSyncQueue(queue);

      // Record sync time if online and done syncing with no pending or failed items
      if (status.isOnline && !status.isSyncing && status.pendingCount === 0 && status.failedCount === 0) {
        const nowStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        setLastSuccessfulSync(nowStr);
        localStorage.setItem("wakat_last_successful_sync", nowStr);
      }
    });
    return () => unsubscribe();
  }, []);

  const [toasts, setToasts] = useState<{ id: string; text: string; time: string }[]>([]);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.id) {
      const tourCompleted = localStorage.getItem(`wakat_onboarding_completed_${currentUser.id}`);
      if (!tourCompleted) {
        setShowOnboarding(true);
      }
    }
  }, [currentUser?.id]);

  // Add Notification helper
  const addNotification = (text: string) => {
    const fresh = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setToasts((prev) => [fresh, ...prev].slice(0, 5));
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== fresh.id));
    }, 5000);
  };

  // Auto expiration alert trigger (15 days notice)
  const notifiedExpirationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser || !inventory || inventory.length === 0) return;

    const alerts = inventoryService.checkExpirationAlerts(inventory, products, 15);
    const userAlerts = alerts.filter(
      (a) => a.ownerId === currentUser.id || currentUser.role === UserRole.ADMIN
    );

    userAlerts.forEach((alert) => {
      if (!notifiedExpirationsRef.current.has(alert.id)) {
        notifiedExpirationsRef.current.add(alert.id);
        addNotification(alert.message);

        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("Alerte Péremption (15j) - WakatMarket", {
              body: alert.message,
              icon: wakatLogo,
            });
          } catch (e) {
            console.warn("Notification error:", e);
          }
        }
      }
    });
  }, [inventory, products, currentUser]);

  // Dynamic Class for theme apply
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("wakat_erp_v2_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("wakat_erp_v2_theme", "light");
    }
  }, [darkMode]);

  // ERP Operations
  const handleToggleUserStatus = (userId: string) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        const nextStatus: "ACTIVE" | "PENDING" | "SUSPENDED" = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
        addNotification(`Compte ${u.companyName || u.name} : ${nextStatus}`);
        return { ...u, status: nextStatus };
      }
      return u;
    });
    syncUsers(updated);
  };

  
  const handleUpdateUserProfileAdmin = async (userId: string, fields: Partial<UserProfile>) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, ...fields };
      }
      return u;
    });
    setUsers(updated);
    db.saveUsers(updated);
    addNotification("Profil utilisateur mis à jour avec succès (Admin).");

    try {
      const fbUpdate: any = {};
      if (fields.role !== undefined) fbUpdate.rôle = fields.role;
      if (fields.country !== undefined) fbUpdate.pays = fields.country;
      if (fields.region !== undefined) fbUpdate.ville = fields.region;
      if (fields.sector !== undefined) fbUpdate.quartier = fields.sector;
      if (fields.phone !== undefined) fbUpdate.téléphone = fields.phone;
      if (fields.latitude !== undefined) fbUpdate.latitude = fields.latitude;
      if (fields.longitude !== undefined) fbUpdate.longitude = fields.longitude;
      
      if (fields.name) {
        fbUpdate.nom = fields.name.split(" ").slice(1).join(" ") || fields.name;
        fbUpdate.prénom = fields.name.split(" ")[0];
      }
      
      await userService.updateUser(userId, fbUpdate);
    } catch (err) {
      console.error("Erreur mise à jour Firebase par admin:", err);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: UserRole) => {
    // Local Update
    const updated = users.map((u) => {
      if (u.id === userId) {
        addNotification(`Rôle mis à jour pour ${u.companyName || u.name} : ${newRole}`);
        return { ...u, role: newRole };
      }
      return u;
    });
    syncUsers(updated);

    // Firebase Update
    try {
      const fbProfile = await userService.getUser(userId);
      if (fbProfile) {
        await userService.updateUser(userId, { rôle: newRole });
      }
    } catch (err) {
      console.error("Erreur mise à jour Firebase du rôle:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    console.log(`[Delete pipeline] Step 1/3: handleDeleteUser initiated for userId="${userId}"`);

    // Review the interaction with the current user's session role
    const isAdmin = currentUser?.role === UserRole.ADMIN || (dbUser && (dbUser.rôle === "ADMIN" || dbUser.role === "ADMIN"));
    if (!isAdmin) {
      console.warn(`[Delete pipeline] WARNING: User deletion attempted without ADMIN privileges. Current user:`, currentUser);
    }

    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete) {
      const userName = userToDelete.companyName || userToDelete.name || "Utilisateur";
      console.log(`[Delete pipeline] Step 2/3: Opening confirmation modal for userId="${userId}", userName="${userName}"`);
      setUserToDeleteForConfirmation(userToDelete);
    } else {
      console.error(`[Delete pipeline] ERROR: Target user with userId="${userId}" not found in current local state list.`);
    }
  };

  const handleSuccessDeleteUser = (userId: string) => {
    console.log(`[Delete pipeline] Step 3/3: handleSuccessDeleteUser triggered for userId="${userId}"`);

    // Retrieve user details from state before filtering
    const userToDelete = users.find(u => u.id === userId);
    const userName = userToDelete ? (userToDelete.companyName || userToDelete.name) : "cet utilisateur";

    console.log(`[Delete pipeline] Removing user from local reactive state: userId="${userId}", userName="${userName}"`);
    
    // Ensure state update correctly triggers a re-render using a functional state update to prevent stale closures
    setUsers((prevUsers) => {
      const updatedUsers = prevUsers.filter((u) => u.id !== userId);
      console.log(`[Delete pipeline] Local reactive state updated. Remaining users count: ${updatedUsers.length}`);
      
      // Save updated users list to persistent DB
      db.saveUsers(updatedUsers);
      return updatedUsers;
    });

    // Clean up any connections/relations
    const currentConns = db.getConnections();
    const updatedConns = currentConns.filter(c => c.senderId !== userId && c.receiverId !== userId && c.id !== userId);
    db.saveConnections(updatedConns);
    connectionService.deleteConnection(userId);

    // Clean up light clients
    const currentLc = db.getLightClients();
    const updatedLc = currentLc.filter(lc => lc.linkedUserId !== userId && lc.id !== userId);
    db.saveLightClients(updatedLc);
    setLightClients(updatedLc);

    console.log(`[Delete pipeline] Cleaning up local storage entries for userId="${userId}"`);
    try {
      localStorage.removeItem(`wakat_erp_v2_user_${userId}`);
      console.log(`[Delete pipeline] LocalStorage entry "wakat_erp_v2_user_${userId}" removed.`);

      const erpUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      if (erpUsersRaw) {
        const erpList: any[] = JSON.parse(erpUsersRaw);
        const filtered = erpList.filter((u: any) => u.id !== userId);
        localStorage.setItem("wakat_erp_v2_users", JSON.stringify(filtered));
        console.log(`[Delete pipeline] LocalStorage "wakat_erp_v2_users" collection updated. New count: ${filtered.length}`);
      }
    } catch (e) {
      console.error("[Delete pipeline] ERROR: Failed during local storage cleanup:", e);
    }

    addNotification(`${userName} a été supprimé définitivement.`);
    console.log(`[Delete pipeline] Deletion pipeline fully completed for userId="${userId}".`);
  };

  // Cleanup for specific users requested by admin
  useEffect(() => {
    const cleanupUsers = async () => {
      if (users.length > 0) {
        const namesToDelete = ["Jean jacques Rousseaux", "Demigrossiste1"];
        const emailsToDelete: string[] = []; // Removed sayouba@ujkz.bf
        const usersToDelete = users.filter(u => 
          namesToDelete.includes(u.name) || 
          namesToDelete.includes(u.companyName || "") ||
          emailsToDelete.includes(u.email || "")
        );
        
        if (usersToDelete.length > 0) {
          console.log("[Cleanup] Force deleting users:", usersToDelete.map(u => u.name || u.email));
          const idsToDelete = usersToDelete.map(u => u.id);
          
          // 1. Update state
          setUsers(prev => prev.filter(u => !idsToDelete.includes(u.id)));
          
          // 2. Update local DB
          const currentLocalUsers = db.getUsers();
          const filteredLocal = currentLocalUsers.filter(u => !idsToDelete.includes(u.id));
          db.saveUsers(filteredLocal);
 
          // 3. Update Firebase if authenticated
          {
            for (const u of usersToDelete) {
              try {
                await userService.deleteUser(u.id);
                console.log(`[Cleanup] Deleted from Firebase: ${u.id}`);
              } catch (e) {
                console.error(`[Cleanup] Error deleting user ${u.id} from Firebase:`, e);
              }
            }
          }
          
          addNotification("Nettoyage des comptes effectué.");
        }
      }
    };
    
    cleanupUsers();
  }, [users.length, isRealUserAuthenticated]);

  const handleUpdateCommission = (rate: number) => {
    const updatedStats = { ...platformStats, commissionRate: rate };
    setPlatformStats(updatedStats);
    db.savePlatformStats(updatedStats);
    addNotification(`Taux de commission mis à jour à ${rate}%`);
  };

  // Manufacturer catalogs creation (Offline-First Resilient with Automatic Price Validation)
  const handleCreateProduct = async (
    p: Omit<Product, "id" | "creatorId">, 
    initialStock: number, 
    price: number,
    prixGros?: number,
    prixDetail?: number,
    quantiteMinimum?: number,
    threshold?: number,
    expirationDate?: string,
    costPrice?: number
  ) => {
    if (!currentUser || !currentUser.id) {
      addNotification("Erreur: Vous devez être connecté avec un compte valide pour créer un produit.");
      return;
    }

    // Automatic Validation: Check if selling price is lower than purchase/cost price
    const buyingPrice = Number(costPrice) > 0 ? Number(costPrice) : 0;
    const minSellingPrice = Math.min(
      price > 0 ? price : Infinity,
      prixGros !== undefined && prixGros > 0 ? prixGros : Infinity,
      prixDetail !== undefined && prixDetail > 0 ? prixDetail : Infinity
    );

    if (buyingPrice > 0 && minSellingPrice < buyingPrice) {
      const errorMsg = ` Validation Échouée : Le prix de vente (${formatCFA(minSellingPrice)}) ne peut pas être inférieur au prix d'achat (${formatCFA(buyingPrice)}). Vente à perte interdite.`;
      addNotification(errorMsg);
      alert(`[Avertissement Vente à Perte]\n\nLe prix de vente le plus bas (${formatCFA(minSellingPrice)}) est inférieur au prix d'achat (${formatCFA(buyingPrice)}).\n\nLa création du produit est annulée pour préserver vos marges.`);
      return;
    }

    const newId = `p-${Date.now()}`;
    const newProd: Product = {
      ...p,
      id: newId,
      creatorId: currentUser.id,
      prixGros: prixGros !== undefined ? prixGros : price,
      prixDetail: prixDetail !== undefined ? prixDetail : price,
    };

    const newInvItem: InventoryItem = {
      id: `i-${Date.now()}`,
      productId: newProd.id,
      ownerId: currentUser.id,
      stock: initialStock,
      threshold: Math.max(5, Math.round(initialStock * 0.15)),
      price: price,
      expirationDate: p.expirationDate,
      prixGros: prixGros !== undefined ? prixGros : price,
      prixDetail: prixDetail !== undefined ? prixDetail : price,
      quantiteMinimum: quantiteMinimum !== undefined ? quantiteMinimum : 1
    };

    // 1. Instant local persistence & React state update (No freeze/lag for user)
    const updatedProducts = [...products.filter(x => x.id !== newProd.id), newProd];
    const updatedInventory = [...inventory.filter(x => x.id !== newInvItem.id), newInvItem];
    setProducts(updatedProducts);
    setInventory(updatedInventory);
    db.saveProducts(updatedProducts);
    db.saveInventory(updatedInventory);
    await offlineStorage.setItem("products", newProd);
    await offlineStorage.setItem("inventory", newInvItem);

    // 2. Enqueue in SyncQueue with dependency order: Product first, then Inventory
    try {
      const productOp = await syncService.enqueue("product", newProd.id, "CREATE", newProd);
      await syncService.enqueue("inventory", newInvItem.id, "CREATE", newInvItem, productOp.id);

      if (navigator.onLine) {
        addNotification(`Produit "${p.name}" enregistré. Synchronisation en cours vers le Cloud...`);
      } else {
        addNotification(`Produit "${p.name}" enregistré hors ligne. Il sera synchronisé dès le retour d'Internet.`);
      }
    } catch (err) {
      console.error("[Sync Queue Enqueue Error]:", err);
      addNotification(`Produit enregistré localement.`);
    }
  };

  const isRoleAllowed = (creatorRole: UserRole, targetRole: UserRole): boolean => {
    return true;
  };

  const handleCreateLightClient = async (identifier: string, notes?: string, role?: UserRole, isPartnerRegistration?: boolean) => {
    if (!currentUser) return;
    
    let clientRole = role;
    if (!clientRole && isPartnerRegistration) {
      clientRole = currentUser.role === UserRole.WHOLESALER ? UserRole.SEMI_WHOLESALER : UserRole.RETAILER;
    } else if (!clientRole) {
      clientRole = UserRole.CLIENT;
    }

    const trimmed = identifier.trim().toLowerCase();
    const cleanPhone = trimmed.replace(/[\s\-\+]/g, "");
    
    // Rechercher l'utilisateur dans la base globale/locale
    const allUsers = [...db.getUsers(), ...countryFilteredUsers];
    const existingUser = allUsers.find(u => 
      u && u.id && (
        u.id === identifier || 
        (u.email && u.email.toLowerCase() === trimmed) || 
        (u.phone && u.phone.toLowerCase().replace(/[\s\-\+]/g, "") === cleanPhone)
      )
    );

    // Si enregistrement d'un partenaire B2B
    if (isPartnerRegistration) {
      try {
        const result = await connectionService.envoyerDemandeConnexion(currentUser, existingUser || identifier, notes);
        if (result?.success) {
          addNotification(result.message || `Demande de partenariat envoyée avec succès à ${result.destinataireNom || identifier}.`);
          return;
        }
      } catch (err: any) {
        console.error("[App] Erreur lors de l'envoi de la demande de partenariat:", err);
        const errMsg = err?.message || "Échec de l'envoi de la demande de partenariat.";
        addNotification(errMsg);
        return;
      }
    }

    if (!isPartnerRegistration) {
      // Direct local creation (Client local / hors-ligne)
      const newLc: LightClient = {
        id: `lc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: currentUser.id,
        name: (existingUser ? existingUser.name : notes) || identifier,
        phone: existingUser?.phone || (identifier.includes("@") ? "" : identifier),
        email: existingUser?.email || (identifier.includes("@") ? identifier : ""),
        notes: `Abonné local [${clientRole}]`,
        linkedUserId: existingUser?.id,
        createdAt: new Date().toISOString()
      };
      const updated = [newLc, ...lightClients];
      syncLightClients(updated);
      addNotification(`Client local "${newLc.name}" créé avec succès.`);
      return undefined as any;
    }

    // Fallback partenaire local (si aucun compte utilisateur sur la plateforme)
    const newLc: LightClient = {
      id: `lc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ownerId: currentUser.id,
      name: notes || identifier,
      phone: identifier.includes("@") ? "" : identifier,
      email: identifier.includes("@") ? identifier : "",
      notes: notes || `Partenaire local [${clientRole}]`,
      linkedUserId: undefined,
      createdAt: new Date().toISOString()
    };
    const updated = [newLc, ...lightClients];
    syncLightClients(updated);
    addNotification(`Partenaire local "${newLc.name}" ajouté avec succès.`);
  };

  const onDeleteLightClient = (clientId: string) => {
    const targetLc = lightClients.find(lc => lc.id === clientId);
    const updated = lightClients.filter(lc => lc.id !== clientId);
    syncLightClients(updated);

    if (targetLc?.linkedUserId) {
      connectionService.deleteConnection(targetLc.linkedUserId, currentUser?.id, targetLc.linkedUserId);
    } else {
      connectionService.deleteConnection(clientId, currentUser?.id);
    }

    addNotification("Partenaire / client supprimé de votre carnet d'adresses.");
  };

  const handleUpdateCreditLimit = (id: string, isRealUser: boolean, limit: number) => {
    if (isRealUser) {
      const updated = users.map(u => {
        if (u.id === id) {
          return { ...u, creditLimit: limit };
        }
        return u;
      });
      setUsers(updated);
      db.saveUsers(updated);
    } else {
      const updated = lightClients.map(lc => {
        if (lc.id === id) {
          return { ...lc, creditLimit: limit };
        }
        return lc;
      });
      syncLightClients(updated);
    }
    addNotification(`Limite de crédit mise à jour avec succès.`);
  };

  const recordStockMovement = (productId: string, type: "IN" | "OUT" | "ADJUST", quantity: number, reason: string, orderId?: string) => {
    if (!currentUser) return;
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productId,
      ownerId: currentUser.id,
      type,
      quantity,
      reason,
      timestamp: new Date().toISOString(),
      isSynced: false
    };
    const updated = [newMovement, ...stockMovements];
    syncStockMovements(updated);
  };

  const handleUpdateInventory = async (
    itemId: string, 
    stock: number, 
    price: number, 
    prixGros?: number, 
    prixDetail?: number, 
    quantiteMinimum?: number,
    productId?: string,
    expirationDate?: string
  ) => {
    if (!currentUser) return;

    const existingById = inventory.find(i => i.id === itemId);
    const existingByProd = productId ? inventory.find(i => i.productId === productId && i.ownerId === currentUser.id) : undefined;
    const targetItem = existingById || existingByProd;

    if (targetItem) {
      let changedItem: InventoryItem | undefined;
      const updated = inventory.map(item => {
        if (item.id === targetItem.id) {
          if (stock === 0) {
            const prod = products.find((p) => p.id === item.productId);
            addNotification(` RUPTURE CRITIQUE : ${prod?.name} est épuisé !`);
          } else if (stock <= item.threshold) {
            const prod = products.find((p) => p.id === item.productId);
            addNotification(` Stock d'alerte franchi : ${prod?.name} (${stock} restants)`);
          }
          const delta = stock - item.stock;
          if (delta !== 0) {
            recordStockMovement(item.productId, delta > 0 ? "IN" : "OUT", Math.abs(delta), "Ajustement manuel");
          }
          changedItem = {
            ...item,
            stock,
            price: price !== undefined ? price : item.price,
            prixGros: prixGros !== undefined ? prixGros : item.prixGros,
            prixDetail: prixDetail !== undefined ? prixDetail : item.prixDetail,
            quantiteMinimum: quantiteMinimum !== undefined ? quantiteMinimum : item.quantiteMinimum,
            expirationDate: expirationDate !== undefined ? expirationDate : item.expirationDate
          };
          return changedItem;
        }
        return item;
      });
      if (changedItem) {
        setInventory(updated);
        db.saveInventory(updated);
        await offlineStorage.setItem("inventory", changedItem);
        await syncService.enqueue("inventory", changedItem.id, "UPDATE", changedItem);
        addNotification("Stock mis à jour et en cours de synchronisation.");
      }
    } else {
      const newItem: InventoryItem = {
        id: itemId || `i-${Date.now()}`,
        productId: productId || `p-${Date.now()}`,
        ownerId: currentUser.id,
        stock,
        threshold: Math.max(5, Math.round(stock * 0.15)),
        price: price || 1000,
        prixGros: prixGros,
        prixDetail: prixDetail,
        quantiteMinimum: quantiteMinimum || 1,
        expirationDate: expirationDate
      };
      const updated = [...inventory, newItem];
      setInventory(updated);
      db.saveInventory(updated);
      await offlineStorage.setItem("inventory", newItem);
      await syncService.enqueue("inventory", newItem.id, "CREATE", newItem);
      addNotification("Article ajouté et en cours de synchronisation.");
    }
  };

  const handleUpdateProductFull = async (
    productId: string,
    productData: Partial<Product>,
    inventoryItemId?: string,
    inventoryData?: Partial<InventoryItem>
  ) => {
    if (!currentUser) return;

    if (productData && Object.keys(productData).length > 0) {
      const updatedProducts = products.map((p) => {
        if (p.id === productId) {
          return { ...p, ...productData };
        }
        return p;
      });
      setProducts(updatedProducts);
      db.saveProducts(updatedProducts);
      const mergedProd = updatedProducts.find(p => p.id === productId);
      if (mergedProd) await offlineStorage.setItem("products", mergedProd);
      await syncService.enqueue("product", productId, "UPDATE", { id: productId, ...productData });
    }

    if (inventoryItemId && inventoryData) {
      const targetItem = inventory.find((i) => i.id === inventoryItemId);
      if (targetItem) {
        const oldStock = targetItem.stock;
        const newStock = inventoryData.stock !== undefined ? inventoryData.stock : oldStock;
        const delta = newStock - oldStock;
        if (delta !== 0) {
          recordStockMovement(
            targetItem.productId,
            delta > 0 ? "IN" : "OUT",
            Math.abs(delta),
            "Modification via page d'édition de stock"
          );
        }
        const updatedInventory = inventory.map((i) => {
          if (i.id === inventoryItemId) {
            return { ...i, ...inventoryData };
          }
          return i;
        });
        setInventory(updatedInventory);
        db.saveInventory(updatedInventory);
        const mergedInv = updatedInventory.find(i => i.id === inventoryItemId);
        if (mergedInv) await offlineStorage.setItem("inventory", mergedInv);
        await syncService.enqueue("inventory", inventoryItemId, "UPDATE", { ...targetItem, ...inventoryData });
      }
    }

    addNotification("Produit et stock mis à jour (synchronisation en cours).");
  };

  const handleDeleteInventoryItem = async (itemId: string, productId?: string, skipConfirm: boolean = false) => {
    const doDelete = async () => {
      const itemToDelete = inventory.find(i => i.id === itemId || i.productId === itemId || (productId && i.productId === productId));
      const targetItemId = itemToDelete ? itemToDelete.id : itemId;
      const targetProdId = productId || itemToDelete?.productId || itemId;

      if (targetItemId) {
        await syncService.enqueue("inventory", targetItemId, "DELETE", { id: targetItemId });
        await offlineStorage.removeItem("inventory", targetItemId);
      }
      if (targetProdId) {
        await syncService.enqueue("product", targetProdId, "DELETE", { id: targetProdId });
        await offlineStorage.removeItem("products", targetProdId);
      }

      const updatedInventory = inventory.filter((item) => item.id !== targetItemId && item.productId !== targetProdId);
      syncInventory(updatedInventory);

      const updatedProducts = products.filter((p) => p.id !== targetProdId);
      syncProducts(updatedProducts);

      addNotification("Produit retiré de votre stock avec succès.");
    };

    if (skipConfirm) {
      doDelete();
    } else {
      setConfirmDeleteAction({
        isOpen: true,
        title: "Retirer du stock",
        message: "Voulez-vous vraiment retirer ce produit de votre stock ?",
        onConfirm: doDelete
      });
    }
  };

  const handleClearMyCatalog = async () => {
    if (!currentUser) return;
    
    const doClear = async () => {
      const itemsToDelete = inventory.filter(i => 
        i.ownerId === currentUser.id || 
        i.ownerId === currentUser.email || 
        i.id.includes("bonk") || 
        i.id.includes("sayouba")
      );

      if (itemsToDelete.length === 0) {
        addNotification("Votre catalogue de stock est déjà vide.");
        return;
      }

      const remainingInventory = inventory.filter(i => 
        !(i.ownerId === currentUser.id || 
          i.ownerId === currentUser.email || 
          i.id.includes("bonk") || 
          i.id.includes("sayouba"))
      );
      syncInventory(remainingInventory);

      {
        addNotification("Suppression en cours du catalogue en ligne...");
        await Promise.allSettled(
          itemsToDelete.map(item => inventoryService.deleteInventoryItem(item.id))
        );
      }

      addNotification("Votre catalogue a été entièrement vidé. Vous pouvez maintenant le renseigner manuellement.");
    };

    setConfirmDeleteAction({
      isOpen: true,
      title: "Vider mon stock",
      message: "Voulez-vous vraiment effacer tous les articles fictifs et réels de votre catalogue stock pour recommencer manuellement ? Cette action est irréversible.",
      onConfirm: doClear
    });
  };

  // Order Placement logic (B2B Procurement)
  const handlePlaceB2BOrder = (receiverId: string, items: { productId: string; quantity: number }[]) => {
    if (!currentUser) return;

    // Resolve vendor/supplier object
    const userVendor = users.find((u) => u.id === receiverId);
    const lcVendor = lightClients.find((lc) => lc.id === receiverId || lc.linkedUserId === receiverId);

    const vendorObj = userVendor || (lcVendor ? {
      id: lcVendor.id,
      name: lcVendor.name,
      companyName: lcVendor.companyName || lcVendor.name,
      role: UserRole.WHOLESALER,
      region: "Local",
      phone: lcVendor.phone,
      email: lcVendor.email
    } as any : {
      id: receiverId,
      name: `Fournisseur ${receiverId}`,
      companyName: `Fournisseur Direct`,
      role: UserRole.WHOLESALER,
      region: "Local"
    } as any);

    // Estimate shipping metrics
    const shippingInfo = estimateShipping(
      currentUser.region || "Abidjan",
      vendorObj?.region || "Abidjan"
    );

    // Helper to resolve unit price for an item
    const getItemPrice = (productId: string) => {
      const invItem = inventory.find((i) => i.productId === productId && i.ownerId === receiverId);
      if (invItem && invItem.price) return invItem.price;
      if (invItem && invItem.prixGros) return invItem.prixGros;

      const prod = products.find((p) => p.id === productId);
      if (prod) {
        return prod.prixGros || prod.prixDetail || (prod as any).price || 1000;
      }

      const anyInv = inventory.find((i) => i.productId === productId);
      if (anyInv) return anyInv.price || anyInv.prixGros || 1000;

      return 1000;
    };

    const totalAmount = items.reduce((sum, item) => {
      const unitPrice = getItemPrice(item.productId);
      return sum + unitPrice * item.quantity;
    }, 0) + shippingInfo.fee;

    const newOrder: Order = {
      id: `cmd-b2b-${Math.floor(100 + Math.random() * 900)}`,
      orderType: 
        currentUser.role === UserRole.WHOLESALER 
          ? "B2B_M2W" 
          : currentUser.role === UserRole.SEMI_WHOLESALER 
            ? "B2B_W2SG" 
            : vendorObj?.role === UserRole.SEMI_WHOLESALER 
              ? "B2B_SG2R" 
              : "B2B_W2R",
      senderId: currentUser.id,
      receiverId,
      items: items.map((i) => {
        const unitPrice = getItemPrice(i.productId);
        return {
          productId: i.productId,
          quantity: i.quantity,
          priceAtOrder: unitPrice
        };
      }),
      totalAmount,
      amountPaid: 0,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shippingFee: shippingInfo.fee,
      distanceKm: shippingInfo.distance,
      estimatedTimeMins: shippingInfo.time,
      paymentMethod: "DEFERRED",
      paymentStatus: "PENDING",
      deliveryAddress: currentUser.address || "Dakar Medina"
    };

    orderService.createOrder(newOrder);
    syncOrders([newOrder, ...orders]);
    addNotification(`Nouvelle commande B2B passée auprès de ${vendorObj?.companyName || vendorObj?.name}`);
  };

  // Client B2C checkout
  const handlePlaceB2COrder = (
    receiverId: string,
    items: { productId: string; quantity: number }[],
    address: string,
    method: string
  ) => {
    if (!currentUser) return;

    const shopObj = users.find((u) => u.id === receiverId);
    const shippingInfo = estimateShipping(address, shopObj?.address || "Abidjan");

    const totalAmount = items.reduce((sum, item) => {
      const invItem = inventory.find((i) => i.productId === item.productId && i.ownerId === receiverId);
      const isSemiWholesaler = shopObj?.role === UserRole.SEMI_WHOLESALER;
      const unitPrice = isSemiWholesaler ? (invItem?.prixDetail ?? invItem?.price ?? 0) : (invItem?.price ?? 0);
      return sum + unitPrice * item.quantity;
    }, 0) + shippingInfo.fee;

    const otpCode = generateOTP();

    const newOrder: Order = {
      id: `cmd-b2c-${Math.floor(1000 + Math.random() * 9000)}`,
      orderType: shopObj?.role === UserRole.SEMI_WHOLESALER ? "B2C_SG2C" : "B2C_R2C",
      senderId: currentUser.id,
      receiverId,
      items: items.map((i) => {
        const invItem = inventory.find((inv) => inv.productId === i.productId && inv.ownerId === receiverId);
        const isSemiWholesaler = shopObj?.role === UserRole.SEMI_WHOLESALER;
        const unitPrice = isSemiWholesaler ? (invItem?.prixDetail ?? invItem?.price ?? 0) : (invItem?.price ?? 0);
        return {
          productId: i.productId,
          quantity: i.quantity,
          priceAtOrder: unitPrice
        };
      }),
      totalAmount,
      amountPaid: 0,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shippingFee: shippingInfo.fee,
      distanceKm: shippingInfo.distance,
      estimatedTimeMins: shippingInfo.time,
      paymentMethod: method as any,
      paymentStatus: "PENDING",
      deliveryAddress: address,
      otpCode
    };

    orderService.createOrder(newOrder);
    syncOrders([newOrder, ...orders]);
    addNotification(`Votre commande client ${newOrder.id} a été validée ! Suivi en cours.`);
  };

  // Helper to process stock transfer on order completion/delivery across all platform actors
  const processOrderStockUpdate = (order: Order) => {
    let newInventory = [...inventory];
    const changedItems: InventoryItem[] = [];

    order.items.forEach((item) => {
      // 1. Seller stock decrement
      const sellerInvIndex = newInventory.findIndex(
        (inv) => inv.ownerId === order.receiverId && inv.productId === item.productId
      );
      if (sellerInvIndex !== -1) {
        const sellerItem = newInventory[sellerInvIndex];
        const updatedSellerItem = {
          ...sellerItem,
          stock: Math.max(0, sellerItem.stock - item.quantity),
          updatedAt: new Date().toISOString()
        };
        newInventory[sellerInvIndex] = updatedSellerItem;
        changedItems.push(updatedSellerItem);
      } else {
        const prod = products.find((p) => p.id === item.productId);
        const newSellerItem: InventoryItem = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          ownerId: order.receiverId,
          productId: item.productId,
          stock: 0,
          threshold: prod?.lowStockThreshold || 5,
          price: prod?.prixDetail || prod?.prixGros || (prod as any)?.price || 1000,
          prixGros: prod?.prixGros,
          prixDetail: prod?.prixDetail,
          quantiteMinimum: 5,
          updatedAt: new Date().toISOString()
        };
        newInventory.push(newSellerItem);
        changedItems.push(newSellerItem);
      }

      // 2. Buyer stock increment (for B2B orders or if sender is a merchant)
      const buyerObj = users.find((u) => u.id === order.senderId);
      const isBuyerBusiness =
        order.orderType.startsWith("B2B") ||
        (buyerObj &&
          [
            UserRole.MANUFACTURER,
            UserRole.WHOLESALER,
            UserRole.SEMI_WHOLESALER,
            UserRole.RETAILER
          ].includes(buyerObj.role as UserRole));

      if (isBuyerBusiness) {
        const buyerInvIndex = newInventory.findIndex(
          (inv) => inv.ownerId === order.senderId && inv.productId === item.productId
        );
        if (buyerInvIndex !== -1) {
          const buyerItem = newInventory[buyerInvIndex];
          const updatedBuyerItem = {
            ...buyerItem,
            stock: buyerItem.stock + item.quantity,
            updatedAt: new Date().toISOString()
          };
          newInventory[buyerInvIndex] = updatedBuyerItem;
          changedItems.push(updatedBuyerItem);
        } else {
          // Add new product item to buyer's inventory
          const sellerItem = sellerInvIndex !== -1 ? newInventory[sellerInvIndex] : undefined;
          const prod = products.find((p) => p.id === item.productId);

          const newBuyerItem: InventoryItem = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            ownerId: order.senderId,
            productId: item.productId,
            stock: item.quantity,
            threshold: prod?.lowStockThreshold || 5,
            price: item.priceAtOrder || sellerItem?.price || prod?.prixDetail || 1000,
            prixGros: sellerItem?.prixGros || prod?.prixGros,
            prixDetail: sellerItem?.prixDetail || prod?.prixDetail,
            quantiteMinimum: 5,
            updatedAt: new Date().toISOString()
          };
          newInventory.push(newBuyerItem);
          changedItems.push(newBuyerItem);
        }
      }
    });

    
      changedItems.forEach((item) => inventoryService.updateInventoryItem(item));

    syncInventory(newInventory);
  };

  // Direct checkout sale POS (no delivery, updates stocks directly)
  const handlePlaceQuickB2CSale = (items: { productId: string; quantity: number }[]) => {
    if (!currentUser) return;

    // Deduct stock immediately
    const changedItems: InventoryItem[] = [];
    const updatedInv = inventory.map((invItem) => {
      const matched = items.find((i) => i.productId === invItem.productId && invItem.ownerId === currentUser.id);
      if (matched) {
        const changed = { ...invItem, stock: Math.max(0, invItem.stock - matched.quantity), updatedAt: new Date().toISOString() };
        changedItems.push(changed);
        recordStockMovement(invItem.productId, "OUT", matched.quantity, "Vente comptoir boutique");
        return changed;
      }
      return invItem;
    });

     changedItems.forEach(item => inventoryService.updateInventoryItem(item));
    syncInventory(updatedInv);
    addNotification("Vente comptoir boutique enregistrée. Stocks synchronisés.");
  };

  // Sale placement with tiered pricing and debt management
  const handlePlaceSale = (
    clientId: string | "CASH_CLIENT", 
    items: { productId: string; quantity: number }[],
    amountPaid: number,
    paymentMethod: Order["paymentMethod"] = "CASH"
  ) => {
    if (!currentUser) return;

    const saleId = `sale-${Date.now()}`;
    let totalAmount = 0;
    
    const saleItems = items.map(item => {
      const invItem = inventory.find(i => i.productId === item.productId && i.ownerId === currentUser.id);
      const product = products.find(p => p.id === item.productId);
      
      // Calculate tiered price
      const price = invItem 
        ? calculateApplicablePrice(invItem.priceTiers, item.quantity, invItem.price)
        : (product ? calculateApplicablePrice(product.priceTiers, item.quantity, product.prixDetail || 0) : 0);
        
      totalAmount += price * item.quantity;
      
      return {
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: price
      };
    });

    const paymentStatus: Order["paymentStatus"] = 
      amountPaid >= totalAmount ? "PAID" : (amountPaid > 0 ? "PARTIAL" : "PENDING");

    const newSale: Order = {
      id: saleId,
      orderType: currentUser.role === UserRole.RETAILER ? "B2C_R2C" : "B2B_W2R",
      senderId: currentUser.id,
      receiverId: clientId, // For sales, the receiver is the buyer
      items: saleItems,
      totalAmount,
      amountPaid,
      paymentStatus,
      status: OrderStatus.DELIVERED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shippingFee: 0,
      distanceKm: 0,
      estimatedTimeMins: 0,
      paymentMethod,
      deliveryAddress: "Vente sur place",
      clientId: clientId === "CASH_CLIENT" ? undefined : clientId
    };

    // 1. Save Sale
    orderService.createOrder(newSale);
    syncOrders([newSale, ...orders]);

    // 2. Decrement Stock & Record movements
    const changedItems: InventoryItem[] = [];
    const clientObj = users.find(u => u.id === clientId);
    const isClientMerchant = clientObj && [UserRole.WHOLESALER, UserRole.SEMI_WHOLESALER, UserRole.RETAILER].includes(clientObj.role);

    let updatedInv = inventory.map(item => {
      const saleItem = items.find(si => si.productId === item.productId && item.ownerId === currentUser.id);
      if (saleItem) {
        const newStock = Math.max(0, item.stock - saleItem.quantity);
        recordStockMovement(item.productId, "OUT", saleItem.quantity, "Vente", saleId);
        const changed = { ...item, stock: newStock, updatedAt: new Date().toISOString() };
        changedItems.push(changed);
        return changed;
      }
      return item;
    });

    if (isClientMerchant) {
      saleItems.forEach(saleItem => {
        const buyerInvIndex = updatedInv.findIndex(i => i.productId === saleItem.productId && i.ownerId === clientId);
        if (buyerInvIndex !== -1) {
          const changed = {
            ...updatedInv[buyerInvIndex],
            stock: updatedInv[buyerInvIndex].stock + saleItem.quantity,
            updatedAt: new Date().toISOString()
          };
          updatedInv[buyerInvIndex] = changed;
          changedItems.push(changed);
        } else {
          const newItem: InventoryItem = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            ownerId: clientId,
            productId: saleItem.productId,
            stock: saleItem.quantity,
            threshold: 5,
            price: saleItem.priceAtOrder || 1000,
            quantiteMinimum: 5,
            updatedAt: new Date().toISOString()
          };
          updatedInv.push(newItem);
          changedItems.push(newItem);
        }
      });
    }

     changedItems.forEach(item => inventoryService.updateInventoryItem(item));
    syncInventory(updatedInv);

    // 3. Record Payment if any
    if (amountPaid > 0 && clientId !== "CASH_CLIENT") {
      const newPayment: DebtPayment = {
        id: `pay-${Date.now()}`,
        clientId,
        amount: amountPaid,
        date: new Date().toISOString(),
        isSynced: false
      };
      syncPayments([newPayment, ...payments]);
    }

    // 4. Add to sync queue
    syncService.addToQueue("CREATE_ORDER", newSale);

    addNotification(`Vente enregistrée : ${formatCFA(totalAmount)}`);
  };

  const handleAddPayment = (clientId: string, amount: number, orderId?: string, method?: string) => {
    if (!currentUser) return;
    const newPayment: DebtPayment = {
      id: `pay-${Date.now()}`,
      clientId,
      amount,
      date: new Date().toISOString(),
      orderId,
      method,
      isSynced: false
    };
    syncPayments([newPayment, ...payments]);

    // Update order amountPaid and paymentStatus if orderId is provided
    if (orderId) {
      const updatedOrders = orders.map((o) => {
        if (o.id === orderId) {
          const newAmountPaid = (o.amountPaid || 0) + amount;
          const newPaymentStatus = newAmountPaid >= o.totalAmount ? "PAID" : "PARTIAL";
          return {
            ...o,
            amountPaid: newAmountPaid,
            paymentStatus: newPaymentStatus as any,
            updatedAt: new Date().toISOString()
          };
        }
        return o;
      });
      syncOrders(updatedOrders);
    }

    // Trigger local push notification for seller
    pushNotificationService.notifyPaymentReceived(currentUser.id, amount, `Client ID: ${clientId}`, orderId || "DIRECT");

    const orderRefText = orderId ? ` pour la facture #${orderId.split('-').pop()?.toUpperCase()}` : "";
    addNotification(`Règlement de ${formatCFA(amount)} enregistré avec succès${orderRefText}.`);
    
    syncService.addToQueue("ADD_PAYMENT", newPayment);
  };

  // Order status flow & drivers assignations
  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => {
    let changedOrder: Order | undefined;
    let oldOrder: Order | undefined;

    const updated = orders.map((o) => {
      if (o.id === orderId) {
        oldOrder = o;
        const payload: Partial<Order> = { status, updatedAt: new Date().toISOString() };
        if (driverId) {
          payload.driverId = driverId;
          const driverObj = users.find((u) => u.id === driverId);
          addNotification(`Livreur ${driverObj?.name} affecté à la commande ${orderId}`);
        }
        if (claimMessage) {
          payload.claimMessage = claimMessage;
          payload.claimStatus = claimStatus || "OPEN";
          addNotification(`Réclamation ajoutée à la commande ${orderId}`);
        }
        addNotification(`Commande ${orderId} passée au statut : ${status}`);
        changedOrder = { ...o, ...payload };
        return changedOrder;
      }
      return o;
    });
    
    if (changedOrder) {
      if (status === OrderStatus.DELIVERED && oldOrder && oldOrder.status !== OrderStatus.DELIVERED) {
        processOrderStockUpdate(changedOrder);
      }
      {
        orderService.updateOrder(changedOrder.id, changedOrder);
      }
    }
    syncOrders(updated);
  };

  const handlePayOrder = (orderId: string) => {
    let success = false;
    const updatedOrders = orders.map((o) => {
      if (o.id === orderId) {
        const payer = users.find((u) => u.id === o.senderId);
        const payee = users.find((u) => u.id === o.receiverId);
        
        if (payer) {
          const payerBalance = payer.balance || 0;
          if (payerBalance < o.totalAmount) {
            alert(`Solde insuffisant pour effectuer ce paiement. (Votre Solde: ${formatCFA(payerBalance)}, Commande: ${formatCFA(o.totalAmount)})`);
            return o;
          }
          
          // Deduct from payer and add to payee
          const updatedUsers = users.map((u) => {
            if (u.id === o.senderId) {
              return { ...u, balance: Math.max(0, payerBalance - o.totalAmount) };
            }
            if (u.id === o.receiverId) {
              return { ...u, balance: (u.balance || 0) + o.totalAmount };
            }
            return u;
          });
          syncUsers(updatedUsers);
          
          // If payer is currently logged in, update current user state too
          if (currentUser && currentUser.id === o.senderId) {
            setCurrentUser((prev) => prev ? { ...prev, balance: Math.max(0, (prev.balance || 0) - o.totalAmount) } : null);
          }
          // If payee is currently logged in, update current user state too
          if (currentUser && currentUser.id === o.receiverId) {
            setCurrentUser((prev) => prev ? { ...prev, balance: (prev.balance || 0) + o.totalAmount } : null);
          }
        }

        addNotification(`Paiement effectué de ${formatCFA(o.totalAmount)} pour la commande B2B ${orderId}`);
        pushNotificationService.notifyPaymentReceived(
          o.receiverId,
          o.totalAmount,
          payer?.name || "Partenaire Client",
          orderId
        );
        success = true;
        return { ...o, paymentStatus: "PAID" as const, updatedAt: new Date().toISOString() };
      }
      return o;
    });
    
    if (success) {
      const changedOrder = updatedOrders.find(o => o.id === orderId);
      if (changedOrder) {
        orderService.updateOrder(changedOrder.id, changedOrder);
      }
      syncOrders(updatedOrders);
      alert("Paiement par solde effectué avec succès !");
    }
  };

  const handleCompleteDelivery = (orderId: string, otpInput?: string, sig?: string, img?: string) => {
    let orderToDeliver: Order | undefined;
    let oldOrder: Order | undefined;

    const updated = orders.map((o) => {
      if (o.id === orderId) {
        oldOrder = o;
        orderToDeliver = {
          ...o,
          status: OrderStatus.DELIVERED,
          paymentStatus: "PAID" as const,
          updatedAt: new Date().toISOString(),
          signatureImage: sig,
          deliveryPhoto: img
        };
        return orderToDeliver;
      }
      return o;
    });

    if (orderToDeliver) {
      if (oldOrder && oldOrder.status !== OrderStatus.DELIVERED) {
        processOrderStockUpdate(orderToDeliver);
      }
      
      {
        orderService.updateOrder(orderToDeliver.id, orderToDeliver);
      }
      syncOrders(updated);
      addNotification(`Acheminement finalisé pour ${orderId}. Les stocks ont été transférés.`);
    }
  };

  const handlePostReview = (orderId: string, rating: number, comment: string) => {
    // Mock review logged
    addNotification(`Nouvel avis client enregistré pour ${orderId}`);
  };

  // Direct chat send messaging with grossiste_id, client_id mapping & diagnostic relationship check
  const handleSendMessage = async (arg1: string, arg2: string) => {
    if (!currentUser) {
      console.warn("[App.handleSendMessage] Transmission aborted: currentUser is null");
      return;
    }

    // Support both parameter order signatures: (text, receiverId) or (receiverId, text)
    let receiverId = arg2;
    let text = arg1;

    const allUsers = db.getUsers();
    if (allUsers.some(u => u.id === arg1) || arg1.startsWith("usr-") || arg1.startsWith("wholesaler") || arg1.startsWith("client") || arg1.includes("_")) {
      receiverId = arg1;
      text = arg2;
    }

    console.log("=================================================================");
    console.log("[App.handleSendMessage] >>> MESSAGE TRANSMISSION ATTEMPT INITIATED");
    console.log("[App.handleSendMessage] Active Session User (Sender):", {
      id: currentUser.id,
      name: currentUser.name,
      companyName: currentUser.companyName,
      role: currentUser.role
    });
    console.log("[App.handleSendMessage] Target Receiver ID:", receiverId);
    console.log("[App.handleSendMessage] Message Content:", text);

    const receiverUser = allUsers.find(u => u.id === receiverId);
    console.log("[App.handleSendMessage] Target Receiver Profile:", receiverUser ? {
      id: receiverUser.id,
      name: receiverUser.name,
      companyName: receiverUser.companyName,
      role: receiverUser.role
    } : "User profile not cached locally (proceeding with ID)");

    // Determine grossiste_id and client_id B2B mapping
    const grossisteId = (currentUser.role === UserRole.WHOLESALER || currentUser.role === UserRole.MANUFACTURER)
      ? currentUser.id
      : (receiverUser?.role === UserRole.WHOLESALER || receiverUser?.role === UserRole.MANUFACTURER ? receiverId : currentUser.id);

    const clientId = grossisteId === currentUser.id ? receiverId : currentUser.id;

    console.log(`[App.handleSendMessage] Session B2B Mappings -> grossiste_id: ${grossisteId}, client_id: ${clientId}`);

    // Perform diagnostic relationship status check
    const diag = await connectionService.validateRelationshipActive(currentUser.id, receiverId);
    console.log("[App.handleSendMessage] Diagnostic Relationship Check Result:", diag);

    if (!diag.isActive) {
      console.warn(`[App.handleSendMessage] WARNING: Relationship between ${currentUser.id} and ${receiverId} status is '${diag.statut}'. Details: ${diag.details}`);
    }

    const conversationId = [grossisteId, clientId].sort().join("_");
    console.log(`[App.handleSendMessage] Target Conversation ID: ${conversationId}`);

    try {
      const msgId = await chatService.sendMessage(
        conversationId,
        currentUser.id,
        MessageType.TEXT,
        text,
        {},
        [currentUser.id, receiverId]
      );
      console.log(`[App.handleSendMessage] SUCCESS: Message transmitted via chatService with ID: ${msgId}`);
      setMessages(db.getMessages());
    } catch (err) {
      console.error("[App.handleSendMessage] ERROR transmitting message:", err);
    }
    console.log("[App.handleSendMessage] <<< MESSAGE TRANSMISSION ATTEMPT COMPLETED");
    console.log("=================================================================");
  };

  // Handle barcode scanned success
  const handleScanSuccess = (product: Product, code: string) => {
    alert(`Scan réussi ! Code détecté: ${code}. Produit: ${product.name}`);
    setShowScanner(false);
    
    // If current user is Manufacturer/Wholesaler/Retailer, show inventory adjustment modal immediately
    if (currentUser && [UserRole.MANUFACTURER, UserRole.WHOLESALER, UserRole.RETAILER].includes(currentUser.role)) {
      const invItem = inventory.find((i) => i.productId === product.id && i.ownerId === currentUser.id);
      if (invItem) {
        const qty = prompt(`Ajuster le stock pour ${product.name} (Actuel: ${invItem.stock}) :`, invItem.stock.toString());
        if (qty !== null) {
          handleUpdateInventory(invItem.id, parseInt(qty), invItem.price);
        }
      } else {
        // Create inventory item
        const pr = prompt(`Ce produit n'est pas dans votre catalogue. Saisir votre prix de vente :`, "1000");
        if (pr) {
          const freshInv: InventoryItem = {
            id: `i-${Date.now()}`,
            productId: product.id,
            ownerId: currentUser.id,
            stock: 50,
            threshold: 10,
            price: parseFloat(pr)
          };
          syncInventory([...inventory, freshInv]);
          addNotification(`Produit injecté à votre stock avec succès.`);
        }
      }
    }
  };

  // Timeout fallback for initial loading (5 seconds)
  useEffect(() => {
    if (authLoading) {
      const timer = setTimeout(() => {
        setInitialLoadingTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  // Filter data - filter out demo mock data when Firebase active session is detected
  const displayUsers = useMemo(() => deduplicateUsers(isRealUserAuthenticated
    ? users.filter(u => {
        if (!currentUser) return false;
        if (u.id === currentUser.id) return true;
        if (currentUser.role === UserRole.ADMIN) return true;

        // Check if there is an order relationship (historique commercial valide)
        const hasOrder = orders.some(o => 
          (o.senderId === currentUser.id && o.receiverId === u.id) ||
          (o.senderId === u.id && o.receiverId === currentUser.id)
        );

        const isLightClient = lightClients.some(lc => 
          lc.ownerId === currentUser.id && lc.linkedUserId === u.id
        );

        const isConnected = connections.some(c => 
          isConnectionActive(c) && ((c.senderId === currentUser.id && c.receiverId === u.id) || (c.senderId === u.id && c.receiverId === currentUser.id))
        );

        // Only display if active partnership, valid order history, or linked in address book
        return hasOrder || isConnected || isLightClient;
      })
    : users) as UserProfile[], [isRealUserAuthenticated, users, currentUser, orders, lightClients, connections]);

  const displayProducts = useMemo(() => {
    let prods = deduplicate(isRealUserAuthenticated
      ? products.filter(p => {
          if (!currentUser) return false;
          if (currentUser.role === UserRole.ADMIN) return true;
          const isMine = p.creatorId === currentUser.id || inventory.some(i => i.productId === p.id && i.ownerId === currentUser.id);
          if (isMine) return true;
          
          const activeConnections = connections.filter(isConnectionActive);
          
          const isPartnerInventory = inventory.some(i => i.productId === p.id && (
            lightClients.some(lc => lc.ownerId === currentUser.id && lc.linkedUserId === i.ownerId) ||
            activeConnections.some(c => (c.senderId === currentUser.id && c.receiverId === i.ownerId) || (c.receiverId === currentUser.id && c.senderId === i.ownerId))
          ));

          const isWholesalerProd = inventory.some(i => i.productId === p.id && users.some(u => u.id === i.ownerId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER))) ||
            users.some(u => u.id === p.creatorId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER));
            
          return isPartnerInventory || isWholesalerProd;
        })
      : products) as (Product & { priorityScore?: number })[];

    if (!currentUser) return prods as Product[];

    const activeConnections = connections.filter(isConnectionActive);

    const scoredProds = prods.map(p => {
      let score = 0;
      const isMine = p.creatorId === currentUser.id || inventory.some(i => i.productId === p.id && i.ownerId === currentUser.id);
      if (isMine) score += 300;

      const isFromPartner = inventory.some(i => i.productId === p.id && activeConnections.some(c => 
        (c.senderId === currentUser.id && c.receiverId === i.ownerId) || 
        (c.receiverId === currentUser.id && c.senderId === i.ownerId)
      ));
      if (isFromPartner) score += 200;

      const hasWholesaleStock = inventory.some(i => i.productId === p.id && i.stock > 0 && users.some(u => u.id === i.ownerId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER)));
      if (hasWholesaleStock) score += 100;

      return { ...p, priorityScore: score };
    });

    return scoredProds.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }, [isRealUserAuthenticated, products, currentUser, inventory, lightClients, users, connections]);

  const displayInventory = useMemo(() => {
    return deduplicate(isRealUserAuthenticated
      ? inventory.filter(i => {
          if (!currentUser) return false;
          if (i.ownerId === currentUser.id) return true;
          
          const activeConnections = connections.filter(isConnectionActive);

          // Include inventory from partners linked in lightClients or active connections
          const isLightClientPartner = lightClients.some(lc => 
            lc.ownerId === currentUser.id && lc.linkedUserId === i.ownerId
          ) || activeConnections.some(c => (c.senderId === currentUser.id && c.receiverId === i.ownerId) || (c.receiverId === currentUser.id && c.senderId === i.ownerId));

          // Include inventory from Wholesalers/Semi-Wholesalers for Retailer replenishment
          const isWholesalerOwner = users.some(u => u.id === i.ownerId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER));
          
          const isVisible = isLightClientPartner || isWholesalerOwner;
          if (isVisible) {
            console.log(`[displayInventory Debug] Inventory for product ${i.productId} (owner ${i.ownerId}) is visible. isLightClientPartner: ${isLightClientPartner}, activeConnectionsCount: ${activeConnections.length}`);
          }
          return isVisible;
        })
      : inventory) as InventoryItem[];
  }, [isRealUserAuthenticated, inventory, currentUser, lightClients, users, connections]);

  const displayOrders = useMemo(() => deduplicate(isRealUserAuthenticated
    ? orders.filter(o => o.senderId === currentUser?.id || o.receiverId === currentUser?.id)
    : orders) as Order[], [isRealUserAuthenticated, orders, currentUser?.id]);

  // List of available countries extracted from user profiles + standard West African countries
  const availableCountries = useMemo(() => {
    const defaultSet = ["Burkina Faso", "Sénégal", "Côte d'Ivoire", "Mali", "Guinée", "Togo", "Bénin", "Niger"];
    const userCountries = users
      .map(u => u.country || (u as any).pays)
      .filter(Boolean) as string[];
    return Array.from(new Set([...defaultSet, ...userCountries])).sort();
  }, [users]);

  // Apply geographical country filter to users (clients, partners, suppliers)
  const countryFilteredUsers = useMemo(() => {
    const rawList = (!selectedCountryFilter || selectedCountryFilter === "ALL") 
      ? users 
      : users.filter(u => {
          if (u.id === currentUser?.id || u.role === UserRole.ADMIN) return true;
          const userCountry = u.country || (u as any).pays || "";
          return userCountry.toLowerCase().trim() === selectedCountryFilter.toLowerCase().trim();
        });
    return deduplicateUsers(rawList);
  }, [users, selectedCountryFilter, currentUser?.id]);

  // Apply geographical country filter to light clients
  const countryFilteredLightClients = useMemo(() => {
    if (!selectedCountryFilter || selectedCountryFilter === "ALL") return lightClients;
    return lightClients.filter(lc => {
      if (lc.linkedUserId) {
        const linked = users.find(u => u.id === lc.linkedUserId);
        if (linked) {
          const c = linked.country || (linked as any).pays || "";
          return c.toLowerCase().trim() === selectedCountryFilter.toLowerCase().trim();
        }
      }
      const owner = users.find(u => u.id === lc.ownerId);
      if (owner) {
        const c = owner.country || (owner as any).pays || "";
        return c.toLowerCase().trim() === selectedCountryFilter.toLowerCase().trim();
      }
      return true;
    });
  }, [lightClients, users, selectedCountryFilter]);

  if (authLoading && !initialLoadingTimeout) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">Initialisation de la session sécurisée...</p>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // Portail d'entrée : landing page affichée avant tout autre écran pour
  // rediriger chaque acteur vers son espace dédié. Toute sélection de rôle
  // ou action "Se connecter" mène systématiquement à l'écran d'authentification.
  // ----------------------------------------------------------------------
  const handleLandingSelectRole = () => setEnteredApp(true);
  const handleOpenAuthFromLanding = () => setEnteredApp(true);

  if (!enteredApp) {
    return (
      <LandingPage
        onSelectRole={handleLandingSelectRole}
        onOpenAuth={handleOpenAuthFromLanding}
      />
    );
  }

  // Ecran d'authentification dédié (plein écran, sans header/sidebar) — tous environnements confondus
  if (!currentUser) {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div className="w-8 h-8 border-[3px] border-emerald-200 dark:border-emerald-900 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Restauration de votre session...</p>
          </div>
        </div>
      );
    }
    return (
      <AuthScreen onAuthenticated={() => {}} />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col transition duration-300">
      {/* Global Configuration Errors */}
      {firebaseConfigError && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-[11px] font-bold flex items-center justify-center gap-2 shadow-lg z-50 text-center leading-normal">
          <AlertCircle className="w-4 h-4 shrink-0 animate-pulse text-rose-100" />
          <span>
            Attention: Firebase n'est pas configuré correctement. L'envoi et la synchronisation de vos médias (produits, factures, chat) seront impossibles. <span className="underline opacity-90">Détail : {firebaseConfigError}</span>
          </span>
        </div>
      )}

      {/* Global Firestore Permission Error Banner */}
      {firestorePermissionError && (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-[11px] font-bold flex items-center justify-between gap-2 shadow-lg z-50 leading-normal">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 animate-pulse text-amber-100" />
            <span>
              <strong>Accès Firestore refusé :</strong> {firestorePermissionError.message}
              {firestorePermissionError.path && (
                <span className="opacity-90 ml-1">(Collection / Document : <code>{firestorePermissionError.path}</code>)</span>
              )}
            </span>
          </div>
          <button 
            onClick={() => setFirestorePermissionError(null)} 
            className="px-2 py-0.5 bg-black/20 hover:bg-black/30 rounded text-[10px] text-white shrink-0 ml-2"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Premium Header App Bar */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-40 transition-colors relative">
        {/* Real-time Sync Progress Bar */}
        {(syncStatus.isSyncing || syncStatus.pendingCount > 0) && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden pointer-events-none z-50">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ 
                width: syncStatus.isSyncing 
                  ? `${Math.max(syncStatus.progress, 15)}%` 
                  : '30%' 
              }}
              transition={{ duration: 0.3 }}
              className={`h-full ${
                syncStatus.isSyncing 
                  ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-indigo-500 animate-pulse' 
                  : 'bg-amber-400'
              }`}
            />
          </div>
        )}

        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Groupe gauche (logo cliquable + indicateur de synchro) */}
          <div className="flex items-center gap-3">
          {/* Logo Brand — clic pour revenir au landing page */}
          <button
            type="button"
            onClick={() => setEnteredApp(false)}
            title="Retour à l'accueil WakatMarket"
            className="flex items-center gap-3 text-left transition cursor-pointer hover:opacity-80"
          >
            <div className="w-11 h-11 bg-white dark:bg-zinc-800 rounded-xl p-0.5 border border-emerald-500/30 shadow-md shadow-emerald-500/10 flex items-center justify-center overflow-hidden">
              <img
                src={wakatLogo}
                alt="WakatMarket Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white flex items-center gap-1.5">
                WakatMarket
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded-full uppercase border border-emerald-300 dark:border-emerald-800">
                  B2B + B2C
                </span>
              </h1>
              <p className="text-[9.5px] text-zinc-500 font-medium">Distribution & Logistique Intelligente d'Afrique</p>
            </div>
          </button>

            {/* Real-time Sync Successful Indicator */}
            <div className="hidden md:flex flex-col items-start gap-0.5 border-l border-zinc-100 dark:border-zinc-800 pl-3">
              <span className="text-[8px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500">Données</span>
              <div 
                className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/50 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                title="Toutes les données locales sont synchronisées et sécurisées hors-ligne. Cliquez pour forcer la synchronisation."
                onClick={() => syncService.triggerSync()}
              >
                <Cloud className={`w-3 h-3 text-emerald-500 ${syncStatus.isSyncing ? "animate-bounce" : ""}`} />
                <span>Synchro: {lastSuccessfulSync}</span>
              </div>
            </div>
          </div>

          {/* Clean Primary Navigation & Tool Triggers */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Mobile Navigation Hamburger Trigger (Mobile screen replacement for horizontal bar) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition md:hidden cursor-pointer flex items-center gap-1.5"
              title="Ouvrir le menu de navigation mobile"
              id="mobile-hamburger-btn"
            >
              <Menu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold hidden sm:inline">Menu</span>
            </button>

            {/* User-tool navigation now lives in the sidebar (Support, Paiements, Pitch Deck, Comparateur, Messagerie) */}

            {/* Notifications Alert Bell */}
            <div className="relative flex items-center gap-1.5">
              {currentUser && (
                <NotificationBell
                  currentUserId={currentUser.id}
                  onSelectNotification={(notif) => {
                    if (notif.type === "preuve_paiement_a_valider") {
                      setShowPaiementsAValider(true);
                    } else if (notif.type === "paiement_rejete") {
                      addNotification(`Attention : ${notif.contenu}`);
                    } else if (notif.type === "paiement_valide") {
                      addNotification(`Succès : ${notif.contenu}`);
                    }
                  }}
                />
              )}
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-600 dark:text-zinc-300 relative cursor-pointer"
                id="notifications-bell-btn"
                title="Notifications Système"
              >
                <Bell className="w-4.5 h-4.5" />
                {realNotifications.some((n) => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>
              
              {/* Push Notifications Drawer */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden py-2 z-50 animate-[fadeIn_0.2s_ease]">
                  <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white">Notifications</span>
                    <button
                      onClick={() => {
                        realNotifications.forEach(n => {
                          if (!n.read) connectionService.markNotificationAsRead(n.id);
                        });
                      }}
                      className="text-[9px] text-emerald-600 hover:underline font-semibold cursor-pointer"
                    >
                      Tout marquer comme lu
                    </button>
                  </div>

                  {/* Web Push Toggle Button */}
                  <button
                    onClick={() => pushNotificationService.requestPermission()}
                    className="w-full text-left px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 border-b border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1"><Bell className="w-3 h-3" /> Alertes Push Vendeurs (Stock & Paiement)</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      pushNotificationService.getPermissionStatus() === "granted"
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}>
                      {pushNotificationService.getPermissionStatus() === "granted" ? "Activées" : "Activer"}
                    </span>
                  </button>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-60 overflow-y-auto">
                    {realNotifications.length === 0 ? (
                      <div className="p-4 text-center text-[10px] text-zinc-400">Aucune notification</div>
                    ) : (
                      realNotifications.map((n, idx) => {
                        const relId = n.relationId || (n as any).relatedId || (n.metadata as any)?.related_id || (n.metadata as any)?.relation_id || (n.metadata as any)?.relationId;
                        const isConnNotif = (n.type === "CONNECTION_REQUEST" || n.type === "demande_connexion" || n.type === "demande_partenariat") || Boolean(relId) || n.message?.toLowerCase().includes("partenariat");
                        const relatedConn = relId 
                          ? db.getConnections().find(c => c.id === relId)
                          : null;

                        const currentStatus = (relatedConn?.status || "").toLowerCase();
                        const isPending = !relatedConn || currentStatus === "en_attente" || currentStatus === "pending";
                        const isAlreadyActive = relatedConn && (currentStatus === "active" || currentStatus === "actif" || (relatedConn as any).statut === "ACTIF");
                        const isAlreadyRejected = relatedConn && (currentStatus === "refusée" || currentStatus === "refusee" || (relatedConn as any).statut === "BLOCKED");

                        const senderId = n.senderId || (n as any).expediteurId || (n.metadata as any)?.sender_id;
                        const isReceiver = senderId ? (senderId !== currentUser.id) : (relatedConn ? relatedConn.receiverId === currentUser.id : true);

                        return (
                          <div key={`${n.id}_${idx}`} className="p-3 text-[10px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <p className={n.read ? "text-zinc-400" : "font-semibold text-zinc-900 dark:text-zinc-200"}>
                                  {n.message}
                                </p>
                                <span className="text-[8px] text-zinc-400 font-mono mt-0.5 block">{new Date(n.createdAt).toLocaleString()}</span>
                              </div>
                              {!n.read && (
                                <button 
                                  onClick={() => connectionService.markNotificationAsRead(currentUser.id, n.id)}
                                  className="text-[8px] text-emerald-600 hover:underline shrink-0"
                                >
                                  Marquer lu
                                </button>
                              )}
                            </div>

                            {isConnNotif && (
                              <div className="mt-2">
                                {isAlreadyActive && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-100">
                                    <UserCheck className="w-3 h-3" />
                                    <span>Partenariat actif & confirmé</span>
                                  </div>
                                )}

                                {isAlreadyRejected && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg border border-rose-100">
                                    <UserX className="w-3 h-3" />
                                    <span>Demande de partenariat refusée</span>
                                  </div>
                                )}

                                {isPending && !isAlreadyActive && !isAlreadyRejected && (
                                  <>
                                    {isReceiver ? (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (relId) {
                                              await connectionService.acceptConnection(relId, currentUser.id);
                                            } else if (relatedConn) {
                                              await connectionService.respondToConnectionRequest(relatedConn, "active");
                                            }
                                            await connectionService.markNotificationAsRead(currentUser.id, n.id);
                                            addNotification("Partenariat accepté avec succès !");
                                          }}
                                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                                        >
                                          <UserCheck className="w-3 h-3" /> Accepter le partenariat
                                        </button>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (relId) {
                                              await connectionService.rejectConnection(relId, currentUser.id);
                                            } else if (relatedConn) {
                                              await connectionService.respondToConnectionRequest(relatedConn, "refusée");
                                            }
                                            await connectionService.markNotificationAsRead(currentUser.id, n.id);
                                            addNotification("Demande de partenariat refusée.");
                                          }}
                                          className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                                        >
                                          <UserX className="w-3 h-3" /> Refuser
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="text-[9px] font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 rounded-lg px-2 py-1">
                                        Demande de partenariat en attente de validation
                                      </div>
                                    )}
                                  </>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    connectionService.markNotificationAsRead(n.id);
                                    setShowNotifications(false);
                                    setShowChat(true);
                                  }}
                                  className="mt-2 w-full px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" /> Discuter
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Compact Header User Profile Pill & Quick Role Selector */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/40 shrink-0"
                />
                <div className="hidden sm:block text-left leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[120px]">
                      {currentUser.companyName || currentUser.name}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-zinc-500 dark:text-zinc-400 font-mono">
                    Solde : <strong className="text-emerald-600 dark:text-emerald-400">{formatCFA(currentUser.balance ?? 0)}</strong>
                  </p>
                </div>
                
                {/* Role Badge (Static - Profile switching dropdown removed for security) */}
                <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                  {currentUser.role}
                </span>

                <div className="flex items-center gap-0.5 border-l border-zinc-200 dark:border-zinc-700 pl-1.5">
                  <button
                    onClick={handleOpenProfileEdit}
                    className="p-1 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-md transition cursor-pointer"
                    title="Modifier le profil"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleClearMyCatalog}
                    className="p-1 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-md transition cursor-pointer"
                    title="Vider mon stock"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={() => {
                if (autoSystemTheme) setAutoSystemTheme(false);
                setDarkMode(!darkMode);
              }}
              className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-600 dark:text-zinc-300 cursor-pointer"
              id="theme-toggle-btn"
              title="Basculer Mode Clair / Sombre"
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Déconnexion : ferme la session et ramène au landing page */}
            <button
              onClick={async () => {
                try {
                  if (isRealUserAuthenticated) await logout();
                } catch (err) {
                  console.error("Erreur lors de la déconnexion:", err);
                }
                setCurrentUser(null);
                localStorage.removeItem("wakat_active_user_id");
                setEnteredApp(false);
                addNotification("Session fermée avec succès. À bientôt !");
              }}
              className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-900/50"
              id="auth-toggle-btn"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer Panel */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Drawer Content */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-80 max-w-[85vw] bg-white dark:bg-zinc-900 shadow-2xl h-full flex flex-col z-50 overflow-y-auto"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
                <div className="flex items-center gap-2.5">
                  <img src={wakatLogo} alt="WakatMarket" className="w-8 h-8 rounded-lg object-cover" />
                  <div>
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">WakatMarket</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Menu Navigation Mobile</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 flex-1">
                {currentUser && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Rôle Actif</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">{currentUser.role}</span>
                    </div>
                    <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{currentUser.name || currentUser.companyName}</p>
                    <p className="text-[10px] text-zinc-500">{currentUser.email || currentUser.phone}</p>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1 mb-2">
                    Menu & Outils ERP
                  </p>

                  <button
                    onClick={() => { setShowSupportModal(true); setIsMobileDrawerOpen(false); }}
                    className="w-full px-3 py-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-emerald-600" />
                    <span>Support Client & Guide IA</span>
                  </button>

                  {currentUser && currentUser.role !== "Admin" && currentUser.role !== "Client Final" && currentUser.role !== "Chauffeur / Livreur" && (
                    <button
                      onClick={() => { setShowPaiementsAValider(!showPaiementsAValider); setIsMobileDrawerOpen(false); }}
                      className="w-full px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 hover:bg-amber-100 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-amber-600" />
                      <span>Validation Paiements Mobile Money</span>
                    </button>
                  )}

                  {currentUser && (
                    <button
                      onClick={() => { setShowComparator(!showComparator); setIsMobileDrawerOpen(false); }}
                      className="w-full px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Scale className="w-4 h-4 text-emerald-600" />
                      <span>Comparateur B2B Multi-Fournisseurs</span>
                    </button>
                  )}

                  {currentUser && (
                    <button
                      onClick={() => { setShowChat(!showChat); setIsMobileDrawerOpen(false); }}
                      className="w-full px-3 py-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span>Messagerie Directe B2B</span>
                    </button>
                  )}

                  <button
                    onClick={() => { setShowScanner(!showScanner); setIsMobileDrawerOpen(false); }}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Scan className="w-4 h-4 text-emerald-600" />
                    <span>Scanner Code-barres</span>
                  </button>

                  <button
                    onClick={() => { setShowAICopilot(!showAICopilot); setIsMobileDrawerOpen(false); }}
                    className="w-full px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Assistant Copilote IA</span>
                  </button>

                  <button
                    onClick={() => { setShowReports(!showReports); setIsMobileDrawerOpen(false); }}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <BarChart2 className="w-4 h-4 text-emerald-600" />
                    <span>Rapports & Analytics</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Mode Hors-Ligne Actif</h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Vous n'êtes pas connecté à internet. Vous pouvez continuer à utiliser l'application. Vos modifications seront automatiquement synchronisées lorsque la connexion sera rétablie.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main ERP Canvas Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">
        
            {/* Centralized Quick Actions Bar (Support, PWA Install, Sync, AI, Scanner, Reports) */}
            <QuickActionsBar
              syncStatus={syncStatus}
              onTriggerSync={() => {
                addNotification("Synchronisation des données en cours...");
                syncService.triggerSync();
              }}
              onOpenSyncSystemModal={() => setShowDiagnostic(true)}
              isPWAInstalled={isPWAInstalled}
              onTriggerPWAInstall={triggerPWAInstall}
              showScanner={showScanner}
              onToggleScanner={() => setShowScanner(!showScanner)}
              showAICopilot={showAICopilot}
              onToggleAICopilot={() => setShowAICopilot(!showAICopilot)}
              showReports={showReports}
              onToggleReports={() => setShowReports(!showReports)}
              onOpenSupport={() => setShowSupportModal(true)}
              userRole={currentUser?.role}
            />

            {/* Dynamic Modals / Expandable Utility Drawers (Scan, AI, Chat, Reports) */}
            <AnimatePresence>
              {showScanner && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative z-30"
                >
                  <BarcodeScanner products={products} onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />
                </motion.div>
              )}

              {showAICopilot && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative z-30"
                >
                  <AICopilot
                    products={products}
                    inventory={displayInventory}
                    userRole={currentUser?.role || UserRole.ADMIN}
                    onApplyRecommendation={(rec) => {
                      if (rec.type === "RESTOCK" && rec.targetId) {
                        addNotification(`Recommandation IA appliquée pour le produit : ${rec.title}`);
                      }
                    }}
                  />
                </motion.div>
              )}

              {showReports && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative z-30"
                >
                  <ReportsModule orders={displayOrders} products={products} inventory={displayInventory} currentUser={currentUser} />
                </motion.div>
              )}

              {showChat && currentUser && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative z-30 mb-8"
                >
                  <div className="flex justify-between items-center mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <div>
                      <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Messagerie Collaborative B2B</h3>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Discutez en temps réel avec vos partenaires, fournisseurs et clients.</p>
                    </div>
                    <button 
                      onClick={() => setShowChat(false)}
                      className="p-2 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full text-blue-600 transition"
                    >
                      <RefreshCw className="w-4 h-4 rotate-45" />
                    </button>
                  </div>
                  <ChatModule 
                    currentUser={currentUser} 
                    users={displayUsers} 
                    messages={messages} 
                    onSendMessage={handleSendMessage} 
                  />
                </motion.div>
              )}

              {showPaiementsAValider && currentUser && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative z-30 mb-8"
                >
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
                    <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                      <div>
                        <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-amber-500" />
                          Validation des Paiements Mobile Money (Orange Money, Moov Money, Wave)
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Vérifiez les captures d'écran transmises par vos partenaires et validez pour déclencher la facture.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPaiementsAValider(false)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <PaiementsAValiderModule
                      vendeurId={currentUser.id}
                      vendeurNom={currentUser.companyName || currentUser.name}
                      onPaiementValide={(venteId) => {
                        addNotification(`Paiement de la commande #${venteId} validé avec succès !`);
                      }}
                      onPaiementRejete={(venteId) => {
                        addNotification(`Preuve de paiement #${venteId} rejetée.`);
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {showProfileEdit && currentUser && (
                <ProfileEditModal
                  currentUser={currentUser}
                  dbUser={dbUser}
                  updateProfile={updateProfile}
                  onClose={() => setShowProfileEdit(false)}
                  onSuccess={handleProfileUpdateSuccess}
                  addNotification={addNotification}
                />
              )}

              {showComparator && currentUser && (
                <B2BProductComparator
                  products={displayProducts}
                  users={countryFilteredUsers}
                  connections={connections}
                  currentUser={currentUser}
                  onClose={() => setShowComparator(false)}
                  onSelectProductToOrder={(product) => {
                    setShowComparator(false);
                    handleSelectProduct(product);
                    addNotification(`Produit "${product.name}" sélectionné.`);
                  }}
                  onContactSupplier={(supplierId) => {
                    setShowComparator(false);
                    setShowChat(true);
                  }}
                  onRequestConnection={async (targetUserId) => {
                    try {
                      await connectionService.sendConnectionRequest(currentUser, targetUserId);
                      addNotification("Demande de partenariat envoyée au fournisseur (En attente de confirmation).");
                    } catch (err: any) {
                      addNotification(err.message || "Erreur lors de l'envoi de la demande de partenariat.");
                    }
                  }}
                />
              )}
            </AnimatePresence>

        {/* Dashboard Layout: persistent sidebar (desktop) + main content */}
        <div className="flex items-start gap-5">
          {/* Desktop Sidebar Navigation */}
          <aside className={`hidden md:flex flex-col shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/85 backdrop-blur shadow-sm transition-all duration-200 ${sidebarCollapsed ? "w-16 items-center px-2 py-3" : "w-64 p-3"}`}>
            <button
              onClick={() => setSidebarCollapsed(s => !s)}
              title={sidebarCollapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
              className={`mb-2 grid place-items-center w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer ${sidebarCollapsed ? "" : "ml-auto"}`}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {currentUser && (
              <div className={`${sidebarCollapsed ? "pb-3 mb-2 border-b border-zinc-100 dark:border-zinc-800" : "px-2 pb-3 mb-2 border-b border-zinc-100 dark:border-zinc-800"}`}>
                <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2.5"}`}>
                  <div className="relative shrink-0">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl grid place-items-center bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                        <Zap className="w-5 h-5" />
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-zinc-900" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">{currentUser.companyName || currentUser.name}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">{currentUser.role}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!sidebarCollapsed && <p className="px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">Espace de travail</p>}
            <nav className="space-y-1 w-full">
              <button title="Support & Guide IA" onClick={() => { setShowSupportModal(true); }} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer`}>
                <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" /> {!sidebarCollapsed && "Support & Guide IA"}
              </button>
              {currentUser && currentUser.role !== "Admin" && currentUser.role !== "Client Final" && currentUser.role !== "Chauffeur / Livreur" && (
                <button title="Validation Paiements" onClick={() => setShowPaiementsAValider(!showPaiementsAValider)} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold transition cursor-pointer ${showPaiementsAValider ? "bg-amber-600 text-white" : "text-zinc-700 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700"}`}>
                  <Smartphone className="w-4 h-4 text-amber-500 shrink-0" /> {!sidebarCollapsed && "Validation Paiements"}
                </button>
              )}
              <button title="Messagerie B2B" onClick={() => setShowChat(!showChat)} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold transition cursor-pointer ${showChat ? "bg-blue-600 text-white" : "text-zinc-700 dark:text-zinc-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700"}`}>
                <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" /> {!sidebarCollapsed && "Messagerie B2B"}
              </button>
              <button title="Comparateur B2B" onClick={() => setShowComparator(!showComparator)} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold transition cursor-pointer ${showComparator ? "bg-emerald-600 text-white" : "text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700"}`}>
                <Scale className="w-4 h-4 text-emerald-600 shrink-0" /> {!sidebarCollapsed && "Comparateur B2B"}
              </button>
              <button title="Scanner" onClick={() => setShowScanner(!showScanner)} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer`}>
                <Scan className="w-4 h-4 text-emerald-600 shrink-0" /> {!sidebarCollapsed && "Scanner"}
              </button>
              <button title="Copilote IA" onClick={() => setShowAICopilot(!showAICopilot)} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold transition cursor-pointer ${showAICopilot ? "bg-indigo-600 text-white" : "text-zinc-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700"}`}>
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" /> {!sidebarCollapsed && "Copilote IA"}
              </button>
              <button title="Rapports & Analytics" onClick={() => setShowReports(!showReports)} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-3 gap-2.5"} py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer`}>
                <BarChart2 className="w-4 h-4 text-emerald-600 shrink-0" /> {!sidebarCollapsed && "Rapports & Analytics"}
              </button>
            </nav>

            {/* Sidebar status footer */}
            {!sidebarCollapsed && (
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-[10px] font-bold ${isOnline ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  {isOnline ? "En ligne · Synchronisé" : "Mode hors-ligne actif"}
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                  <RefreshCw className={`w-3 h-3 ${syncStatus.isSyncing ? "animate-spin text-emerald-500" : "text-zinc-400"}`} />
                  {syncStatus.pendingCount > 0 ? `${syncStatus.pendingCount} modification(s) en attente` : "Toutes les données sont à jour"}
                </div>
                <p className="px-2 text-[9px] font-semibold text-zinc-400 dark:text-zinc-600">WakatMarket ERP · Édition Afrique de l'Ouest</p>
              </div>
            )}
          </aside>

          {/* Main content column */}
          <div className="flex-1 min-w-0 space-y-5">

        {/* Geographical Country Filter Dropdown Bar */}
        <section className="mb-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Filtre Géographique Régional
                  {selectedCountryFilter !== "ALL" && (
                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full lowercase font-normal">
                      filtre actif: {selectedCountryFilter}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Filtrer les clients, partenaires et réseaux de distribution par pays ('pays')
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
                >
                  <option value="ALL">Tous les pays (Afrique de l'Ouest)</option>
                  {availableCountries.map((c, idx) => (
                    <option key={`country_${c}_${idx}`} value={c}>
                       {c}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">
                  ▼
                </div>
              </div>

              {selectedCountryFilter !== "ALL" && (
                <button
                  onClick={() => setSelectedCountryFilter("ALL")}
                  className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Core Role Dashboard Injector */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
          {showDiagnostic ? (
            <DiagnosticModule onBack={() => setShowDiagnostic(false)} />
          ) : currentUser ? (
            <>
              {currentUser.role === UserRole.ADMIN && (
                <AdminDashboard
                  currentUser={currentUser}
                  users={countryFilteredUsers}
                  orders={displayOrders}
                  products={displayProducts}
                  inventory={displayInventory}
                  stockMovements={stockMovements}
                  onToggleUserStatus={handleToggleUserStatus}
                  onDeleteUser={handleDeleteUser}
                  onUpdateCommission={handleUpdateCommission}
                  commissionRate={platformStats.commissionRate}
                  onChangeUserRole={handleChangeUserRole}
                  onUpdateUser={handleUpdateUserProfileAdmin}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                />
              )}
              
              {currentUser.role === UserRole.MANUFACTURER && (
                <ManufacturerDashboard
                  currentUser={currentUser}
                  products={displayProducts}
                  inventory={displayInventory}
                  orders={displayOrders}
                  users={countryFilteredUsers}
                  lightClients={countryFilteredLightClients}
                  payments={payments}
                  connections={connections}
                  syncQueue={syncQueue}
                  isOnline={isOnline}
                  stockMovements={stockMovements}
                  onCreateProduct={handleCreateProduct}
                  onUpdateInventory={handleUpdateInventory}
                  onUpdateProductFull={handleUpdateProductFull}
                  onDeleteInventoryItem={handleDeleteInventoryItem}
                  onPlaceSale={handlePlaceSale}
                  onCreateLightClient={handleCreateLightClient}
                  onDeleteLightClient={onDeleteLightClient}
                  onAddPayment={handleAddPayment}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                />
              )}

              {currentUser.role === UserRole.WHOLESALER && (
                <WholesalerDashboard
                  currentUser={currentUser}
                  products={displayProducts}
                  inventory={displayInventory}
                  orders={displayOrders}
                  users={countryFilteredUsers}
                  lightClients={countryFilteredLightClients}
                  payments={payments}
                  connections={connections}
                  syncQueue={syncQueue}
                  isOnline={isOnline}
                  stockMovements={stockMovements}
                  onPlaceB2BOrder={handlePlaceB2BOrder}
                  onUpdateInventory={handleUpdateInventory}
                  onUpdateProductFull={handleUpdateProductFull}
                  onDeleteInventoryItem={handleDeleteInventoryItem}
                  onCreateProduct={handleCreateProduct}
                  onPlaceSale={handlePlaceSale}
                  onCreateLightClient={handleCreateLightClient}
                  onDeleteLightClient={onDeleteLightClient}
                  onAddPayment={handleAddPayment}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onPayOrder={handlePayOrder}
                  onUpdateCreditLimit={handleUpdateCreditLimit}
                  favoriteProductIds={favoriteProductIds}
                  onSelectProduct={handleSelectProduct}
                />
              )}

              {currentUser.role === UserRole.RETAILER && (
                <RetailerDashboard
                  currentUser={currentUser}
                  products={displayProducts}
                  inventory={displayInventory}
                  orders={displayOrders}
                  users={countryFilteredUsers}
                  lightClients={countryFilteredLightClients}
                  payments={payments}
                  connections={connections}
                  syncQueue={syncQueue}
                  isOnline={isOnline}
                  stockMovements={stockMovements}
                  onPlaceB2BOrder={handlePlaceB2BOrder}
                  onUpdateInventory={handleUpdateInventory}
                  onUpdateProductFull={handleUpdateProductFull}
                  onDeleteInventoryItem={handleDeleteInventoryItem}
                  onCreateProduct={handleCreateProduct}
                  onPlaceQuickB2CSale={handlePlaceQuickB2CSale}
                  onPlaceSale={handlePlaceSale}
                  onCreateLightClient={handleCreateLightClient}
                  onDeleteLightClient={onDeleteLightClient}
                  onAddPayment={handleAddPayment}
                  onPayOrder={handlePayOrder}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onUpdateCreditLimit={handleUpdateCreditLimit}
                  favoriteProductIds={favoriteProductIds}
                  onSelectProduct={handleSelectProduct}
                />
              )}

              {currentUser.role === UserRole.SEMI_WHOLESALER && (
                <SemiWholesalerDashboard
                  currentUser={currentUser}
                  products={displayProducts}
                  inventory={displayInventory}
                  orders={displayOrders}
                  users={countryFilteredUsers}
                  lightClients={countryFilteredLightClients}
                  payments={payments}
                  connections={connections}
                  syncQueue={syncQueue}
                  isOnline={isOnline}
                  stockMovements={stockMovements}
                  onPlaceB2BOrder={handlePlaceB2BOrder}
                  onUpdateInventory={handleUpdateInventory}
                  onUpdateProductFull={handleUpdateProductFull}
                  onDeleteInventoryItem={handleDeleteInventoryItem}
                  onCreateProduct={handleCreateProduct}
                  onPlaceQuickB2CSale={handlePlaceQuickB2CSale}
                  onPlaceSale={handlePlaceSale}
                  onCreateLightClient={handleCreateLightClient}
                  onDeleteLightClient={onDeleteLightClient}
                  onAddPayment={handleAddPayment}
                  onPayOrder={handlePayOrder}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onUpdateCreditLimit={handleUpdateCreditLimit}
                  favoriteProductIds={favoriteProductIds}
                  onSelectProduct={handleSelectProduct}
                />
              )}

              {currentUser.role === UserRole.CLIENT && (
                <ClientDashboard
                  currentUser={currentUser}
                  products={displayProducts}
                  inventory={displayInventory}
                  orders={displayOrders}
                  users={countryFilteredUsers}
                  onPlaceB2COrder={handlePlaceB2COrder}
                  onPostReview={handlePostReview}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  favoriteProductIds={favoriteProductIds}
                  onSelectProduct={handleSelectProduct}
                />
              )}

              {[UserRole.DRIVER_M2W, UserRole.DRIVER_W2R, UserRole.DRIVER_R2C, UserRole.DRIVER_W2SG, UserRole.DRIVER_SG2R].includes(currentUser.role) && (
                <DriverDashboard
                  currentUser={currentUser}
                  orders={displayOrders}
                  users={countryFilteredUsers}
                  products={displayProducts}
                  onCompleteDelivery={handleCompleteDelivery}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                />
              )}
            </>
          ) : null}
        </section>

          </div>
        </div>

        {/* Product Detail Modal with Recharts 30-Day Price History */}
        {viewingProductDetail && (
          <ProductDetailModal
            product={viewingProductDetail.product}
            inventoryItem={viewingProductDetail.inventoryItem}
            onClose={() => setViewingProductDetail(null)}
            isFavorite={favoriteProductIds.includes(viewingProductDetail.product.id)}
            onToggleFavorite={() => handleToggleFavorite(viewingProductDetail.product.id)}
          />
        )}

        {/* Interactive Onboarding Tour */}
        {showOnboarding && currentUser && (
          <OnboardingTour
            currentUser={currentUser}
            isOpen={true}
            onClose={() => setShowOnboarding(false)}
            onComplete={() => {
              if (currentUser?.id) {
                localStorage.setItem(`wakat_onboarding_completed_${currentUser.id}`, "true");
              }
              setShowOnboarding(false);
            }}
          />
        )}

        {/* Support & AI FAQ Modal */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          userRole={currentUser?.role}
          userName={currentUser?.name}
        />

        {/* PWA Direct and Guided Installation Modal */}
        <PWAInstallModal
          isOpen={showPWAInstallModal}
          onClose={() => setShowPWAInstallModal(false)}
          deferredPrompt={deferredPrompt}
          onPromptTriggered={() => setDeferredPrompt(null)}
        />

        {/* Admin Password Challenge Reset Modal */}
        {/* Custom Confirm Modal for Iframe compatibility */}
        <AnimatePresence>
          {confirmDeleteAction && confirmDeleteAction.isOpen && (
            <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
                  <Trash2 className="w-6 h-6" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{confirmDeleteAction.title}</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  {confirmDeleteAction.message}
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setConfirmDeleteAction(null)} 
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={() => { 
                      confirmDeleteAction.onConfirm(); 
                      setConfirmDeleteAction(null); 
                    }} 
                    className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-500 transition shadow-sm shadow-rose-600/20"
                  >
                    Confirmer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <ResetPasswordModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          currentUser={currentUser}
          onConfirmReset={() => {
            db.resetAll();
            addNotification("Toutes les données ont été réinitialisées avec succès.");
          }}
        />

        {/* Safe Delete User Two-Step Confirmation Modal */}
        <DeleteUserConfirmationModal
          isOpen={!!userToDeleteForConfirmation}
          onClose={() => setUserToDeleteForConfirmation(null)}
          user={userToDeleteForConfirmation}
          onSuccess={handleSuccessDeleteUser}
          isRealUser={isRealUserAuthenticated}
        />

        {/* Modal de téléversement de preuve de paiement par capture d'écran */}
        {orderForPaymentProof && (
          <PreuvePaiementUploadModal
            isOpen={!!orderForPaymentProof}
            onClose={() => setOrderForPaymentProof(null)}
            order={orderForPaymentProof}
            currentUserId={currentUser?.id || "CLIENT"}
            currentUserName={currentUser?.name || "Client"}
            vendeurNumeros={
              (orderForPaymentProof as any).vendeurNumeros || 
              users.find(u => u.id === (orderForPaymentProof.receiverId || (orderForPaymentProof as any).vendeurId))?.numerosPaiement
            }
            vendeurNom={
              users.find(u => u.id === (orderForPaymentProof.receiverId || (orderForPaymentProof as any).vendeurId))?.companyName ||
              users.find(u => u.id === (orderForPaymentProof.receiverId || (orderForPaymentProof as any).vendeurId))?.name ||
              "Commerçant partenaire"
            }
            onSuccess={(updatedOrder) => {
              addNotification(`Preuve de paiement soumise pour la commande #${(orderForPaymentProof as any).id}. En attente de validation du vendeur.`);
              setOrders(prev => prev.map(o => o.id === (orderForPaymentProof as any).id ? { ...o, statutPaiement: "preuve_soumise" } : o));
              setOrderForPaymentProof(null);
            }}
          />
        )}

        {/* Toast Notifications Container with Smooth Enter/Exit Animations */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast, idx) => (
              <motion.div
                key={toast.id ? `${toast.id}_${idx}` : `toast_${idx}`}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="pointer-events-auto bg-zinc-900/95 dark:bg-zinc-800/95 text-white p-4 rounded-2xl shadow-xl border border-zinc-700 backdrop-blur-md flex items-start gap-3"
              >
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                  <Bell className="w-4 h-4 animate-bounce" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-400">Notification Wakat</span>
                    <span className="text-[10px] text-zinc-400">{toast.time}</span>
                  </div>
                  <p className="text-xs text-zinc-200 mt-1 leading-relaxed">{toast.text}</p>
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </main>

      {/* Modern, elegant, clean Africanized ERP Footer */}
      <footer className="bg-zinc-900 text-zinc-400 border-t border-zinc-800 py-8 px-4 mt-12 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <div className="text-center md:text-left">
            <p className="font-bold text-white flex items-center justify-center md:justify-start gap-1">
              WakatMarket d'Afrique de l'Ouest
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Plateforme unifiée et souveraine de souveraineté alimentaire, logistique, et distribution d'Afrique.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {currentUser && (
              <button
                onClick={() => setShowOnboarding(true)}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl"
              >
                <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Visite Guidée (Onboarding)</span>
              </button>
            )}
            <button
              onClick={() => setShowResetModal(true)}
              className="text-[10px] text-white transition cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl shadow-sm bg-red-600 hover:bg-red-700 active:bg-red-800 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 
              Réinitialiser toutes les données
            </button>
          </div>
        </div>
      </footer>
    </div>
  );

}
