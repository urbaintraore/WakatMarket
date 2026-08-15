import React, { useState } from "react";
import { motion } from "motion/react";
import { UserCog, X, Save, History, Box, ShoppingCart, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { UserProfile, UserRole, Order, Product } from "../types";
import { formatCFA } from "../data";

export function AdminUserEditModal({
  user,
  orders,
  products,
  onClose,
  onSave,
  onDeleteUser
}: {
  user: UserProfile;
  orders: Order[];
  products: Product[];
  onClose: () => void;
  onSave: (userId: string, updates: Partial<UserProfile>) => void;
  onDeleteUser?: (userId: string) => void;
}) {
  const [formData, setFormData] = useState({
    name: user.name || "",
    companyName: user.companyName || "",
    phone: user.phone || "",
    country: user.country || "",
    region: user.region || "",
    sector: user.sector || "",
    role: user.role
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{type: "error"|"success", text: string} | null>(null);

  const userOrders = orders.filter(o => o.senderId === user.id || o.receiverId === user.id);
  const userProducts = products.filter(p => p.creatorId === user.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(user.id, formData);
      setMsg({ type: "success", text: "Profil mis à jour." });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setMsg({ type: "error", text: "Erreur de mise à jour." });
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-850">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div className="text-left">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Gérer l'utilisateur</h3>
              <p className="text-[10px] text-zinc-500">Edition du profil et historique: {user.companyName || user.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Editor Form */}
          <div className="w-full md:w-1/2 p-4 overflow-y-auto border-r border-zinc-150 dark:border-zinc-800 custom-scrollbar">
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCog className="w-4 h-4" /> Modification Profil
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              {msg && (
                <div className={`p-3 rounded-xl flex items-start gap-2 ${msg.type === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {msg.type === "error" ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 mt-0.5" />}
                  <p className="text-xs font-medium">{msg.text}</p>
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Nom complet</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Nom de l'entreprise</label>
                  <input type="text" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Téléphone</label>
                    <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Rôle</label>
                    <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                      {Object.values(UserRole).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Pays</label>
                    <input type="text" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Ville</label>
                    <input type="text" value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-xs">Quartier</label>
                    <input type="text" value={formData.sector} onChange={(e) => setFormData({...formData, sector: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center gap-2">
                {onDeleteUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteUser(user.id);
                      onClose();
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg font-bold text-sm flex items-center gap-2 transition cursor-pointer"
                  >
                    Supprimer le compte
                  </button>
                )}
                <button disabled={isSaving} type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 flex items-center gap-2 transition cursor-pointer ml-auto">
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              </div>
            </form>
          </div>

          {/* Activity Section */}
          <div className="w-full md:w-1/2 p-4 bg-zinc-50 dark:bg-zinc-850/50 overflow-y-auto custom-scrollbar space-y-6">
            <div>
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> Historique d'Activité
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-zinc-500">Commandes</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white">{userOrders.length}</p>
                </div>
                {user.role === UserRole.MANUFACTURER && (
                  <div className="bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Box className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-zinc-500">Produits Créés</span>
                    </div>
                    <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white">{userProducts.length}</p>
                  </div>
                )}
              </div>

              {/* Recent Orders List */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">5 Dernières Commandes</h5>
                {userOrders.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Aucune commande trouvée.</p>
                ) : (
                  userOrders.slice(0, 5).map(o => (
                    <div key={o.id} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-150 dark:border-zinc-700 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-[10px] text-zinc-500">{o.id.substring(0,8)}...</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                          o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                          o.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{o.status}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">{formatCFA(o.totalAmount)}</span>
                        <span className="text-[10px] text-zinc-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
