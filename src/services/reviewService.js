const mongoose = require('mongoose');
const Review = require('../models/Review');
const Boutique = require('../models/Boutique');

/**
 * Recalcule la note moyenne et le nombre d'avis d'une boutique
 * à partir des reviews avec status = 'published'.
 * @param {ObjectId|string} boutiqueId - ID de la boutique
 * @returns {Promise<{ average: number|null, count: number }>}
 */
const recalculateBoutiqueRating = async (boutiqueId) => {
  const id = typeof boutiqueId === 'string' && mongoose.Types.ObjectId.isValid(boutiqueId)
    ? new mongoose.Types.ObjectId(boutiqueId)
    : boutiqueId;
  const result = await Review.aggregate([
    { $match: { boutiqueId: id, status: 'published' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  const average = result[0]
    ? Math.round(result[0].average * 100) / 100
    : null;
  const count = result[0] ? result[0].count : 0;

  await Boutique.findByIdAndUpdate(boutiqueId, {
    $set: {
      'rating.average': average,
      'rating.count': count
    }
  });

  return { average, count };
};

module.exports = {
  recalculateBoutiqueRating
};
