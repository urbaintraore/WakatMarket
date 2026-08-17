import React, { useState, useRef } from "react";
import { X, Upload, Link as LinkIcon, Package, Calendar, Layers, Box, Tag, DollarSign, CheckCircle2 } from "lucide-react";
import { Product, UserRole } from "../types";
import { formatCFA } from "../data";
import { productService } from "../services/productService";

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    productData: Omit<Product, "id" | "creatorId">,
    initialStock: number,
    price: number,
    prixGros?: number,
    prixDetail?: number,
    quantiteMinimum?: number,
    threshold?: number,
    expirationDate?: string
  ) => void;
  currentUserRole?: UserRole;
  defaultBrand?: string;
}

export const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUserRole,
  defaultBrand = ""
}) => {
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Alimentation");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [brand, setBrand] = useState(defaultBrand);
  const [unit, setUnit] = useState("Carton de 24");
  const [weight, setWeight] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(0.05);

  // Physical specs & dates
  const [expirationDate, setExpirationDate] = useState("");

  // Stock & Pricing
  const [stock, setStock] = useState<number>(100);
  const [threshold, setThreshold] = useState<number>(10);
  const [price, setPrice] = useState<number>(5000);
  const [prixGros, setPrixGros] = useState<number>(4500);
  const [prixDetail, setPrixDetail] = useState<number>(5500);
  const [quantiteMinimum, setQuantiteMinimum] = useState<number>(1);

  // Upload image state
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP, etc.).");
      return;
    }
    setIsUploading(true);
    try {
      // Direct upload to Supabase Storage (MonBucket)
      const res = await productService.uploadProductImage(file);
      if (res?.publicUrl) {
        setUploadedImage(res.publicUrl);
      }
    } catch (err: any) {
      console.warn("Upload Supabase échoué, bascule vers Data URL locale:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setUploadedImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Veuillez saisir un nom pour le produit.");
      return;
    }

    const finalImage = uploadedImage || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300";

    const productData: Omit<Product, "id" | "creatorId"> = {
      name: name.trim(),
      description: description.trim() || "Aucune description renseignée.",
      category: category.trim() || "Général",
      brand: brand.trim() || defaultBrand || "Marque Générique",
      unit: unit.trim() || "Unité",
      weight: Number(weight) || 0,
      volume: Number(volume) || 0,
      image: finalImage,
      imageUrl: uploadMode === "url" && uploadedImage.startsWith("http") ? uploadedImage : undefined,
      barcode: Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
      qrCode: `QR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      expirationDate: expirationDate || undefined,
      prixGros: Number(prixGros) || Number(price),
      prixDetail: Number(prixDetail) || Number(price),
      quantiteMinimum: Number(quantiteMinimum) || 1,
      lowStockThreshold: Number(threshold) || 10,
    };

    onSubmit(
      productData,
      Number(stock) || 0,
      Number(price) || 0,
      Number(prixGros) || Number(price),
      Number(prixDetail) || Number(price),
      Number(quantiteMinimum) || 1,
      Number(threshold) || 10,
      expirationDate || undefined
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-zinc-950 dark:text-white">
                Ajouter un Produit au Stock
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Définissez les spécifications, caractéristiques physiques, tarifs et niveaux de stock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* Section 1: Identité Produit & Visuel */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <Tag className="w-4 h-4" /> 1. Identité du Produit & Illustration
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nom du Produit *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Eau Minérale 1.5L, Riz Parfumé 25kg..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description complète du produit, spécifications, ingrédients..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
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
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Marque / Fabricant
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Marque"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Unité de Conditionnement *
                  </label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="ex: Carton de 24 bouteilles, Sac de 50kg..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Upload Image Section (Supabase Storage) */}
              <div className="space-y-3">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Illustration du Produit (Fichier Supabase / URL)
                </label>
                
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setUploadMode("file")}
                    className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadMode === "file"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-500 hover:text-zinc-850"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" /> Fichier (Supabase)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode("url")}
                    className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadMode === "url"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-500 hover:text-zinc-850"
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Lien Web URL
                  </button>
                </div>

                {uploadMode === "file" ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${
                      isDragging
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                        : "border-zinc-200 dark:border-zinc-750 hover:border-emerald-400 bg-zinc-50/50 dark:bg-zinc-800/40"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    {isUploading ? (
                      <div className="space-y-2 text-center py-2">
                        <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
                        <p className="text-[11px] font-bold text-emerald-600">Stockage de l'image sur Supabase Storage...</p>
                      </div>
                    ) : uploadedImage ? (
                      <div className="space-y-2 w-full flex flex-col items-center">
                        <img
                          loading="lazy"
                          src={uploadedImage}
                          alt="Preview"
                          className="h-20 w-20 object-cover rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-700"
                        />
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Image enregistrée ! Cliquez pour modifier
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-7 h-7 text-zinc-400 mx-auto" />
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                          Glissez-déposez une image ou <span className="text-emerald-600 font-bold underline">parcourez vos fichiers</span>
                        </p>
                        <p className="text-[9px] text-zinc-400">Stockée directement sur Supabase • PNG, JPG, WEBP</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={uploadedImage}
                      onChange={(e) => setUploadedImage(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl"
                    />
                    {uploadedImage.startsWith("http") && (
                      <div className="flex items-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                        <img loading="lazy" src={uploadedImage} alt="Preview" className="h-10 w-10 object-cover rounded-lg" />
                        <span className="text-[10px] text-zinc-500 font-medium truncate">Aperçu du lien web</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Caractéristiques Physiques & Date de Péremption */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <Calendar className="w-4 h-4" /> 2. Caractéristiques Physiques & Date de Péremption
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
                <label className="block text-amber-950 dark:text-amber-300 font-bold mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" /> Date de Péremption
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-800 rounded-xl font-mono font-bold text-zinc-950 dark:text-white"
                />
                <span className="text-[9px] text-amber-700 dark:text-amber-400 mt-1 block font-medium">
                  {expirationDate ? `Expire le : ${new Date(expirationDate).toLocaleDateString("fr-FR")}` : "Optionnel (pour denrées périssables)"}
                </span>
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                  Poids Unitaire (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono"
                />
                <span className="text-[9px] text-zinc-400 mt-1 block">Utile pour le calcul des frais de transport</span>
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                  Volume Unitaire (m³)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono"
                />
                <span className="text-[9px] text-zinc-400 mt-1 block">Volume d'encombrement par unité</span>
              </div>
            </div>
          </div>

          {/* Section 3: Gestion de Stock & Tarifications */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <Layers className="w-4 h-4" /> 3. Quantité en Stock & Tarifications
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
                <label className="block text-emerald-900 dark:text-emerald-300 font-bold mb-1">
                  Quantité initiale en stock *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-800 rounded-xl font-mono text-base font-bold text-emerald-950 dark:text-white"
                />
                <span className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-1 block font-medium">
                  Nombre d'unités physiques disponibles
                </span>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
                <label className="block text-amber-900 dark:text-amber-300 font-bold mb-1">
                  Seuil d'alerte réapprovisionnement
                </label>
                <input
                  type="number"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-800 rounded-xl font-mono text-base font-bold text-amber-950 dark:text-white"
                />
                <span className="text-[9px] text-amber-700 dark:text-amber-400 mt-1 block font-medium">
                  Alerter si stock ≤ {threshold} unités
                </span>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                <label className="block text-blue-900 dark:text-blue-300 font-bold mb-1">
                  Prix de vente principal (CFA) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-800 rounded-xl font-mono text-base font-bold text-blue-950 dark:text-white"
                />
                <span className="text-[9px] text-blue-700 dark:text-blue-400 mt-1 block font-medium">
                  Tarif de référence : {formatCFA(price)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
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
                  {formatCFA(prixGros)}
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
                  {formatCFA(prixDetail)}
                </span>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">
                  Quantité Minimum (MOQ)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantiteMinimum}
                  onChange={(e) => setQuantiteMinimum(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono font-bold text-zinc-950 dark:text-white"
                />
                <span className="text-[9px] text-zinc-500 mt-1 block font-medium">
                  Commandes min : {quantiteMinimum} u
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
            >
              <Package className="w-4 h-4" /> Enregistrer & Injecter dans le Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
