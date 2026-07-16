// eBay Taxonomy API — kategori ağacı + aspect (item specifics) yönetimi
// Application token kullanır (user token değil).
// Sonuçlar Redis'te TTL ile cache'lenir; token asla log'a yazılmaz.

import Redis from "ioredis";
import { getApplicationToken } from "@/lib/ebay/oauth";

// ─── Redis bağlantısı ──────────────────────────────────────────────────────────
// queues.ts ile aynı URL parsing mantığı; BullMQ'nun iç Redis'inden ayrı bir
// istemci — taxonomy cache'i için single connection yeterli.

function buildRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return new Redis({
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  } catch {
    return new Redis({
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
}

// Modül-level singleton — her import yeni bağlantı açmaz.
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = buildRedisClient();
  }
  return redisClient;
}

// ─── eBay API base URL ─────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface CategoryTreeNode {
  categoryId: string;
  categoryName: string;
  childCategoryTreeNodes?: CategoryTreeNode[];
}

export interface CategoryAspect {
  localizedAspectName: string;
  aspectConstraint: {
    aspectRequired: boolean;
    itemToAspectCardinality: string;
  };
  aspectValues?: Array<{ localizedValue: string }>;
}

// eBay API'nin get_default_category_tree_id endpoint yanıtı
interface DefaultCategoryTreeIdResponse {
  categoryTreeId: string;
  categoryTreeVersion: string;
}

// eBay API'nin category_tree endpoint yanıtı
interface CategoryTreeResponse {
  rootCategoryNode: {
    category: { categoryId: string; categoryName: string };
    childCategoryTreeNodes?: RawCategoryNode[];
  };
}

interface RawCategoryNode {
  category: { categoryId: string; categoryName: string };
  childCategoryTreeNodes?: RawCategoryNode[];
}

// eBay API'nin get_item_aspects_for_category endpoint yanıtı
interface AspectsForCategoryResponse {
  aspects: Array<{
    localizedAspectName: string;
    aspectConstraint: {
      aspectRequired: boolean;
      itemToAspectCardinality: string;
    };
    aspectValues?: Array<{ localizedValue: string }>;
  }>;
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/** Uygulama token ile eBay GET isteği atar. Token log'a yazılmaz. */
async function ebayGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getApplicationToken();

