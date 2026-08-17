import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Package,
  Save,
  Upload,
  Link as LinkIcon,
  AlertTriangle,
  Loader2,
  DollarSign,
  Layers,
  Calendar,
  Tag,
  Scale,
  Box,
  Trash2
} from "lucide-react";
import { Product, InventoryItem } from "../types";
import { formatCFA } from "../data";
import { productService } from "../services/productService";

interface EditProductStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  inventoryItem: InventoryItem | null;
  onSave: (
    productId: string,
    productData: Partial<Product>,
    inventoryItemId?: string,
    inventoryData?: Partial<InventoryItem>
  ) => void;
  onDelete?: (inventoryItemId: string, productId?: string) => void;
}

export function EditProductStockModal({
  isOpen,
  onClose,
  product,
  inventoryItem,
  onSave,
  onDelete
}: EditProductStockModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const PREDEFINED_CATEGORIES = [
    "Alimentation",
    "Boissons",
    "Électronique",
    "Quincaillerie",
    "Cosmétiques",
    "Hygiène & Entretien",
    "Vêtements & Mode",
    "Pharmacie / Santé",
    "Matériaux de construction",
    "Pièces de rechange",
    "Divers"
  ];

  const [category, setCategory] = useState("Alimentation");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("Carton");
  const [weight, setWeight] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [image, setImage] = useState("");

  // Inventory State
  const [stock, setStock] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(10);
  const [price, setPrice] = useState<number>(0);
  const [prixGros, setPrixGros] = useState<number>(0);
  const [prixDetail, setPrixDetail] = useState<number>(0);
  const [quantiteMinimum, setQuantiteMinimum] = useState<number>(1);
  const [expirationDate, setExpirationDate] = useState<string>("");

  useEffect(() => {
    if (isOpen && product) {
      setIsLoading(true);
      // Simulate quick loading effect as requested by user ("la page chargement s'ouvre")
      const timer = setTimeout(() => {
        setName(product.name || "");
        setDescription(product.description || "");
        const cat = product.category || "Alimentation";
        setCategory(cat);
        setIsCustomCategory(!PREDEFINED_CATEGORIES.includes(cat));
        setBrand(product.brand || "");
        setUnit(product.unit || "Carton");
        setWeight(product.weight || 0);
        setVolume(product.volume || 0);
        setImage(product.image || product.imageUrl || "");
        setUploadedImage(product.image || product.imageUrl || "");
        setExpirationDate(product.expirationDate || "");

        if (inventoryItem) {
          setStock(inventoryItem.stock || 0);
          setThreshold(inventoryItem.threshold || inventoryItem.lowStockThreshold || 10);
          setPrice(inventoryItem.price || product.prixGros || product.prixDetail || 0);
          setPrixGros(inventoryItem.prixGros || product.prixGros || inventoryItem.price || 0);
          setPrixDetail(inventoryItem.prixDetail || product.prixDetail || inventoryItem.price || 0);
          setQuantiteMinimum(inventoryItem.quantiteMinimum || product.quantiteMinimum || 1);
        } else {
          setStock(0);
          setThreshold(10);
          setPrice(product.prixGros || product.prixDetail || 0);
          setPrixGros(product.prixGros || 0);
          setPrixDetail(product.prixDetail || 0);
          setQuantiteMinimum(product.quantiteMinimum || 1);
        }
        setIsLoading(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, product, inventoryItem]);

  if (!isOpen || !product) return null;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP).");
      return;
    }
    setIsUploading(true);
    try {
      const res = await productService.uploadProductImage(file, product.creatorId, product.id);
      if (res?.publicUrl) {
        setUploadedImage(res.publicUrl);
        setImage(res.publicUrl);
      }
    } catch (err: any) {
      console.warn("Upload Supabase échoué, bascule vers Data URL locale:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const res = e.target.result as string;
          setUploadedImage(res);
          setImage(res);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalImage = uploadedImage || image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";

    const productData: Partial<Product> = {
      name,
      description,
      category,
      brand,
      unit,
      weight,
      volume,
      image: finalImage,
      prixGros,
      prixDetail,
      quantiteMinimum,
      expirationDate: expirationDate || undefined
    };

    const inventoryData: Partial<InventoryItem> = {
      stock,
      threshold,
      price,
      prixGros,
      prixDetail,
      quantiteMinimum,
      expirationDate: expirationDate || undefined
    };

    onSave(product.id, productData, inventoryItem?.id, inventoryData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                Page de Modification & Mise à jour de Stock
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Modifiez tous les paramètres du produit et la quantité en stock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Loading State */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            <div>
              <p className="font-bold text-sm text-zinc-900 dark:text-white">Chargement de la page d'édition...</p>
              <p className="text-xs text-zinc-500 mt-1">Récupération des données du produit et récents stocks</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            
            {/* 1. Informations Générales */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-zinc-150 dark:border-zinc-800 pb-2">
                <Tag className="w-4 h-4" /> Informations Générales du Produit
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Nom du Produit *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-semibold text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Marque / Marque Commerciale
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Catégorie *
                  </label>
                  {!isCustomCategory ? (
                    <div className="relative">
                      <select
                        value={PREDEFINED_CATEGORIES.includes(category) ? category : "AUTRE"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "AUTRE") {
                            setIsCustomCategory(true);
                            setCategory("");
                          } else {
                            setCategory(val);
                          }
                        }}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white appearance-none pr-8 cursor-pointer font-medium text-xs"
                      >
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="AUTRE">➕ Autre (saisir manuellement)...</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-[9px]">
                        ▼
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Saisir la catégorie..."
                        className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategory(false);
                          setCategory("Alimentation");
                        }}
                        className="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold transition text-[10px]"
                      >
                        Retour
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Unité de Conditionnement
                  </label>
                  <input
                    type="text"
                    value={unit}
                    placeholder="Sac, Carton, Bidon, Pièce..."
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Description Détaillée
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. Caractéristiques physiques : Date de péremption, Poids & Volume */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-zinc-150 dark:border-zinc-800 pb-2">
                <Calendar className="w-4 h-4" /> Caractéristiques physiques : Date de péremption & Spécifications
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Date de péremption
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono font-bold"
                  />
                  {expirationDate && (
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Péremption : {new Date(expirationDate).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Poids Unitaire (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Volume Unitaire (m³)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Upload Image Section */}
              <div className="space-y-2">
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold text-xs">
                  Image du Produit
                </label>
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold w-fit mb-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode("file")}
                    className={`px-3 py-1 rounded-lg transition ${
                      uploadMode === "file" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 inline mr-1" /> Importer un fichier
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode("url")}
                    className={`px-3 py-1 rounded-lg transition ${
                      uploadMode === "url" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500"
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5 inline mr-1" /> Lien URL
                  </button>
                </div>

                {uploadMode === "file" ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex items-center justify-between gap-4 ${
                      isDragging
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 bg-zinc-50 dark:bg-zinc-950/40"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      {(uploadedImage || image) && (
                        <img
                          src={uploadedImage || image}
                          alt="Aperçu"
                          className="w-14 h-14 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs"
                        />
                      )}
                      <div className="text-left">
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Cliquez ou glissez une nouvelle image
                        </p>
                        <p className="text-[10px] text-zinc-400">PNG, JPG, WEBP max 5Mo</p>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">
                      Parcourir
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => {
                        setImage(e.target.value);
                        setUploadedImage(e.target.value);
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white"
                    />
                    {image && (
                      <img
                        src={image}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Gestion de Stock & Tarifs */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-zinc-150 dark:border-zinc-800 pb-2">
                <Layers className="w-4 h-4" /> Gestion de Stock & Tarifs
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
                  <label className="block text-emerald-900 dark:text-emerald-300 font-bold mb-1">
                    Quantité en stock disponible *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-800 rounded-xl font-mono text-base font-bold text-emerald-950 dark:text-white"
                  />
                  <span className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-1 block font-medium">
                    Stock physique disponible en rayon / entrepôt
                  </span>
                </div>

                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
                  <label className="block text-amber-900 dark:text-amber-300 font-bold mb-1">
                    Seuil d'alerte de réapprovisionnement
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-800 rounded-xl font-mono text-base font-bold text-amber-950 dark:text-white"
                  />
                  <span className="text-[9px] text-amber-700 dark:text-amber-400 mt-1 block font-medium">
                    Déclencher alerte si stock ≤ {threshold}
                  </span>
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                  <label className="block text-blue-900 dark:text-blue-300 font-bold mb-1">
                    Prix de vente principal (CFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-800 rounded-xl font-mono text-base font-bold text-blue-950 dark:text-white"
                  />
                  <span className="text-[9px] text-blue-700 dark:text-blue-400 mt-1 block font-medium">
                    Tarif standard : {formatCFA(price)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Prix Gros B2B (CFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prixGros}
                    onChange={(e) => setPrixGros(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono font-bold text-zinc-950 dark:text-white"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block font-medium">
                    Tarif pour grossistes : {formatCFA(prixGros)}
                  </span>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Prix Détail (CFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prixDetail}
                    onChange={(e) => setPrixDetail(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono font-bold text-zinc-950 dark:text-white"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block font-medium">
                    Tarif au détail : {formatCFA(prixDetail)}
                  </span>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                    Quantité minimum de commande
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantiteMinimum}
                    onChange={(e) => setQuantiteMinimum(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono font-bold text-zinc-950 dark:text-white"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block font-medium">
                    Minimum : {quantiteMinimum} unité(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Annuler
                </button>
                {(inventoryItem || product) && onDelete && (
                  <div className="relative">
                    {showConfirmDelete ? (
                      <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900 p-3 rounded-xl shadow-xl w-64 z-50 animate-fade-in">
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Confirmer la suppression définitive ?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowConfirmDelete(false)}
                            className="flex-1 px-2 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(inventoryItem?.id || "", product?.id || "");
                              setShowConfirmDelete(false);
                              onClose();
                            }}
                            className="flex-1 px-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Oui, Supprimer
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(true)}
                      className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Supprimer du stock
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Enregistrer les Modifications
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
