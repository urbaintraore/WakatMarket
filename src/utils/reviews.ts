export const getPartnerReviews = () => {
  const stored = localStorage.getItem("wakat_partner_reviews");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }
  return [];
};
export const getPartnerRatingStats = (userId: string) => {
  const reviews = getPartnerReviews().filter((r: any) => r.targetId === userId);
  if (reviews.length === 0) return { avg: 5.0, count: 0 };
  const sum = reviews.reduce((acc: number, r: any) => acc + r.rating, 0);
  return { avg: parseFloat((sum / reviews.length).toFixed(1)), count: reviews.length };
};
