/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users, Shield, ShieldCheck, Compass, Landmark, Truck, ShoppingCart, ShoppingBag, 
  Settings, KeyRound, Sparkles, RefreshCw, BarChart2, MessageSquare, 
  Scan, Bell, LogIn, LogOut, Sun, Moon, Info, HelpCircle, AlertCircle, 
  Smartphone, Mail, Lock, PhoneCall, Laptop, Globe, Heart, MapPin, UserCog,
  UserCheck, UserX, WifiOff, Presentation, LayoutGrid, X, Clock, Loader2, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { UserRole, UserProfile, Product, InventoryItem, Order, OrderStatus, ChatMessage, AIRecommendation, LightClient, StockMovement, DebtPayment, Connection, isConnectionActive, normalizeUserRole, isBonkoungou } from "./types";
import {
  db, getGeoHierarchy, estimateShipping, triggerAIAnalysis, formatCFA, generateOTP, calculateApplicablePrice, DEFAULT_PRODUCTS
} from "./data";
import { useAuth } from "./hooks/useAuth";
import { authService } from "./services/authService";
import { userService, FirebaseUser } from "./services/userService";
import { inventoryService } from "./services/inventoryService";
import { productService } from "./services/productService";
import { orderService } from "./services/orderService";
import { venteService } from "./services/venteService";
import { connectionService } from "./services/connectionService";
import { relationService } from "./services/relationService";
import { syncService } from "./services/syncService";
import { formatFirebaseError } from "./utils/firebaseErrors";

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
import PitchDeck from "./components/PitchDeck";
import SupportModal from "./components/SupportModal";
import { PaiementsAValiderModule } from "./components/PaiementsAValiderModule";
import { PreuvePaiementUploadModal } from "./components/PreuvePaiementUploadModal";
import { NotificationBell } from "./components/NotificationBell";

