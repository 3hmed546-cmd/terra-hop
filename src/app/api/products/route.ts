import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import BUNDLED_PRODUCTS from "../../../../data/secure-vault/products-data.json";

function getWritableProductsPath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "terra-products-data.json");
  }
  return path.join(process.cwd(), "data", "secure-vault", "products-data.json");
}

let memoryProducts: any[] | null = null;

async function loadPersistedProducts(): Promise<any[]> {
  if (memoryProducts && memoryProducts.length > 0) return memoryProducts;

  // 1. Try reading from runtime writable cache (/tmp on Vercel)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = getWritableProductsPath();
    try {
      const raw = await fs.readFile(tmpPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryProducts = parsed;
        return memoryProducts;
      }
    } catch {
      // Continue to bundled
    }
  }

  // 2. Direct static bundle fallback (guaranteed available in Lambda)
  if (Array.isArray(BUNDLED_PRODUCTS) && BUNDLED_PRODUCTS.length > 0) {
    memoryProducts = [...BUNDLED_PRODUCTS];
    return memoryProducts;
  }

  return memoryProducts || [];
}

async function savePersistedProducts(products: any[]): Promise<void> {
  memoryProducts = products;
  const filePath = getWritableProductsPath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(products, null, 2), "utf-8");
  } catch (err) {
    console.error("[Products Save Error]", err);
  }
}

// GET /api/products -> Returns live products list
export async function GET() {
  try {
    const products = await loadPersistedProducts();
    return NextResponse.json(
      { ok: true, products },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to load products" }, { status: 500 });
  }
}

// POST /api/products -> Updates, adds, deletes products or product images
export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    }
    const current = await loadPersistedProducts();

    // 1. Full sync
    if (body.action === "sync" && Array.isArray(body.products)) {
      await savePersistedProducts(body.products);
      return NextResponse.json({ ok: true, products: body.products });
    }

    // 2. Save / update single product
    if ((body.action === "save" || body.action === "update") && body.product) {
      const p = body.product;
      const idx = current.findIndex((item) => item.id === p.id || item.slug === p.slug);
      let updated: any[];
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = { ...updated[idx], ...p, updatedAt: new Date().toISOString() };
      } else {
        updated = [p, ...current];
      }
      await savePersistedProducts(updated);
      return NextResponse.json({ ok: true, products: updated, product: p });
    }

    // 3. Delete a product
    if (body.action === "delete_product" && body.id) {
      const next = current.filter((item) => item.id !== body.id && item.slug !== body.id);
      await savePersistedProducts(next);
      return NextResponse.json({ ok: true, products: next });
    }

    // 4. Delete image from specific product
    if (body.action === "delete_image" && body.productId && body.imageId) {
      const next = current.map((item) => {
        if (item.id === body.productId || item.slug === body.productId) {
          const filteredImages = (item.images || []).filter((img: any) => img.id !== body.imageId && img.url !== body.imageId);
          return { ...item, images: filteredImages, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      await savePersistedProducts(next);
      return NextResponse.json({ ok: true, products: next });
    }

    // 5. Add image to specific product
    if (body.action === "add_image" && body.productId && body.image) {
      const next = current.map((item) => {
        if (item.id === body.productId || item.slug === body.productId) {
          const existingImages = item.images || [];
          return { ...item, images: [...existingImages, body.image], updatedAt: new Date().toISOString() };
        }
        return item;
      });
      await savePersistedProducts(next);
      return NextResponse.json({ ok: true, products: next });
    }

    // 6. Direct array payload
    if (Array.isArray(body.products)) {
      await savePersistedProducts(body.products);
      return NextResponse.json({ ok: true, products: body.products });
    }

    return NextResponse.json({ ok: false, error: "Invalid action or payload" }, { status: 400 });
  } catch (err: any) {
    console.error("[Products POST Error]", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update products" }, { status: 500 });
  }
}