  let url = `${getApiBaseUrl()}${path}`;
  if (params && Object.keys(params).length > 0) {
    url = `${url}?${new URLSearchParams(params).toString()}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = JSON.stringify(await response.json());
    } catch {
      errorBody = await response.text().catch(() => "");
    }
    throw new Error(
      `eBay Taxonomy API hatası [GET ${path}]: ${response.status} ${response.statusText} — ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

/** Kategori ağacının default tree ID'sini al */
async function getCategoryTreeId(marketplaceId: string): Promise<string> {
  const data = await ebayGet<DefaultCategoryTreeIdResponse>(
    "/commerce/taxonomy/v1/get_default_category_tree_id",
    { marketplace_id: marketplaceId }
  );
  return data.categoryTreeId;
}

/** eBay raw node'unu CategoryTreeNode'a dönüştür (recursive) */
function normalizeNode(raw: RawCategoryNode): CategoryTreeNode {
  const node: CategoryTreeNode = {
    categoryId: raw.category.categoryId,
    categoryName: raw.category.categoryName,
  };
  if (raw.childCategoryTreeNodes && raw.childCategoryTreeNodes.length > 0) {
    node.childCategoryTreeNodes = raw.childCategoryTreeNodes.map(normalizeNode);
  }
  return node;
}

// ─── Dışa açık fonksiyonlar ───────────────────────────────────────────────────

/**
 * Verilen marketplace'in tam kategori ağacını döndürür.
 * Redis cache key: "ebay:taxonomy:tree:{marketplaceId}" — TTL 24 saat.
 */
export async function getCategoryTree(
  marketplaceId = "EBAY_US"
): Promise<CategoryTreeNode[]> {
  const cacheKey = `ebay:taxonomy:tree:${marketplaceId}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return JSON.parse(cached) as CategoryTreeNode[];
  }

  const treeId = await getCategoryTreeId(marketplaceId);

  const treeData = await ebayGet<CategoryTreeResponse>(
    `/commerce/taxonomy/v1/category_tree/${treeId}`
  );

  const root = treeData.rootCategoryNode;
  const nodes: CategoryTreeNode[] = root.childCategoryTreeNodes
    ? root.childCategoryTreeNodes.map(normalizeNode)
    : [];

  await redis.set(cacheKey, JSON.stringify(nodes), "EX", 24 * 60 * 60);

  return nodes;
}

/**
 * Belirli bir kategori için tüm aspect'leri döndürür.
 * Redis cache key: "ebay:taxonomy:aspects:{categoryId}" — TTL 6 saat.
 */
export async function getAspectsForCategory(
  categoryId: string
): Promise<CategoryAspect[]> {
  const cacheKey = `ebay:taxonomy:aspects:${categoryId}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return JSON.parse(cached) as CategoryAspect[];
  }

  const treeId = await getCategoryTreeId("EBAY_US");

  const data = await ebayGet<AspectsForCategoryResponse>(
    `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category`,
    { category_id: categoryId }
  );

  const aspects: CategoryAspect[] = (data.aspects ?? []).map((a) => ({
    localizedAspectName: a.localizedAspectName,
    aspectConstraint: {
      aspectRequired: a.aspectConstraint.aspectRequired,
      itemToAspectCardinality: a.aspectConstraint.itemToAspectCardinality,
    },
    aspectValues: a.aspectValues?.map((v) => ({ localizedValue: v.localizedValue })),
  }));

  await redis.set(cacheKey, JSON.stringify(aspects), "EX", 6 * 60 * 60);

  return aspects;
}

/**
 * Bir kategori için zorunlu aspect adlarını döndürür.
 * aspectConstraint.aspectRequired === true olanlar filtrelenir.
 */
export async function getRequiredAspects(categoryId: string): Promise<string[]> {
  const aspects = await getAspectsForCategory(categoryId);
  return aspects
    .filter((a) => a.aspectConstraint.aspectRequired === true)
    .map((a) => a.localizedAspectName);
}

/**
 * Kategori için "Condition" aspect'inin var olup olmadığını ve
 * zorunlu olup olmadığını kontrol eder.
 */
export async function isConditionRequired(categoryId: string): Promise<boolean> {
  const aspects = await getAspectsForCategory(categoryId);
  const condition = aspects.find(
    (a) => a.localizedAspectName.toLowerCase() === "condition"
  );
  return condition?.aspectConstraint.aspectRequired === true;
}

/**
 * Giyim/ayakkabı kategorilerinde beden değerini eBay standardına normalize eder.
 * "Size" aspect'inin kabul ettiği değerler listesine göre en yakın eşleşme bulunur.
 * Eşleşme yoksa "One Size" döner.
 */
export async function normalizeSizeAspect(
  size: string,
  categoryId: string
): Promise<string> {
  const aspects = await getAspectsForCategory(categoryId);

  const sizeAspect = aspects.find(
    (a) => a.localizedAspectName.toLowerCase() === "size"
  );

  if (!sizeAspect || !sizeAspect.aspectValues || sizeAspect.aspectValues.length === 0) {
    return "One Size";
  }

  const acceptedValues = sizeAspect.aspectValues.map((v) => v.localizedValue);

  // Tam eşleşme
  const exactMatch = acceptedValues.find((v) => v === size);
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  // Lowercase + trim ile eşleşme
  const normalizedInput = size.toLowerCase().trim();
  const fuzzyMatch = acceptedValues.find(
    (v) => v.toLowerCase().trim() === normalizedInput
  );
  if (fuzzyMatch !== undefined) {
    return fuzzyMatch;
  }

  return "One Size";
}