export default function App() {
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToDeleteForConfirmation, setUserToDeleteForConfirmation] = useState<UserProfile | null>(null);
  const [showPaiementsAValider, setShowPaiementsAValider] = useState(false);
  const [orderForPaymentProof, setOrderForPaymentProof] = useState<Order | null>(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("ALL");
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    pendingCount: number;
    totalCount: number;
    progress: number;
    currentTask?: string | null;
  }>({
    isSyncing: false,
    pendingCount: db.getSyncQueue().filter((t: any) => t.status === 'pending').length,
    totalCount: db.getSyncQueue().length,
    progress: 100
  });
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("wakat_erp_v2_theme") === "dark";
  });
  const [autoSystemTheme, setAutoSystemTheme] = useState<boolean>(() => {
    return localStorage.getItem("wakat_erp_autosync_theme") === "true";
  });

  useEffect(() => {
    localStorage.setItem("wakat_erp_autosync_theme", String(autoSystemTheme));
    if (autoSystemTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkMode(mediaQuery.matches);
      const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [autoSystemTheme]);

  const {
    firebaseUser,
    dbUser,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    requestPhoneOTP,
    verifyPhoneOTP,
    logout: firebaseLogout,
    loading: authLoading,
    confirmationResult,
    error: authError,
    updateProfile
  } = useAuth();

  const [isRealUserAuthenticated, setIsRealUserAuthenticated] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash === "#diagnostic" || window.location.pathname === "/diagnostic") {
        setShowDiagnostic(true);
      }
    }
  }, []);

  // DB States
  const [users, setUsers] = useState<UserProfile[]>(() => db.getUsers());
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => db.getInventory());
  const [orders, setOrders] = useState<Order[]>(() => db.getOrders());
  const [messages, setMessages] = useState<ChatMessage[]>(() => db.getMessages());
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(() => db.getRecommendations());
  const [platformStats, setPlatformStats] = useState(() => db.getPlatformStats());
  const [lightClients, setLightClients] = useState<LightClient[]>(() => db.getLightClients());
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => db.getStockMovements());
  const [payments, setPayments] = useState<DebtPayment[]>(() => db.getPayments());
  const [syncQueue, setSyncQueue] = useState<any[]>(() => db.getSyncQueue());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Active User session simulation
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Default to Admin or first active user on launch
    const list = db.getUsers();
    return list.find((u) => u.role === UserRole.ADMIN) || list[0] || null;
  });

  useEffect(() => {
    setIsRealUserAuthenticated(!!firebaseUser && !!dbUser);
  }, [firebaseUser, dbUser]);

  // Firestore Sync for users
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

  // Firestore Sync for products
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

  // Firestore Sync for inventory
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

  // Silent background cleanup of any remaining mock/fictional inventory items & target users
  useEffect(() => {
    const runDeepCleanup = async () => {
      if (!isRealUserAuthenticated) return;
      
      // 1. Clean local state and db inventory items matching the mock conditions
      if (inventory.length > 0) {
        const mockItems = inventory.filter(i => 
          i.id.includes("bonk") || 
          i.id.includes("sayouba") || 
          (i.ownerId && (i.ownerId.includes("bonk") || i.ownerId.includes("sayouba") || i.ownerId.includes("ujk.b") || i.ownerId.includes("ujkz")))
        );
        if (mockItems.length > 0) {
          console.log("[Auto-Cleanup] Detected mock inventory items, deleting:", mockItems.map(i => i.id));
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

      // 2. Query Firestore dynamically to find and delete catalog of bonkoungou@ujkz.bf & sayouba@ujkz.bf
      try {
        const { collection, getDocs, doc, deleteDoc } = await import("firebase/firestore");
        const { db: firestoreDb } = await import("./firebase/firebase");
        
        const targetEmails = ["bonkoungou@ujkz.bf", "sayouba@ujkz.bf"];
        
        // Find UIDs of these emails in users collection and restore SEMI_WHOLESALER role
        const usersCol = collection(firestoreDb, "users");
        const usersSnap = await getDocs(usersCol);
        const { updateDoc: updateFirestoreDoc } = await import("firebase/firestore");
        
        const targetUids: string[] = [];
        usersSnap.forEach(async (uDoc) => {
          if (uDoc.exists()) {
            const data = uDoc.data();
            const email = (data.email || "").toLowerCase().trim();
            if (targetEmails.includes(email)) {
              targetUids.push(uDoc.id);
              if (data.rôle !== "SEMI_WHOLESALER" || data.role !== "SEMI_WHOLESALER") {
                await updateFirestoreDoc(doc(firestoreDb, "users", uDoc.id), {
                  rôle: "SEMI_WHOLESALER",
                  role: "SEMI_WHOLESALER"
                }).catch(() => {});
              }
            }
          }
        });

        // Also query "utilisateurs" collection just in case
        try {
          const utilsCol = collection(firestoreDb, "utilisateurs");
          const utilsSnap = await getDocs(utilsCol);
          utilsSnap.forEach(uDoc => {
            if (uDoc.exists()) {
              const data = uDoc.data();
              const email = (data.email || "").toLowerCase().trim();
              if (targetEmails.includes(email) && !targetUids.includes(uDoc.id)) {
                targetUids.push(uDoc.id);
              }
            }
          });
        } catch (e) {}

        // Add default known domains or identifiers to ensure full removal
        const allTargetIdentifiers = [...targetUids, ...targetEmails, "sayouba", "bonkoungou"];

        // Query the global inventory collection and delete matching ownerIds
        const inventoryCol = collection(firestoreDb, "inventory");
        const inventorySnap = await getDocs(inventoryCol);
        inventorySnap.forEach(async (invDoc) => {
          if (invDoc.exists()) {
            const data = invDoc.data();
            const ownerId = (data.ownerId || "").toLowerCase().trim();
            const id = invDoc.id;
            
            const matchesTarget = allTargetIdentifiers.some(ident => {
              const cleanIdent = ident.toLowerCase().trim();
              return ownerId === cleanIdent || id.includes(cleanIdent);
            });

            if (matchesTarget) {
              console.log(`[Deep-Cleanup] Deleting global inventory item ${id} for ${ownerId}`);
              await deleteDoc(doc(firestoreDb, "inventory", id)).catch(() => {});
            }
          }
        });

        // Clear subcollections /stocks/{uid}/items for each target UID found
        for (const uid of targetUids) {
          try {
            const itemsCol = collection(firestoreDb, "stocks", uid, "items");
            const itemsSnap = await getDocs(itemsCol);
            if (!itemsSnap.empty) {
              console.log(`[Deep-Cleanup] Found ${itemsSnap.size} subcollection stock items to clear for UID: ${uid}`);
              for (const itemDoc of itemsSnap.docs) {
                await deleteDoc(doc(firestoreDb, "stocks", uid, "items", itemDoc.id)).catch(() => {});
              }
            }
          } catch (subErr) {
            console.error(`[Deep-Cleanup] Error clearing stock items for UID ${uid}:`, subErr);
          }
        }

        // Query products collection and delete products created by target emails/UIDs
        try {
          const productsCol = collection(firestoreDb, "products");
          const productsSnap = await getDocs(productsCol);
          productsSnap.forEach(async (pDoc) => {
            if (pDoc.exists()) {
              const data = pDoc.data();
              const creatorId = (data.creatorId || "").toLowerCase().trim();
              const pId = pDoc.id;
              const matchesTarget = allTargetIdentifiers.some(ident => {
                const cleanIdent = ident.toLowerCase().trim();
                return creatorId === cleanIdent || pId.includes(cleanIdent);
              });
              if (matchesTarget) {
                console.log(`[Deep-Cleanup] Deleting product ${pId} created by ${creatorId}`);
                await deleteDoc(doc(firestoreDb, "products", pId)).catch(() => {});
              }
            }
          });
        } catch (pErr) {
          console.error(`[Deep-Cleanup] Error clearing products:`, pErr);
        }

        // Ensure users local state is synced to SEMI_WHOLESALER
        setUsers(prev => prev.map(u => {
          const email = (u.email || "").toLowerCase().trim();
          if (targetEmails.includes(email) || email.includes("bonkoungou")) {
            return { ...u, role: UserRole.SEMI_WHOLESALER };
          }
          return u;
        }));

      } catch (err) {
        console.error("[Deep-Cleanup] Error during Firestore deep cleanup execution:", err);
      }
    };

    runDeepCleanup();
  }, [isRealUserAuthenticated, inventory, users]);

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

  // Firestore Sync for orders
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
      const determinedRole = (normEmail === "urbain.traore@yahoo.fr" || normEmail === "urbain.traoreurb@gmail.com")
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
  const [isAuthScreen, setIsAuthScreen] = useState(() => {
    const list = db.getUsers();
    const hasUser = list.find((u) => u.role === UserRole.ADMIN) || list[0] || null;
    return !hasUser;
  });
  const [authStep, setAuthStep] = useState<"login" | "otp" | "reset">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authOTP, setAuthOTP] = useState("");
  const [sentOTP, setSentOTP] = useState("");

  // UI states for Auth form
  const [fbAuthMode, setFbAuthMode] = useState<"signin" | "signup" | "phone" | "reset">("signin");
  const [fbEmail, setFbEmail] = useState("");
  const [fbPassword, setFbPassword] = useState("");
  const [fbNom, setFbNom] = useState("");
  const [fbPrénom, setFbPrénom] = useState("");
  const [fbTéléphone, setFbTéléphone] = useState("");
  const [fbRôle, setFbRôle] = useState<UserRole>(UserRole.CLIENT);
  const [fbOtpCode, setFbOtpCode] = useState("");
  const [fbPersist, setFbPersist] = useState(true);
  const [fbMsg, setFbMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Geographical location states for company registration
  const [fbPays, setFbPays] = useState("");
  const [fbVille, setFbVille] = useState("");
  const [fbQuartier, setFbQuartier] = useState("");
  const [fbLatitude, setFbLatitude] = useState<number | undefined>(undefined);
  const [fbLongitude, setFbLongitude] = useState<number | undefined>(undefined);
  const [geoLoading, setGeoLoading] = useState(false);

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
        const idToUse = u.id || `user-${Date.now()}`;
        u.id = idToUse;
        map.set(idToUse, u);
        if (u.id) idMap.set(u.id, idToUse);
        if (cleanEmail) emailMap.set(cleanEmail, idToUse);
        if (cleanCompany && cleanCompany !== "entreprise" && cleanCompany !== "sans entreprise") companyMap.set(cleanCompany, idToUse);
      }
    });

    return Array.from(map.values()).filter(u => (u.status as any) !== "DELETED");
  };

  // Synchronize Firestore user profile or Firebase User to Active ERP Session
  useEffect(() => {
    if (firebaseUser) {
      if (!dbUser) {
        // Wait for dbUser to load before syncing to avoid overwriting roles with fallbacks
        return;
      }
      
      const profileSource = dbUser;
      const existingUser = users.find(u => u.id === profileSource.uid);

      const activeProfile: UserProfile = {
        id: profileSource.uid,
        name: `${profileSource.prénom || ""} ${profileSource.nom || ""}`.trim() || "Utilisateur",
        email: profileSource.email,
        phone: profileSource.téléphone,
        role: (profileSource.email === "urbain.traore@yahoo.fr" || profileSource.email === "urbain.traoreurb@gmail.com") 
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
      setIsAuthScreen(false);
    } else {
      setIsRealUserAuthenticated(false);
      // Clear currentUser on logout and show auth screen
      setCurrentUser(null);
      setIsAuthScreen(true);
    }
  }, [firebaseUser, dbUser]);

  // Synchroniser tous les autres utilisateurs réels depuis Firestore et le stockage local
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
        console.error("Erreur de chargement des utilisateurs :", err);
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
          console.error("Error loading cloud data:", err);
        }
      }
    };
    fetchCloudData();

    return () => {
      active = false;
    };
  }, [firebaseUser, dbUser]);

  // Display auth error messages in helper state
  useEffect(() => {
    if (authError) {
      setFbMsg({ type: "error", text: authError });
    }
  }, [authError]);

  const [showScanner, setShowScanner] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPitchDeck, setShowPitchDeck] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showMobileToolsMenu, setShowMobileToolsMenu] = useState(false);

  // States for user profile editing
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // State for Product Detail Modal with 30-Day Recharts Price Graph
  const [viewingProductDetail, setViewingProductDetail] = useState<{
    product: Product;
    inventoryItem?: InventoryItem;
  } | null>(null);

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
  const [realConnections, setRealConnections] = useState<Connection[]>([]);
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

    return () => {
      window.removeEventListener("wakat_open_upload_proof", handleOpenUploadProof);
      window.removeEventListener("wakat_open_valider_paiements", handleOpenValiderPaiements);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      console.log(`[App] Subscribing to notifications and connections for ${currentUser.id}`);
      const unsubNotifs = connectionService.subscribeToUserNotifications(currentUser.id, (notifs) => {
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

      const unsubConns = connectionService.subscribeToUserConnections(currentUser.id, (conns) => {
        setRealConnections(conns);

        // Auto-add accepted connections to lightClients
        const activePartnerIds = conns
          .filter(c => isConnectionActive(c))
          .map(c => c.senderId === currentUser.id ? c.receiverId : c.senderId);

        if (activePartnerIds.length > 0) {
          setLightClients(prev => {
            let updated = [...prev];
            let modified = false;
            activePartnerIds.forEach(partnerId => {
              const existing = updated.find(lc => lc.linkedUserId === partnerId);
              if (!existing) {
                // Find the user to get their details
                const partnerUser = db.getUsers().find(u => u.id === partnerId);
                if (partnerUser) {
                  updated.unshift({
                    id: `lc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    ownerId: currentUser.id,
                    name: partnerUser.companyName || partnerUser.name,
                    phone: partnerUser.phone,
                    email: partnerUser.email,
                    notes: `Partenaire B2B [${partnerUser.role}]`,
                    linkedUserId: partnerUser.id,
                    createdAt: new Date().toISOString()
                  });
                  modified = true;
                }
              }
            });
            if (modified) {
              db.saveLightClients(updated);
              return updated;
            }
            return prev;
          });
        }
      });

      return () => {
        unsubNotifs();
        unsubConns();
      };
    }
  }, [currentUser?.id]);

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
    
    // If authenticated, also update Firestore users list or handle individual deletions
    // Note: handleDeleteUser will handle specific Firestore deletions
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

  // Real-time Sync Status listener
  useEffect(() => {
    const handleSyncUpdate = (e: CustomEvent) => {
      if (e.detail) {
        setSyncStatus({
          isSyncing: !!e.detail.isSyncing,
          pendingCount: e.detail.pendingCount ?? 0,
          totalCount: e.detail.totalCount ?? 0,
          progress: e.detail.progress ?? 100,
          currentTask: e.detail.currentTask
        });
        if (e.detail.queue) {
          setSyncQueue(e.detail.queue);
        }
      }
    };

    window.addEventListener('wakat_sync_status_updated' as any, handleSyncUpdate as any);
    return () => {
      window.removeEventListener('wakat_sync_status_updated' as any, handleSyncUpdate as any);
    };
  }, []);

  // Online/Offline Monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncService.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Periodic sync check
  useEffect(() => {
    if (isOnline) {
      const interval = setInterval(() => {
        syncService.processQueue();
        const currentQ = db.getSyncQueue();
        setSyncQueue(currentQ);
        setSyncStatus(prev => ({
          ...prev,
          pendingCount: currentQ.filter((t: any) => t.status === 'pending').length,
          totalCount: currentQ.length
        }));
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

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

  // Auth Operations
  const handleRequestOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPhone) return;
    const generated = generateOTP();
    setSentOTP(generated);
    // Real SMS would go here
    setAuthStep("otp");
  };

  const handleValidateOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (authOTP === sentOTP) {
      // Look up user by phone
      const matched = users.find((u) => u.phone.replace(/\s+/g, "") === authPhone.replace(/\s+/g, ""));
      if (matched) {
        setCurrentUser(matched);
        setIsAuthScreen(false);
        addNotification(`Authentification réussie pour ${matched.name}`);
      } else {
        alert("Aucun compte associé à ce numéro de téléphone. Simulation d'inscription en cours.");
        // Auto sign in as standard client
        const newClient: UserProfile = {
          id: `client-${Date.now()}`,
          name: "Nouveau Client SMS",
          email: "",
          phone: authPhone,
          role: UserRole.CLIENT,
          status: "ACTIVE",
          country: "Sénégal",
          region: "Dakar",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          balance: 0
        };
        syncUsers([...users, newClient]);
        setCurrentUser(newClient);
        setIsAuthScreen(false);
      }
    } else {
      alert("Code OTP incorrect.");
    }
  };

  // Production Firebase Auth Handlers
  const handleFbLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbMsg(null);
    try {
      await loginWithEmail(fbEmail, fbPassword);
      setFbMsg({ type: "success", text: "Connexion Firebase réussie !" });
      setIsAuthScreen(false);
    } catch (err: any) {
      setFbMsg({ type: "error", text: formatFirebaseError(err.message || "Erreur de connexion Firebase.") });
    }
  };

  const handleFbSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbMsg(null);
    if (!fbNom || !fbPrénom || !fbTéléphone) {
      setFbMsg({ type: "error", text: "Veuillez remplir tous les champs du profil." });
      return;
    }

    // Check if the role requires business geographical location
    const requiresGeo = [
      UserRole.MANUFACTURER,
      UserRole.WHOLESALER,
      UserRole.SEMI_WHOLESALER,
      UserRole.RETAILER
    ].includes(fbRôle);

    if (requiresGeo && (!fbPays.trim() || !fbVille.trim() || !fbQuartier.trim())) {
      setFbMsg({
        type: "error",
        text: "Pour un Fabricant, Grossiste, Demi-Grossiste ou Détaillant, veuillez renseigner la situation géographique de l'entreprise (Pays, Ville, Quartier)."
      });
      return;
    }

    try {
      await registerWithEmail(
        fbEmail,
        fbPassword,
        fbNom,
        fbPrénom,
        fbTéléphone,
        fbRôle,
        requiresGeo ? fbPays : undefined,
        requiresGeo ? fbVille : undefined,
        requiresGeo ? fbQuartier : undefined,
        requiresGeo ? fbLatitude : undefined,
        requiresGeo ? fbLongitude : undefined
      );
      setFbMsg({ type: "success", text: "Inscription et création de profil réussies !" });
      setIsAuthScreen(false);
    } catch (err: any) {
      setFbMsg({ type: "error", text: formatFirebaseError(err.message || "Erreur d'inscription Firebase.") });
    }
  };

  const handleFbResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbMsg(null);
    try {
      await sendPasswordReset(fbEmail);
      setFbMsg({ type: "success", text: "E-mail de réinitialisation envoyé avec succès !" });
    } catch (err: any) {
      setFbMsg({ type: "error", text: formatFirebaseError(err.message || "Erreur d'envoi de l'e-mail.") });
    }
  };

  const handleFbRequestPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbMsg(null);
    if (!fbTéléphone) {
      setFbMsg({ type: "error", text: "Veuillez spécifier votre numéro de téléphone." });
      return;
    }
    try {
      await requestPhoneOTP(fbTéléphone, "recaptcha-container");
      setFbMsg({ type: "success", text: "Code de vérification envoyé !" });
    } catch (err: any) {
      setFbMsg({ type: "error", text: formatFirebaseError(err.message || "Erreur lors de l'envoi de l'OTP.") });
    }
  };

  const handleFbVerifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbMsg(null);
    try {
      await verifyPhoneOTP(fbOtpCode, fbNom || "Utilisateur", fbPrénom || "Firebase", fbEmail, fbRôle);
      setFbMsg({ type: "success", text: "Vérification OTP réussie !" });
      setIsAuthScreen(false);
    } catch (err: any) {
      setFbMsg({ type: "error", text: formatFirebaseError(err.message || "Erreur lors de la vérification OTP.") });
    }
  };

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
      console.error("Erreur mise à jour Firestore par admin:", err);
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

    // Firestore Update
    try {
      const fbProfile = await userService.getUser(userId);
      if (fbProfile) {
        await userService.updateUser(userId, { rôle: newRole });
      }
    } catch (err) {
      console.error("Erreur mise à jour Firestore du rôle:", err);
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
 
          // 3. Update Firestore if authenticated
          {
            for (const u of usersToDelete) {
              try {
                await userService.deleteUser(u.id);
                console.log(`[Cleanup] Deleted from Firestore: ${u.id}`);
              } catch (e) {
                console.error(`[Cleanup] Error deleting user ${u.id} from Firestore:`, e);
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

  // Manufacturer catalogs creation
  const handleCreateProduct = (
    p: Omit<Product, "id" | "creatorId">, 
    initialStock: number, 
    price: number,
    prixGros?: number,
    prixDetail?: number,
    quantiteMinimum?: number
  ) => {
    if (!currentUser) return;
    const newId = `p-${Date.now()}`;
    const newProd: Product = {
      ...p,
      id: newId,
      creatorId: currentUser.id
    };
    const newInvItem: InventoryItem = {
      id: `i-${Date.now()}`,
      productId: newId,
      ownerId: currentUser.id,
      stock: initialStock,
      threshold: Math.max(5, Math.round(initialStock * 0.15)),
      price: price,
      expirationDate: p.expirationDate,
      prixGros: prixGros !== undefined ? prixGros : price,
      prixDetail: prixDetail !== undefined ? prixDetail : price,
      quantiteMinimum: quantiteMinimum !== undefined ? quantiteMinimum : 1
    };

    syncProducts([...products, newProd]);
    inventoryService.updateInventoryItem(newInvItem);
    syncInventory([...inventory, newInvItem]);
    addNotification(`Nouveau produit créé : ${p.name}`);
  };

  const isRoleAllowed = (creatorRole: UserRole, targetRole: UserRole): boolean => {
    return true;
  };

  const handleCreateLightClient = (identifier: string, notes?: string, role?: UserRole, isPartnerRegistration?: boolean) => {
    if (!currentUser) return;
    
    let clientRole = role;
    if (!clientRole && isPartnerRegistration) {
      clientRole = currentUser.role === UserRole.WHOLESALER ? UserRole.SEMI_WHOLESALER : UserRole.RETAILER;
    } else if (!clientRole) {
      clientRole = UserRole.CLIENT;
    }

    try {
      relationService.envoyerDemandeConnexion(currentUser, identifier, notes)
        .then((res) => {
          addNotification(res.message);
        })
        .catch((err) => {
          console.error("Error creating connection request:", err);
          addNotification(err.message || "Erreur lors de l'envoi de la demande de connexion.");
        });
    } catch (err: any) {
      addNotification(err.message || "Erreur lors de l'envoi de la demande de connexion.");
    }
    
    return undefined as any;
  };

  const onDeleteLightClient = (clientId: string) => {
    const updated = lightClients.filter(lc => lc.id !== clientId);
    syncLightClients(updated);
    addNotification("Client supprimé de votre carnet d'adresses.");
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

  const handleUpdateInventory = (
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
            addNotification(`🚨 RUPTURE CRITIQUE : ${prod?.name} est épuisé !`);
          } else if (stock <= item.threshold) {
            const prod = products.find((p) => p.id === item.productId);
            addNotification(`⚠️ Stock d'alerte franchi : ${prod?.name} (${stock} restants)`);
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
        inventoryService.updateInventoryItem(changedItem);
      }
      syncInventory(updated);
      addNotification("Stock mis à jour avec succès.");
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
      inventoryService.updateInventoryItem(newItem);
      syncInventory([...inventory, newItem]);
      addNotification(`Nouveau produit ajouté à votre stock.`);
    }
  };

  const handleUpdateProductFull = (
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
      syncProducts(updatedProducts);
      {
        productService.createOrUpdateProduct({ id: productId, ...productData } as any);
      }
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
        syncInventory(updatedInventory);
        {
          inventoryService.updateInventoryItem({ ...targetItem, ...inventoryData });
        }
      }
    }

    addNotification("Produit et stock mis à jour avec succès !");
  };



  const handleDeleteInventoryItem = async (itemId: string, productId?: string, skipConfirm: boolean = false) => {
    const shouldDelete = skipConfirm || window.confirm("Voulez-vous vraiment retirer ce produit de votre stock ?");
    if (!shouldDelete) return;

    const itemToDelete = inventory.find(i => i.id === itemId || i.productId === itemId || (productId && i.productId === productId));
    const targetItemId = itemToDelete ? itemToDelete.id : itemId;
    const targetProdId = productId || itemToDelete?.productId || itemId;

    // Call service to delete from backend database
    try {
      if (targetItemId) {
        await inventoryService.deleteInventoryItem(targetItemId);
      }
      if (targetProdId) {
        await productService.deleteProduct(targetProdId);
      }
    } catch (err) {
      console.warn("Error deleting inventory item via service:", err);
    }

    // Filter out from local state after deletion
    const updatedInventory = inventory.filter((item) => item.id !== targetItemId && item.productId !== targetProdId);
    syncInventory(updatedInventory);

    const updatedProducts = products.filter((p) => p.id !== targetProdId);
    syncProducts(updatedProducts);

    addNotification("Produit retiré de votre stock avec succès.");
  };

  const handleClearMyCatalog = async () => {
    if (!currentUser) return;
    const shouldClear = window.confirm("Voulez-vous vraiment effacer tous les articles fictifs et réels de votre catalogue stock pour recommencer manuellement ? Cette action est irréversible.");
    if (!shouldClear) return;

    // Filter items owned by user or having mock prefixes
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

    // Local state filter
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

  // Direct chat send messaging
  const handleSendMessage = (text: string, receiverId: string) => {
    if (!currentUser) return;
    const fresh: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.companyName || currentUser.name,
      senderRole: currentUser.role,
      receiverId,
      text,
      timestamp: new Date().toISOString()
    };
    syncMessages([...messages, fresh]);
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

        // Check if there is an order relationship or a connection
        const hasOrder = orders.some(o => 
          (o.senderId === currentUser.id && o.receiverId === u.id) ||
          (o.senderId === u.id && o.receiverId === currentUser.id)
        );

        const hasConnection = realConnections.some(c => 
          ((c.senderId === currentUser.id && c.receiverId === u.id) ||
           (c.senderId === u.id && c.receiverId === currentUser.id)) && 
          isConnectionActive(c)
        );

        const isLightClient = lightClients.some(lc => 
          lc.ownerId === currentUser.id && lc.linkedUserId === u.id
        );

        const isWholesalerSupplier = (currentUser.role === UserRole.RETAILER || currentUser.role === UserRole.SEMI_WHOLESALER || currentUser.role === UserRole.CLIENT) && 
          (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER);

        return hasOrder || hasConnection || isLightClient || isWholesalerSupplier;
      })
    : users) as UserProfile[], [isRealUserAuthenticated, users, currentUser, orders, realConnections, lightClients]);

  const displayProducts = useMemo(() => deduplicate(isRealUserAuthenticated
    ? products.filter(p => {
        if (!currentUser) return false;
        if (currentUser.role === UserRole.ADMIN) return true;
        const isMine = p.creatorId === currentUser.id || inventory.some(i => i.productId === p.id && i.ownerId === currentUser.id);
        if (isMine) return true;
        
        // Include products from partners we are connected to or linked in lightClients
        const isPartnerInventory = inventory.some(i => i.productId === p.id && (
          realConnections.some(c => 
            ((c.senderId === currentUser.id && c.receiverId === i.ownerId) || (c.senderId === i.ownerId && c.receiverId === currentUser.id)) && isConnectionActive(c)
          ) ||
          lightClients.some(lc => lc.ownerId === currentUser.id && lc.linkedUserId === i.ownerId)
        ));

        // Also allow products from Wholesalers/Semi-Wholesalers so Retailers can browse and order
        const isWholesalerProd = inventory.some(i => i.productId === p.id && users.some(u => u.id === i.ownerId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER))) ||
          users.some(u => u.id === p.creatorId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER));

        return isPartnerInventory || isWholesalerProd;
      })
    : products) as Product[], [isRealUserAuthenticated, products, currentUser, inventory, realConnections, lightClients, users]);

  const displayInventory = useMemo(() => {
    console.log("[DEBUG displayInventory] currentUser:", currentUser?.id, "realConnections:", realConnections);
    return deduplicate(isRealUserAuthenticated
      ? inventory.filter(i => {
          if (!currentUser) return false;
          if (i.ownerId === currentUser.id) return true;
          
          // Include inventory from partners we are connected to or linked in lightClients
          const isConnectedPartner = realConnections.some(c => 
            ((c.senderId === currentUser.id && c.receiverId === i.ownerId) || (c.senderId === i.ownerId && c.receiverId === currentUser.id)) && isConnectionActive(c)
          );

          const isLightClientPartner = lightClients.some(lc => 
            lc.ownerId === currentUser.id && lc.linkedUserId === i.ownerId
          );

          // Include inventory from Wholesalers/Semi-Wholesalers for Retailer replenishment
          const isWholesalerOwner = users.some(u => u.id === i.ownerId && (u.role === UserRole.WHOLESALER || u.role === UserRole.SEMI_WHOLESALER));

          return isConnectedPartner || isLightClientPartner || isWholesalerOwner;
        })
      : inventory) as InventoryItem[];
  }, [isRealUserAuthenticated, inventory, currentUser, realConnections, lightClients, users]);

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
      ? displayUsers 
      : displayUsers.filter(u => {
          if (u.id === currentUser?.id || u.role === UserRole.ADMIN) return true;
          const userCountry = u.country || (u as any).pays || "";
          return userCountry.toLowerCase().trim() === selectedCountryFilter.toLowerCase().trim();
        });
    return deduplicateUsers(rawList);
  }, [displayUsers, selectedCountryFilter, currentUser?.id]);

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col transition duration-300">
      {/* Premium Header App Bar */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 sticky top-0 z-40 transition-colors relative">
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
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
          </div>

          {/* Quick Active Actions (Scan, AI, Chat, Stats) */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setShowScanner(!showScanner)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showScanner ? "bg-emerald-600 text-white border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
              id="header-scanner-toggle"
            >
              <Scan className="w-4 h-4" /> Scanner Code-barres
            </button>
            <button
              onClick={() => setShowAICopilot(!showAICopilot)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showAICopilot ? "bg-indigo-600 text-white border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
              id="header-ai-toggle"
            >
              <Sparkles className="w-4 h-4 text-amber-500" /> IA Forecasting
            </button>
            <button
              onClick={() => setShowSupportModal(true)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showSupportModal ? "bg-emerald-600 text-white border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
              id="header-support-toggle"
            >
              <HelpCircle className="w-4 h-4 text-emerald-500" /> Support
            </button>
            <button
              onClick={() => setShowReports(!showReports)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showReports ? "bg-rose-600 text-white border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
              id="header-reports-toggle"
            >
              <BarChart2 className="w-4 h-4" /> Rapports & Analytique
            </button>
            <button
              onClick={() => {
                setShowPitchDeck(!showPitchDeck);
                setShowScanner(false);
                setShowAICopilot(false);
                setShowReports(false);
                setShowChat(false);
              }}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showPitchDeck ? "bg-amber-600 text-white border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
              id="header-pitchdeck-toggle"
            >
              <Presentation className="w-4 h-4 text-amber-500 animate-pulse" /> Pitch Deck
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showChat ? "bg-blue-600 text-white border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
              }`}
              id="header-chat-toggle"
            >
              <MessageSquare className="w-4 h-4" /> Messagerie
            </button>
            <button
              onClick={() => setShowPaiementsAValider(!showPaiementsAValider)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                showPaiementsAValider ? "bg-amber-600 text-white border-transparent" : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 hover:bg-amber-100"
              }`}
              id="header-paiements-toggle"
              title="Validation des paiements Mobile Money (Orange Money, Moov Money, Wave)"
            >
              <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Paiements Mobile Money
            </button>
          </div>

          {/* Right Header Operations */}
          <div className="flex items-center gap-2.5">

            {/* Real-time Synchronization Status Badge / Spinner */}
            <div className="flex items-center">
              {syncStatus.isSyncing ? (
                <button
                  onClick={() => syncService.processQueue()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-100 transition shadow-xs"
                  title="Traitement de la file de synchronisation en cours..."
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Synchro...</span>
                  <span className="bg-amber-200 dark:bg-amber-800/80 px-1.5 py-0.5 rounded-md text-[10px]">
                    {syncStatus.progress}%
                  </span>
                </button>
              ) : syncStatus.pendingCount > 0 ? (
                <button 
                  onClick={() => syncService.processQueue()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                  title="Cliquer pour forcer la synchronisation"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Synchro</span>
                  <span className="bg-indigo-200 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    {syncStatus.pendingCount}
                  </span>
                </button>
              ) : (
                <div 
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 rounded-xl text-[11px] font-semibold"
                  title="Toutes les opérations sont synchronisées"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden xl:inline">Synchro OK</span>
                </div>
              )}
            </div>
            {/* Mobile Outils Menu Dropdown Button */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setShowMobileToolsMenu(!showMobileToolsMenu)}
                className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                id="mobile-tools-menu-btn"
                title="Menu Outils"
              >
                <LayoutGrid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden xs:inline">Menu Outils</span>
              </button>

              {showMobileToolsMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 font-extrabold text-[10px] uppercase text-zinc-400">
                    Outils & Services Mobiles
                  </div>
                  <div className="py-1 space-y-1">
                    <button
                      onClick={() => { setShowScanner(!showScanner); setShowMobileToolsMenu(false); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showScanner ? "bg-emerald-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <Scan className="w-4 h-4 text-emerald-500" />
                      <span>Scanner Code-barres</span>
                    </button>
                    <button
                      onClick={() => { setShowAICopilot(!showAICopilot); setShowMobileToolsMenu(false); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showAICopilot ? "bg-indigo-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>IA Forecasting</span>
                    </button>
                    <button
                      onClick={() => { setShowPaiementsAValider(!showPaiementsAValider); setShowMobileToolsMenu(false); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showPaiementsAValider ? "bg-amber-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-amber-500" />
                      <span>Paiements Mobile Money</span>
                    </button>
                    <button
                      onClick={() => { setShowSupportModal(true); setShowMobileToolsMenu(false); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showSupportModal ? "bg-emerald-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <HelpCircle className="w-4 h-4 text-emerald-500" />
                      <span>Support & FAQ IA</span>
                    </button>
                    <button
                      onClick={() => { setShowReports(!showReports); setShowMobileToolsMenu(false); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showReports ? "bg-rose-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <BarChart2 className="w-4 h-4 text-rose-500" />
                      <span>Rapports & Analytique</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowPitchDeck(!showPitchDeck);
                        setShowScanner(false);
                        setShowAICopilot(false);
                        setShowReports(false);
                        setShowChat(false);
                        setShowMobileToolsMenu(false);
                      }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showPitchDeck ? "bg-amber-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <Presentation className="w-4 h-4 text-amber-500" />
                      <span>Pitch Deck</span>
                    </button>
                    <button
                      onClick={() => { setShowChat(!showChat); setShowMobileToolsMenu(false); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left cursor-pointer ${
                        showChat ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                      <span>Messagerie</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Online PWA bar */}
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full font-bold">
              <Globe className="w-3 h-3 text-emerald-500" /> PWA Installable (Hors-ligne OK)
            </span>

            {/* Theme Toggle */}
            <button
              onClick={() => {
                if (autoSystemTheme) setAutoSystemTheme(false);
                setDarkMode(!darkMode);
              }}
              className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-750 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-600 dark:text-zinc-300 cursor-pointer"
              id="theme-toggle-btn"
              title="Basculer Mode Clair / Sombre"
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Auto System Theme Sync Toggle */}
            <button
              onClick={() => setAutoSystemTheme(!autoSystemTheme)}
              title={autoSystemTheme ? "Synchronisation auto système activée" : "Activer la synchro auto système"}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                autoSystemTheme 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-750 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" /> 
              <span className="hidden md:inline">Sync Système</span>
            </button>

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
                className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-750 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-600 dark:text-zinc-300 relative cursor-pointer"
                id="notifications-bell-btn"
                title="Notifications Push Système"
              >
                <Bell className="w-4.5 h-4.5" />
                {realNotifications.some((n) => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>
              
              {/* Push Notifications Drawer */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden py-2 z-50 animate-[fadeIn_0.2s_ease]">
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
                    <span>🔔 Alertes Push Vendeurs (Stock & Paiement)</span>
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
                        const isConnRequest = n.type === "CONNECTION_REQUEST" && n.relatedId;
                        const relatedConn = isConnRequest 
                          ? (realConnections.find(c => c.id === n.relatedId) || db.getConnections().find(c => c.id === n.relatedId))
                          : null;
                        const isPending = relatedConn?.status === "en_attente";

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
                                  onClick={() => connectionService.markNotificationAsRead(n.id)}
                                  className="text-[8px] text-emerald-600 hover:underline shrink-0"
                                >
                                  Marquer lu
                                </button>
                              )}
                            </div>

                            {isConnRequest && isPending && relatedConn && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await connectionService.respondToConnectionRequest(relatedConn, "active");
                                    connectionService.markNotificationAsRead(n.id);
                                    addNotification("Invitation acceptée !");
                                  }}
                                  className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1"
                                >
                                  <UserCheck className="w-3 h-3" /> Accepter
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await connectionService.respondToConnectionRequest(relatedConn, "refusée");
                                    connectionService.markNotificationAsRead(n.id);
                                  }}
                                  className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-[9px] font-bold transition"
                                >
                                  <UserX className="w-3 h-3" /> Refuser
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

            {/* Diagnostic Button */}
            <button
              onClick={() => setShowDiagnostic(!showDiagnostic)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                showDiagnostic 
                  ? "bg-emerald-600 text-white" 
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-100"
              }`}
              title="Audit & Diagnostic de la persistance serveur"
              id="diagnostic-btn"
            >
              <ShieldCheck className="w-4 h-4" /> Diagnostic
            </button>

            {/* Auth Simulation button */}
            <button
              onClick={async () => {
                if (isRealUserAuthenticated) {
                  await firebaseLogout();
                  setFbMsg({ type: "success", text: "Déconnecté de Firebase." });
                  setCurrentUser(null);
                  setIsAuthScreen(true);
                } else {
                  setIsAuthScreen(!isAuthScreen);
                }
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              id="auth-toggle-btn"
            >
              <LogIn className="w-4 h-4" /> {isRealUserAuthenticated ? "Déconnexion" : "Connexion"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sticky Quick Menu Strip (Horizontal Swipeable Pill Bar) */}
      <div className="lg:hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 px-3 py-2 overflow-x-auto scrollbar-none shadow-xs sticky top-16 z-30 flex items-center gap-2">
        <button
          onClick={() => setShowScanner(!showScanner)}
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition cursor-pointer ${
            showScanner ? "bg-emerald-600 text-white border-transparent shadow-sm" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          <Scan className="w-3.5 h-3.5" /> Scanner
        </button>
        <button
          onClick={() => setShowAICopilot(!showAICopilot)}
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition cursor-pointer ${
            showAICopilot ? "bg-indigo-600 text-white border-transparent shadow-sm" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> IA Forecasting
        </button>
        <button
          onClick={() => setShowReports(!showReports)}
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition cursor-pointer ${
            showReports ? "bg-rose-600 text-white border-transparent shadow-sm" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Rapports & Analytique
        </button>
        <button
          onClick={() => {
            setShowPitchDeck(!showPitchDeck);
            setShowScanner(false);
            setShowAICopilot(false);
            setShowReports(false);
            setShowChat(false);
          }}
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition cursor-pointer ${
            showPitchDeck ? "bg-amber-600 text-white border-transparent shadow-sm" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          <Presentation className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Pitch Deck
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition cursor-pointer ${
            showChat ? "bg-blue-600 text-white border-transparent shadow-sm" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Messagerie
        </button>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {(!currentUser || isAuthScreen) ? (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg mx-auto space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-600" /> WakatMarket - Portail de Connexion
              </h4>
              {currentUser && (
                <button onClick={() => setIsAuthScreen(false)} className="text-zinc-500 hover:text-zinc-950 font-bold cursor-pointer">✕</button>
              )}
            </div>

            {/* Config Info Banner as requested in requirement #5 */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/10 p-3.5 rounded-xl text-[10px] text-zinc-600 dark:text-zinc-300 space-y-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1">🔥 Firebase utilisé (Production)</p>
              <div><span className="font-semibold text-zinc-400">Project ID :</span> <span className="font-mono text-zinc-800 dark:text-zinc-200">campusbf</span></div>
              <div><span className="font-semibold text-zinc-400">Auth Domain :</span> <span className="font-mono text-zinc-800 dark:text-zinc-200">campusbf.firebaseapp.com</span></div>
              <div><span className="font-semibold text-zinc-400">Storage :</span> <span className="font-mono text-zinc-800 dark:text-zinc-200">Supabase</span></div>
            </div>

            {/* Error/Success Feedbacks */}
            {fbMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${fbMsg.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-500/10" : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-500/10"}`}>
                <Info className="w-4 h-4 shrink-0" />
                <span className="leading-tight">{fbMsg.text}</span>
              </div>
            )}

            {/* Main Tabs switcher */}
            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl text-xs font-semibold">
              <button
                onClick={() => { setFbAuthMode("signin"); setFbMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${fbAuthMode === "signin" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                Connexion
              </button>
              <button
                onClick={() => { setFbAuthMode("signup"); setFbMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${fbAuthMode === "signup" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                Inscription
              </button>
              <button
                onClick={() => { setFbAuthMode("phone"); setFbMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${fbAuthMode === "phone" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                OTP Téléphone
              </button>
              <button
                onClick={() => { setFbAuthMode("reset"); setFbMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${fbAuthMode === "reset" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                RàP
              </button>
            </div>

            {/* Email/Password Login Mode */}
            {fbAuthMode === "signin" && (
              <div className="space-y-5">
                <form onSubmit={handleFbLogin} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">E-mail de connexion</label>
                    <input
                      type="email"
                      required
                      placeholder="Saisir votre adresse e-mail..."
                      value={fbEmail}
                      onChange={(e) => setFbEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Mot de passe</label>
                    <input
                      type="password"
                      required
                      placeholder="Saisir le mot de passe..."
                      value={fbPassword}
                      onChange={(e) => setFbPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="fb-persist"
                      checked={fbPersist}
                      onChange={(e) => {
                        setFbPersist(e.target.checked);
                        authService.configureSessionPersistence(e.target.checked);
                      }}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <label htmlFor="fb-persist" className="text-[11px] text-zinc-500 dark:text-zinc-400 cursor-pointer selection:bg-transparent">
                      Se souvenir de moi sur cet appareil (Persistance locale)
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Se connecter à WakatMarket
                  </button>
                </form>
              </div>
            )}

            {/* Email/Password Signup Mode */}
            {fbAuthMode === "signup" && (
              <form onSubmit={handleFbSignUp} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Prénom</label>
                    <input
                      type="text"
                      required
                      placeholder="Jean"
                      value={fbPrénom}
                      onChange={(e) => setFbPrénom(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Nom</label>
                    <input
                      type="text"
                      required
                      placeholder="Ouédraogo"
                      value={fbNom}
                      onChange={(e) => setFbNom(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Adresse e-mail d'inscription</label>
                  <input
                    type="email"
                    required
                    placeholder="Saisir votre adresse e-mail d'inscription..."
                    value={fbEmail}
                    onChange={(e) => setFbEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      required
                      placeholder="+226 70 00 00 00"
                      value={fbTéléphone}
                      onChange={(e) => setFbTéléphone(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Rôle plateforme</label>
                     <select
                      value={fbRôle}
                      onChange={(e) => setFbRôle(e.target.value as UserRole)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-bold text-emerald-600"
                    >
                      <option value={UserRole.CLIENT}>Client (B2C Market)</option>
                      <option value={UserRole.RETAILER}>Détaillant (POS Boutique)</option>
                      <option value={UserRole.SEMI_WHOLESALER}>Demi-Grossiste (Vente Hybride)</option>
                      <option value={UserRole.WHOLESALER}>Grossiste (Procurement B2B)</option>
                      <option value={UserRole.MANUFACTURER}>Fabricant (Usine B2B)</option>
                      <option value={UserRole.DRIVER_R2C}>Livreur Détaillant➔Client</option>
                      <option value={UserRole.DRIVER_W2R}>Livreur Grossiste➔Détaillant</option>
                      <option value={UserRole.DRIVER_W2SG}>Livreur Grossiste➔Demi-Grossiste</option>
                      <option value={UserRole.DRIVER_SG2R}>Livreur Demi-Grossiste➔Détaillant</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Geographic fields for Business Roles */}
                {[
                  UserRole.MANUFACTURER,
                  UserRole.WHOLESALER,
                  UserRole.SEMI_WHOLESALER,
                  UserRole.RETAILER
                ].includes(fbRôle) && (
                  <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-850/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <p className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">📍 Situation géographique de l'entreprise</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-[10px]">Pays</label>
                        <input
                          type="text"
                          required
                          placeholder="Burkina Faso"
                          value={fbPays}
                          onChange={(e) => setFbPays(e.target.value)}
                          className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-[10px]">Ville</label>
                        <input
                          type="text"
                          required
                          placeholder="Ouagadougou"
                          value={fbVille}
                          onChange={(e) => setFbVille(e.target.value)}
                          className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-[10px]">Quartier</label>
                        <input
                          type="text"
                          required
                          placeholder="Ouaga 2000"
                          value={fbQuartier}
                          onChange={(e) => setFbQuartier(e.target.value)}
                          className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setGeoLoading(true);
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                setFbLatitude(pos.coords.latitude);
                                setFbLongitude(pos.coords.longitude);
                                setGeoLoading(false);
                                setFbMsg({ type: "success", text: `Coordonnées GPS récupérées : Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}` });
                              },
                              (err) => {
                                setGeoLoading(false);
                                setFbMsg({ type: "error", text: "Impossible de récupérer votre position GPS actuelle." });
                              }
                            );
                          } else {
                            setGeoLoading(false);
                            setFbMsg({ type: "error", text: "La géolocalisation n'est pas supportée par votre navigateur." });
                          }
                        }}
                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-750 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {geoLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                        Détecter les coordonnées GPS (Optionnel)
                      </button>
                      {fbLatitude !== undefined && fbLongitude !== undefined && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          📍 {fbLatitude.toFixed(4)}, {fbLongitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Saisir un mot de passe fort..."
                    value={fbPassword}
                    onChange={(e) => setFbPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Créer mon profil Firebase
                </button>
              </form>
            )}

            {/* Option to Disconnect Firebase User if signed in */}
            {firebaseUser && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[11px]">
                <span className="text-zinc-500 font-medium">Connecté: <strong className="text-emerald-600">{firebaseUser.email || firebaseUser.phoneNumber}</strong></span>
                <button
                  onClick={async () => {
                    await firebaseLogout();
                    setFbMsg({ type: "success", text: "Déconnecté de Firebase." });
                  }}
                  className="text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Se déconnecter de Firebase
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Active User Header Widget */}
            {currentUser && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs transition-colors">
                <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
                      <h2 className="font-bold text-zinc-950 dark:text-white text-base">
                        {currentUser.companyName || currentUser.name}
                      </h2>
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {currentUser.role}
                      </span>
                      <button
                        onClick={handleOpenProfileEdit}
                        className="text-[10px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                        title="Modifier le profil"
                      >
                        <UserCog className="w-3 h-3" /> Modifier
                      </button>
                      <button
                        onClick={handleClearMyCatalog}
                        className="text-[10px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer border border-rose-200/50 dark:border-rose-900/30"
                        title="Effacer tout mon catalogue pour le renseigner manuellement"
                      >
                        <Trash2 className="w-3 h-3" /> Vider mon stock
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Hiérarchie Géographique : <span className="font-semibold text-zinc-700 dark:text-zinc-300">{currentUser.country} - {currentUser.region}</span>
                    </p>
                  </div>
                </div>

                {/* Local Balances or Stats */}
                <div className="text-center md:text-right bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 min-w-[150px]">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">Solde de Transaction</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {currentUser.balance !== undefined ? formatCFA(currentUser.balance) : "—"}
                  </p>
                </div>
              </div>
            )}

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

              {showPitchDeck && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative z-30 mb-8"
                >
                  <PitchDeck onClose={() => setShowPitchDeck(false)} />
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
                    <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-150 dark:border-zinc-800">
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
            </AnimatePresence>
          </>
        )}

        {/* Geographical Country Filter Dropdown Bar */}
        <section className="mb-4">
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
                  <option value="ALL">🌍 Tous les pays (Afrique de l'Ouest)</option>
                  {availableCountries.map((c, idx) => (
                    <option key={`country_${c}_${idx}`} value={c}>
                      📍 {c}
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
        <section className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
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
                  connections={realConnections}
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
                  connections={realConnections}
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
                  connections={realConnections}
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
                  connections={realConnections}
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

        {/* Product Detail Modal with Recharts 30-Day Price History */}
        {viewingProductDetail && (
          <ProductDetailModal
            product={viewingProductDetail.product}
            inventoryItem={viewingProductDetail.inventoryItem}
            onClose={() => setViewingProductDetail(null)}
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

        {/* Admin Password Challenge Reset Modal */}
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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
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
                <span>🚀 Visite Guidée (Onboarding)</span>
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
