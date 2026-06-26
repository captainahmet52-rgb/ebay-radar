import { describe, test, expect } from "vitest";
import { parseGetMyeBaySellingResponse, parseTradingAck } from "@/lib/ebay/trading-parser";
import { buildReviseInventoryStatusRequest, siteIdForMarketplace } from "@/lib/ebay/trading";

// Gerçekçi GetMyeBaySelling yanıtı — 2 ilan, biri SKU'lu biri SKU'suz
const TWO_ITEMS = `<?xml version="1.0" encoding="UTF-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2026-06-26T10:00:00.000Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1193</Version>
  <ActiveList>
    <PaginationResult>
      <TotalNumberOfPages>3</TotalNumberOfPages>
      <TotalNumberOfEntries>450</TotalNumberOfEntries>
    </PaginationResult>
    <ItemArray>
      <Item>
        <ItemID>110012345678901</ItemID>
        <SKU>AZ-B08N5WRWNW-US</SKU>
        <Title>Sony WH-1000XM4 Wireless Headphones Black</Title>
        <Quantity>5</Quantity>
        <SellingStatus>
          <CurrentPrice currencyID="USD">129.99</CurrentPrice>
          <QuantitySold>2</QuantitySold>
        </SellingStatus>
        <PictureDetails>
          <GalleryURL>https://i.ebayimg.com/abc.jpg</GalleryURL>
        </PictureDetails>
        <Site>US</Site>
      </Item>
      <Item>
        <ItemID>110099999999999</ItemID>
        <Title>Random Garden Hose No SKU</Title>
        <Quantity>10</Quantity>
        <SellingStatus>
          <CurrentPrice currencyID="GBP">19.50</CurrentPrice>
          <QuantitySold>0</QuantitySold>
        </SellingStatus>
        <Site>UK</Site>
      </Item>
    </ItemArray>
  </ActiveList>
</GetMyeBaySellingResponse>`;

// Tek ilan — fast-xml-parser bunu obje döner (dizi DEĞİL); normalize testi
const ONE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList>
    <PaginationResult>
      <TotalNumberOfPages>1</TotalNumberOfPages>
      <TotalNumberOfEntries>1</TotalNumberOfEntries>
    </PaginationResult>
    <ItemArray>
      <Item>
        <ItemID>220000000000001</ItemID>
        <SKU>B07XJ8C8F5</SKU>
        <Title>Echo Dot</Title>
        <Quantity>1</Quantity>
        <SellingStatus>
          <CurrentPrice currencyID="USD">49.99</CurrentPrice>
        </SellingStatus>
      </Item>
    </ItemArray>
  </ActiveList>
</GetMyeBaySellingResponse>`;

const FAILURE = `<?xml version="1.0" encoding="UTF-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ShortMessage>Auth token is invalid.</ShortMessage>
    <LongMessage>Validation of the authentication token in API request failed.</LongMessage>
    <ErrorCode>931</ErrorCode>
    <SeverityCode>Error</SeverityCode>
  </Errors>
</GetMyeBaySellingResponse>`;

const EMPTY_ACTIVE = `<?xml version="1.0" encoding="UTF-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList>
    <PaginationResult>
      <TotalNumberOfPages>0</TotalNumberOfPages>
      <TotalNumberOfEntries>0</TotalNumberOfEntries>
    </PaginationResult>
  </ActiveList>
