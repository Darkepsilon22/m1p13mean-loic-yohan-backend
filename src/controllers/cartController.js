const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToUser } = require('../socket');

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private (acheteur)
 */
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.getOrCreateCart(req.user._id);

  await cart.populate([
    { path: 'items.productId', select: 'name price stock mainPhoto availability isArchived' },
    { path: 'items.boutiqueId', select: 'name logo' }
  ]);

  res.status(200).json({
    success: true,
    data: {
      cart: {
        _id: cart._id,
        items: cart.items,
        itemsCount: cart.itemsCount,
        subtotal: cart.subtotal,
        currency: cart.currency,
        expiresAt: cart.expiresAt
      }
    }
  });
});

/**
 * @desc    Add item to cart
 * @route   POST /api/cart/items
 * @access  Private (acheteur)
 */
exports.addItem = asyncHandler(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  // Verify product exists and is available
  const product = await Product.findById(productId).populate('boutiqueId', 'name');

  if (!product) {
    return next(new ApiError(404, 'Produit introuvable'));
  }

  if (product.isArchived) {
    return next(new ApiError(400, 'Le produit n\'est plus disponible'));
  }

  if (product.availability === 'outOfStock') {
    return next(new ApiError(400, 'Produit en rupture de stock'));
  }

  if (product.stock < quantity) {
    return next(new ApiError(400, `Stock insuffisant. Disponible : ${product.stock}`));
  }

  const cart = await Cart.getOrCreateCart(req.user._id);

  // Check if adding this quantity exceeds stock
  const existingItem = cart.items.find(
    item => item.productId.toString() === productId
  );
  const totalQuantity = (existingItem?.quantity || 0) + quantity;

  if (totalQuantity > product.stock) {
    return next(new ApiError(400, `Impossible d'ajouter ${quantity} articles. Stock disponible : ${product.stock}, Déjà dans le panier : ${existingItem?.quantity || 0}`));
  }

  await cart.addItem(product, quantity);

  await cart.populate([
    { path: 'items.productId', select: 'name price stock mainPhoto availability' },
    { path: 'items.boutiqueId', select: 'name logo' }
  ]);

  emitToUser(req.user._id.toString(), 'cart:itemAdded', { productId, quantity });

  res.status(200).json({
    success: true,
    message: 'Produit ajouté au panier',
    data: {
      cart: {
        _id: cart._id,
        items: cart.items,
        itemsCount: cart.itemsCount,
        subtotal: cart.subtotal
      }
    }
  });
});

/**
 * @desc    Update item quantity
 * @route   PUT /api/cart/items/:productId
 * @access  Private (acheteur)
 */
exports.updateItemQuantity = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (quantity < 0) {
    return next(new ApiError(400, 'La quantité ne peut pas être négative'));
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new ApiError(404, 'Panier introuvable'));
  }

  // If quantity is 0, remove the item
  if (quantity === 0) {
    await cart.removeItem(productId);
  } else {
    // Verify stock
    const product = await Product.findById(productId);

    if (!product) {
      return next(new ApiError(404, 'Produit introuvable'));
    }

    if (quantity > product.stock) {
      return next(new ApiError(400, `Stock insuffisant. Disponible : ${product.stock}`));
    }

    await cart.updateItemQuantity(productId, quantity);
  }

  await cart.populate([
    { path: 'items.productId', select: 'name price stock mainPhoto availability' },
    { path: 'items.boutiqueId', select: 'name logo' }
  ]);

  emitToUser(req.user._id.toString(), 'cart:itemUpdated', { productId: req.params.productId });

  res.status(200).json({
    success: true,
    message: 'Panier mis à jour',
    data: {
      cart: {
        _id: cart._id,
        items: cart.items,
        itemsCount: cart.itemsCount,
        subtotal: cart.subtotal
      }
    }
  });
});

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/items/:productId
 * @access  Private (acheteur)
 */
exports.removeItem = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new ApiError(404, 'Panier introuvable'));
  }

  await cart.removeItem(productId);

  await cart.populate([
    { path: 'items.productId', select: 'name price stock mainPhoto availability' },
    { path: 'items.boutiqueId', select: 'name logo' }
  ]);

  emitToUser(req.user._id.toString(), 'cart:itemRemoved', { productId: req.params.productId });

  res.status(200).json({
    success: true,
    message: 'Produit retiré du panier',
    data: {
      cart: {
        _id: cart._id,
        items: cart.items,
        itemsCount: cart.itemsCount,
        subtotal: cart.subtotal
      }
    }
  });
});

/**
 * @desc    Clear cart
 * @route   DELETE /api/cart
 * @access  Private (acheteur)
 */
exports.clearCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new ApiError(404, 'Panier introuvable'));
  }

  await cart.clearCart();

  emitToUser(req.user._id.toString(), 'cart:cleared', {});

  res.status(200).json({
    success: true,
    message: 'Panier vidé',
    data: {
      cart: {
        _id: cart._id,
        items: [],
        itemsCount: 0,
        subtotal: 0
      }
    }
  });
});

/**
 * @desc    Validate cart (check stock availability)
 * @route   POST /api/cart/validate
 * @access  Private (acheteur)
 */
exports.validateCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return next(new ApiError(404, 'Panier introuvable'));
  }

  if (cart.items.length === 0) {
    return next(new ApiError(400, 'Le panier est vide'));
  }

  const validation = await cart.validateStock();

  await cart.populate([
    { path: 'items.productId', select: 'name price stock mainPhoto availability' },
    { path: 'items.boutiqueId', select: 'name logo' }
  ]);

  res.status(200).json({
    success: true,
    data: {
      valid: validation.valid,
      errors: validation.errors,
      cart: {
        _id: cart._id,
        items: cart.items,
        itemsCount: cart.itemsCount,
        subtotal: cart.subtotal
      }
    }
  });
});

/**
 * @desc    Get cart summary (for checkout preview)
 * @route   GET /api/cart/summary
 * @access  Private (acheteur)
 */
exports.getCartSummary = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart || cart.items.length === 0) {
    return next(new ApiError(400, 'Le panier est vide'));
  }

  // Validate stock first
  const validation = await cart.validateStock();

  await cart.populate([
    { path: 'items.productId', select: 'name price stock mainPhoto availability' },
    { path: 'items.boutiqueId', select: 'name logo' }
  ]);

  // Group items by boutique
  const itemsByBoutique = {};
  for (const item of cart.items) {
    const boutiqueId = item.boutiqueId._id.toString();
    if (!itemsByBoutique[boutiqueId]) {
      itemsByBoutique[boutiqueId] = {
        boutique: item.boutiqueId,
        items: [],
        subtotal: 0
      };
    }
    itemsByBoutique[boutiqueId].items.push(item);
    itemsByBoutique[boutiqueId].subtotal += item.quantity * item.unitPrice;
  }

  res.status(200).json({
    success: true,
    data: {
      valid: validation.valid,
      validationErrors: validation.errors,
      summary: {
        itemsCount: cart.itemsCount,
        subtotal: cart.subtotal,
        currency: cart.currency,
        boutiquesCount: Object.keys(itemsByBoutique).length,
        itemsByBoutique: Object.values(itemsByBoutique)
      }
    }
  });
});
