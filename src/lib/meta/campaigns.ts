// Meta Marketing API — AI kampanya taslağından GERÇEK kampanya oluşturur.
//
// GÜVENLİK KARARI: her kampanya PAUSED oluşturulur. Harcama yalnız kullanıcının
// panelden bilinçli "Aktif Et" tıklamasıyla başlar — asla otomatik değil.
//
// Akış: createCampaign → createAdSet (hedef kitle + bütçe) → uploadCreativeImage
// + createAdCreative → createAd. Hepsi PAUSED; userErrors best-effort değil,
// herhangi bir adım patlarsa üstündeki adımlar Meta'da PAUSED kalır (temizlik
// gerekmez — kullanıcı hiçbir zaman görmez, panel listesine hiç girmemiş olur).

import { metaGraph } from "./client";

export interface CreateCampaignInput {
  adAccountId: string; // "act_XXXXXXXXX"
  pageId: string | null;
  name: string;
  headline: string;
  primaryText: string;
  linkUrl: string;
  imageUrl: string;
  dailyBudgetUsd: number;
  audienceSuggestions: string[];
}

export interface CreatedCampaign {
  campaignId: string;
  adSetId: string;
  adId: string;
}

/** İngilizce ilgi alanı önerisini Meta'nın "adinterest" arama sonucuna çevirir (best-effort). */
async function resolveInterests(query: string, accessToken: string): Promise<string[]> {
  try {
    const res = await metaGraph<{ data?: Array<{ id: string }> }>("/search", accessToken, {
      params: { type: "adinterest", q: query, limit: "1" },
    });
    return (res.data ?? []).map((d) => d.id);
  } catch {
    return []; // çözülemeyen ilgi alanı sessizce atlanır — broad targeting yeterli
  }
}

async function createCampaignObject(input: CreateCampaignInput, accessToken: string): Promise<string> {
  const res = await metaGraph<{ id: string }>(`/${input.adAccountId}/campaigns`, accessToken, {
    method: "POST",
    params: {
      name: input.name,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
    },
  });
  return res.id;
}

async function createAdSetObject(
  input: CreateCampaignInput,
  campaignId: string,
  accessToken: string
): Promise<string> {
  // En fazla 3 ilgi alanı çözülmeye çalışılır; hiçbiri çözülmezse geniş hedefleme kullanılır
  const interestIds = (
    await Promise.all(input.audienceSuggestions.slice(0, 3).map((q) => resolveInterests(q, accessToken)))
  ).flat();

  const targeting: Record<string, unknown> = {
    geo_locations: { countries: ["US"] },
    age_min: 18,
    age_max: 65,
  };
  if (interestIds.length > 0) {
    targeting.flexible_spec = [{ interests: interestIds.map((id) => ({ id })) }];
  }

  const res = await metaGraph<{ id: string }>(`/${input.adAccountId}/adsets`, accessToken, {
    method: "POST",
    params: {
      name: `${input.name} — Kitle`,
      campaign_id: campaignId,
      daily_budget: String(Math.round(input.dailyBudgetUsd * 100)), // cent cinsinden
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(targeting),
      status: "PAUSED",
    },
  });
  return res.id;
}

async function uploadCreativeImage(adAccountId: string, accessToken: string, imageUrl: string): Promise<string> {
  const res = await metaGraph<{ images?: Record<string, { hash: string }> }>(
    `/${adAccountId}/adimages`,
    accessToken,
    { method: "POST", params: { url: imageUrl } }
  );
  const hash = Object.values(res.images ?? {})[0]?.hash;
  if (!hash) throw new Error("Meta görsel yüklemesi hash döndürmedi");
  return hash;
}

async function createAdCreativeObject(
  input: CreateCampaignInput,
  imageHash: string,
  accessToken: string
): Promise<string> {
  const objectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      image_hash: imageHash,
      link: input.linkUrl,
      message: input.primaryText,
      name: input.headline,
      call_to_action: { type: "SHOP_NOW", value: { link: input.linkUrl } },
    },
  };

  const res = await metaGraph<{ id: string }>(`/${input.adAccountId}/adcreatives`, accessToken, {
    method: "POST",
    params: {
      name: `${input.name} — Kreatif`,
      object_story_spec: JSON.stringify(objectStorySpec),
    },
  });
  return res.id;
}

async function createAdObject(
  input: CreateCampaignInput,
  adSetId: string,
  creativeId: string,
  accessToken: string
): Promise<string> {
  const res = await metaGraph<{ id: string }>(`/${input.adAccountId}/ads`, accessToken, {
    method: "POST",
    params: {
      name: input.name,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status: "PAUSED",
    },
  });
  return res.id;
}

/** Kampanya → Reklam Seti → Kreatif → Reklam — tamamı PAUSED oluşturulur. */
export async function createFullCampaign(
  input: CreateCampaignInput,
  accessToken: string
): Promise<CreatedCampaign> {
  if (!input.pageId) {
    throw new Error("Facebook Page bağlı değil — reklam kreatifi için sayfa gerekli");
  }

  const campaignId = await createCampaignObject(input, accessToken);
  const adSetId = await createAdSetObject(input, campaignId, accessToken);
  const imageHash = await uploadCreativeImage(input.adAccountId, accessToken, input.imageUrl);
  const creativeId = await createAdCreativeObject(input, imageHash, accessToken);
  const adId = await createAdObject(input, adSetId, creativeId, accessToken);

  return { campaignId, adSetId, adId };
}

export interface CampaignInsights {
  spendUsd: number;
  impressions: number;
  clicks: number;
}

/** Kampanyanın toplam (lifetime) performans metrikleri. */
export async function getCampaignInsights(campaignId: string, accessToken: string): Promise<CampaignInsights> {
  const res = await metaGraph<{ data?: Array<{ spend?: string; impressions?: string; clicks?: string }> }>(
    `/${campaignId}/insights`,
    accessToken,
    { params: { fields: "spend,impressions,clicks", date_preset: "maximum" } }
  );
  const row = res.data?.[0];
  return {
    spendUsd: parseFloat(row?.spend ?? "0") || 0,
    impressions: parseInt(row?.impressions ?? "0", 10) || 0,
    clicks: parseInt(row?.clicks ?? "0", 10) || 0,
  };
}

/** Kampanyayı Meta'da ACTIVE/PAUSED yapar (kullanıcının panelden bilinçli tetiklediği tek yer). */
export async function setCampaignStatus(
  campaignId: string,
  accessToken: string,
  status: "ACTIVE" | "PAUSED"
): Promise<void> {
  await metaGraph(`/${campaignId}`, accessToken, { method: "POST", params: { status } });
}