</GetMyeBaySellingResponse>`;

describe("parseGetMyeBaySellingResponse", () => {
  test("iki ilan → tüm alanlar doğru ayrıştırılır", () => {
    const r = parseGetMyeBaySellingResponse(TWO_ITEMS);
    expect(r.ack).toBe("Success");
    expect(r.totalPages).toBe(3);
    expect(r.totalEntries).toBe(450);
    expect(r.listings).toHaveLength(2);

    const [a, b] = r.listings;
    expect(a.ebayItemId).toBe("110012345678901");
    expect(a.ebaySku).toBe("AZ-B08N5WRWNW-US");
    expect(a.title).toBe("Sony WH-1000XM4 Wireless Headphones Black");
    expect(a.price).toBe(129.99);
    expect(a.currency).toBe("USD");
    expect(a.quantityAvailable).toBe(3); // 5 - 2 satılan
    expect(a.imageUrl).toBe("https://i.ebayimg.com/abc.jpg");
    expect(a.site).toBe("US");

    expect(b.ebaySku).toBeNull(); // SKU yok
    expect(b.currency).toBe("GBP");
    expect(b.quantityAvailable).toBe(10);
    expect(b.imageUrl).toBeNull();
  });

  test("ItemID büyük sayı → string olarak korunur (hassasiyet kaybı yok)", () => {
    const r = parseGetMyeBaySellingResponse(TWO_ITEMS);
    expect(typeof r.listings[0].ebayItemId).toBe("string");
    expect(r.listings[0].ebayItemId).toBe("110012345678901");
  });

  test("tek ilan → obje değil dizi olarak normalize edilir", () => {
    const r = parseGetMyeBaySellingResponse(ONE_ITEM);
    expect(r.listings).toHaveLength(1);
    expect(r.listings[0].ebaySku).toBe("B07XJ8C8F5");
    expect(r.listings[0].quantityAvailable).toBe(1); // satılan yok → 1
    expect(r.listings[0].price).toBe(49.99);
  });

  test("Failure → ack=Failure, hata mesajı çıkarılır, ilan boş", () => {
    const r = parseGetMyeBaySellingResponse(FAILURE);
    expect(r.ack).toBe("Failure");
    expect(r.listings).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toContain("931");
    expect(r.errors[0]).toContain("authentication token");
  });

  test("boş ActiveList → ilan yok, sayaçlar 0, hata yok", () => {
    const r = parseGetMyeBaySellingResponse(EMPTY_ACTIVE);
    expect(r.ack).toBe("Success");
    expect(r.listings).toHaveLength(0);
    expect(r.totalEntries).toBe(0);
    expect(r.errors).toHaveLength(0);
  });

  test("bozuk XML → Failure, çökme yok", () => {
    const r = parseGetMyeBaySellingResponse("<<<not valid");
    expect(r.ack).toBe("Failure");
    expect(r.listings).toHaveLength(0);
  });

  test("boş string → güvenli boş sonuç", () => {
    const r = parseGetMyeBaySellingResponse("");
    expect(r.listings).toHaveLength(0);
  });
});

describe("parseTradingAck — yazma yanıtları (ReviseInventoryStatus)", () => {
  test("Success → ack Success, hata yok", () => {
    const xml = `<?xml version="1.0"?><ReviseInventoryStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></ReviseInventoryStatusResponse>`;
    const r = parseTradingAck(xml);
    expect(r.ack).toBe("Success");
    expect(r.errors).toHaveLength(0);
  });

  test("Failure → ack Failure + hata mesajı", () => {
    const xml = `<?xml version="1.0"?><ReviseInventoryStatusResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Item cannot be revised.</ShortMessage><LongMessage>The item is no longer active.</LongMessage><ErrorCode>21916750</ErrorCode></Errors></ReviseInventoryStatusResponse>`;
    const r = parseTradingAck(xml);
    expect(r.ack).toBe("Failure");
    expect(r.errors[0]).toContain("21916750");
    expect(r.errors[0]).toContain("no longer active");
  });

  test("bozuk XML → Failure", () => {
    expect(parseTradingAck("<<bad").ack).toBe("Failure");
  });
});

describe("buildReviseInventoryStatusRequest", () => {
  test("fiyat + adet → StartPrice ve Quantity içerir", () => {
    const xml = buildReviseInventoryStatusRequest("110012345678", 2, 129.99);
    expect(xml).toContain("<ItemID>110012345678</ItemID>");
    expect(xml).toContain("<Quantity>2</Quantity>");
    expect(xml).toContain("<StartPrice>129.99</StartPrice>");
  });

  test("qty 0 + fiyat null → sadece Quantity 0 (duraklat), StartPrice YOK", () => {
    const xml = buildReviseInventoryStatusRequest("110012345678", 0, null);
    expect(xml).toContain("<Quantity>0</Quantity>");
    expect(xml).not.toContain("StartPrice");
  });

  test("negatif/ondalık qty güvenli tam sayıya kırpılır", () => {
    const xml = buildReviseInventoryStatusRequest("1", -5, 10);
    expect(xml).toContain("<Quantity>0</Quantity>");
  });
});

describe("siteIdForMarketplace", () => {
  test("marketplace → Trading SiteID", () => {
    expect(siteIdForMarketplace("EBAY_US")).toBe("0");
    expect(siteIdForMarketplace("EBAY_GB")).toBe("3");
    expect(siteIdForMarketplace("EBAY_DE")).toBe("77");
    expect(siteIdForMarketplace("BILINMEYEN")).toBe("0"); // güvenli varsayılan
  });
});
