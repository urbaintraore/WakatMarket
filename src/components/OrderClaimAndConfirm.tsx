import React, { useState } from "react";
import { CheckCircle, AlertOctagon, Mic, Send, X, MessageSquare, Download, Share2, Smartphone, CheckCircle2, AlertTriangle } from "lucide-react";
import { OrderStatus, Order, Product, UserProfile } from "../types";
import { jsPDF } from "jspdf";

interface Props {
  orderId: string;
  status: OrderStatus;
  onConfirmReceipt: () => void;
  onAddClaim?: (message: string) => void;
  order?: Order;
  products?: Product[];
  users?: UserProfile[];
}

export function OrderClaimAndConfirm({ 
  orderId, 
  status, 
  onConfirmReceipt, 
  onAddClaim,
  order,
  products,
  users
}: Props) {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimText, setClaimText] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleSendClaim = () => {
    if (onAddClaim) onAddClaim(claimText);
    setShowClaimModal(false);
    setClaimText("");
  };

  const startOrderChat = () => {
    window.dispatchEvent(new CustomEvent('start-chat', { detail: { contextId: orderId } }));
  };

  const isDeliveredOrShipped = status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED;

  // Invoice PDF Generation
  const handleExportPDF = () => {
    if (!order || !products || !users) return;

    try {
      const doc = new jsPDF();
      
      const seller = users.find(u => u.id === order.receiverId);
      const buyer = users.find(u => u.id === order.senderId);

      // Top Header accent bar
      doc.setFillColor(16, 185, 129); // Emerald-500
      doc.rect(0, 0, 210, 35, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("FACTURE COMMERCIALE / WAKAT ERP", 15, 22);

      // Metadata right-aligned
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`ID Facture: #${order.id}`, 135, 15);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`, 135, 21);
      doc.text(`Statut: ${order.status}`, 135, 27);

      // Seller / Buyer Information Blocks
      doc.setTextColor(30, 41, 59); // zinc-800
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Vendeur / Partenaire :", 15, 52);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`${seller?.companyName || seller?.name || "Partenaire Wakat ERP"}`, 15, 58);
      doc.text(`Contact: ${seller?.phone || "N/A"}`, 15, 64);
      doc.text(`Localisation: ${seller?.region || "N/A"}, ${seller?.country || "Burkina Faso"}`, 15, 70);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Acheteur / Client :", 115, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`${buyer?.companyName || buyer?.name || "Client Partenaire"}`, 115, 58);
      doc.text(`Contact: ${buyer?.phone || "N/A"}`, 115, 64);
      doc.text(`Adresse de livraison: ${order.deliveryAddress || "Non spécifiée"}`, 115, 70);

      // Items Table Header
      doc.setFillColor(30, 41, 59); // Dark blue gray header
      doc.rect(15, 85, 180, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Désignation de l'Article", 18, 90.5);
      doc.text("Qté", 115, 90.5);
      doc.text("Prix Unit. (CFA)", 135, 90.5);
      doc.text("Total (CFA)", 165, 90.5);

      // Table Row Loop
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      let currentY = 100;
      order.items.forEach((item, index) => {
        const prod = products.find(p => p.id === item.productId);
        const prodName = prod ? prod.name : "Produit";
        const totalLine = item.quantity * item.priceAtOrder;

        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(15, currentY - 5, 180, 7, "F");
        }

        doc.text(prodName, 18, currentY);
        doc.text(item.quantity.toString(), 115, currentY);
        doc.text(`${item.priceAtOrder.toLocaleString()} FCFA`, 135, currentY);
        doc.text(`${totalLine.toLocaleString()} FCFA`, 165, currentY);

        currentY += 8;
      });

      // Horizontal separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(15, currentY + 2, 195, currentY + 2);

      // Totals and Summary Block
      currentY += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Frais de livraison :", 115, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(`${(order.shippingFee || 0).toLocaleString()} FCFA`, 165, currentY);

      currentY += 7;
      doc.setFont("helvetica", "bold");
      doc.text("Montant Global :", 115, currentY);
      doc.setTextColor(16, 185, 129); // Emerald color
      doc.text(`${order.totalAmount.toLocaleString()} FCFA`, 165, currentY);

      // Payment Status Badge
      currentY += 15;
      doc.setFillColor(order.paymentStatus === "PAID" ? 209 : 254, order.paymentStatus === "PAID" ? 250 : 226, order.paymentStatus === "PAID" ? 229 : 226); // emerald-100 or rose-100
      doc.rect(15, currentY - 6, 60, 8, "F");
      doc.setTextColor(order.paymentStatus === "PAID" ? 6 : 153, order.paymentStatus === "PAID" ? 95 : 27, order.paymentStatus === "PAID" ? 70 : 27); // emerald-700 or rose-700
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`PAIEMENT: ${order.paymentStatus === "PAID" ? "RÉGLÉ / PAYÉ" : "EN ATTENTE / DU"}`, 18, currentY - 0.5);

      // Footer notice
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("Wakat ERP - Solution Intelligente de Gestion Commerciale des Chaines de Valeur", 15, 285);

      doc.save(`Facture_Wakat_${order.id}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Erreur lors de la génération de la facture PDF.");
    }
  };

  // WhatsApp Coordination link generator
  const getWhatsAppLink = (recipientPhone?: string) => {
    if (!order || !products) return "";

    const itemsText = order.items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return `- ${prod?.name || "Produit"}: x${item.quantity}`;
    }).join("\n");

    const message = `Bonjour! Suivi livraison pour la commande *#${order.id}* sur Wakat ERP:
${itemsText}
*Total:* ${order.totalAmount.toLocaleString()} FCFA
*Adresse de livraison:* ${order.deliveryAddress || "Non spécifiée"}
*Mode de Paiement:* ${order.paymentMethod || "Non spécifié"}`;

    const cleanPhone = recipientPhone ? recipientPhone.replace(/[^0-9]/g, "") : "";
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const buyerProfile = order && users ? users.find(u => u.id === order.senderId) : null;
  const driverProfile = order && users && order.driverId ? users.find(u => u.id === order.driverId) : null;

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-end items-center mt-3 border-t border-zinc-150 dark:border-zinc-800 pt-3">
        {/* Mobile Money Payment Proof Action & Badge */}
        {order && (
          <>
            {(!order.statutPaiement || order.statutPaiement === "en_attente_preuve") && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('wakat_open_upload_proof', { detail: { order } }));
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
                title="Payer via Mobile Money et envoyer une capture d'écran"
              >
                <Smartphone className="w-3.5 h-3.5" /> Payer par Mobile Money
              </button>
            )}

            {order.statutPaiement === "preuve_soumise" && (
              <div 
                className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                title="Capture d'écran envoyée, en attente de validation du commerçant"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-500 animate-spin" /> Preuve en validation
              </div>
            )}

            {order.statutPaiement === "valide" && (
              <div 
                className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                title="Paiement vérifié et validé par le commerçant"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paiement validé
              </div>
            )}

            {order.statutPaiement === "rejete" && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('wakat_open_upload_proof', { detail: { order } }));
                }}
                className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title={order.commentaireRejet ? `Rejeté: ${order.commentaireRejet}` : "Preuve rejetée - Cliquer pour renvoyer"}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Preuve rejetée (Renvoyer)
              </button>
            )}
          </>
        )}

        {/* PDF Invoice Export */}
        {order && products && users && (
          <button
            onClick={handleExportPDF}
            className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Télécharger la facture officielle PDF"
          >
            <Download className="w-3.5 h-3.5" /> Exporter PDF
          </button>
        )}

        {/* WhatsApp Sharing Coordination */}
        {order && products && (
          <div className="flex gap-1.5">
            {/* If there's an assigned driver, let customer contact them */}
            {driverProfile?.phone && (
              <a
                href={getWhatsAppLink(driverProfile.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Coordonner la livraison avec le livreur via WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" /> WhatsApp Livreur
              </a>
            )}

            {/* Seller contacting Client/Buyer */}
            {buyerProfile?.phone && (
              <a
                href={getWhatsAppLink(buyerProfile.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Contacter le client sur WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" /> WhatsApp Client
              </a>
            )}

            {/* Default Quick Share */}
            {!buyerProfile?.phone && !driverProfile?.phone && (
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Partager les détails par WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" /> Partager WhatsApp
              </a>
            )}
          </div>
        )}

        <button
          onClick={startOrderChat}
          className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Discuter
        </button>
        
        {isDeliveredOrShipped && status !== OrderStatus.DELIVERED && (
          <button
            onClick={onConfirmReceipt}
            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Confirmer Réception
          </button>
        )}
        
        {(status === OrderStatus.DELIVERED || status === OrderStatus.SHIPPED) && (
          <button
            onClick={() => setShowClaimModal(true)}
            className="bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <AlertOctagon className="w-3.5 h-3.5" /> Faire une Réclamation
          </button>
        )}
      </div>

      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-sm shadow-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-zinc-900 dark:text-white">Réclamation - {orderId}</h3>
              <button onClick={() => setShowClaimModal(false)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Message</label>
                <textarea
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  placeholder="Décrivez le problème avec votre commande..."
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-sm h-24 resize-none"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsRecording(!isRecording);
                    if (isRecording) {
                      setClaimText(prev => prev + (prev ? " " : "") + "[Note Vocale Jointe]");
                    }
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex justify-center items-center gap-2 ${
                    isRecording ? "bg-rose-500 text-white animate-pulse" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  {isRecording ? "Enregistrement..." : "Note Vocale"}
                </button>
              </div>

              <button
                onClick={handleSendClaim}
                disabled={!claimText.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Envoyer la Réclamation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
