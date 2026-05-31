# Managing Products

## Add a product

1. Admin → Products → Add Product
2. Fill in name, description
3. Add variants (up to 5):
   - Label (e.g. "Red")
   - Color hex (for swatch display)
   - Upload images (auto-compressed to WebP, max 300KB)
4. Add sizes per variant:
   - Size label ("S", "M", "XL", "EU42")
   - Price (in your configured currency)
   - Stock quantity (-1 for unlimited)
   - SKU (optional)
5. Save → product syncs to Stripe automatically

## Edit a product

Changes to name/description → update in Stripe.
Price changes → new Stripe price created, old one deactivated.
Images → uploaded to R2, old images remain (use versioned URLs).

## Manage stock

Admin → Products → click variant → adjust stock.
Stock ≤5 shows "Only N left" badge on storefront.
Stock = 0 shows "Out of Stock" with Notify Me button.
Stock = -1 (unlimited) hides stock indicator.

## Delete a product

Soft-delete only. Product archived in Stripe, `active = false` in D1.
Existing orders retain product snapshot — order history unaffected.
