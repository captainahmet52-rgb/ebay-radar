import type { AmazonCandidate } from "./amazon-radar";

/**
 * Radar önizleme/demo adayları.
 * Gerçek AliExpress + Keepa kaynağı bağlanana kadar dashboard bunları gösterir.
 * Kaynak bağlanınca bu liste canlı veriyle değişecek.
 */
export const SAMPLE_CANDIDATES: AmazonCandidate[] = [
  {
    aliId: "1001", title: "Mini Taşınabilir Blender USB Şarjlı", aliCost: 6.5, aliShipping: 1.5,
    aliOrders: 4200, aliRating: 4.8, brand: "Generic", category: "kitchen",
    amazonBsr: 8500, amazonSalesEst: 320, amazonSellerCount: 6, amazonSoldByAmazon: false,
  },
  {
    aliId: "1002", title: "Nike Spor Çorap 5'li Paket", aliCost: 4, aliShipping: 0,
    aliOrders: 9000, aliRating: 4.9, brand: "Nike", category: "clothing",
    amazonBsr: 3000, amazonSalesEst: 800, amazonSellerCount: 4, amazonSoldByAmazon: false,
  },
  {
    aliId: "1003", title: "Replica AirPods Pro 1:1 Kablosuz Kulaklık", aliCost: 12, aliShipping: 2,
    aliOrders: 15000, aliRating: 4.7, brand: "Generic", category: "electronics",
    amazonBsr: 1200, amazonSalesEst: 1500, amazonSellerCount: 3, amazonSoldByAmazon: false,
  },
  {
    aliId: "1004", title: "Akıllı Köpek Tasması GPS Takip", aliCost: 22, aliShipping: 3,
    aliOrders: 110, aliRating: 4.6, brand: "Generic", category: "pet",
    amazonBsr: 22000, amazonSalesEst: 90, amazonSellerCount: 9, amazonSoldByAmazon: false,
  },
  {
    aliId: "1005", title: "Ucuz Plastik Telefon Tutucu", aliCost: 1.2, aliShipping: 0,
    aliOrders: 600, aliRating: 4.3, brand: "Generic", category: "electronics",
    amazonBsr: 90000, amazonSalesEst: 15, amazonSellerCount: 40, amazonSoldByAmazon: true,
  },
  {
    aliId: "1006", title: "LED Gece Lambası Mantar Tasarım", aliCost: 5, aliShipping: 1,
    aliOrders: 2800, aliRating: 4.85, brand: "Generic", category: "home",
    amazonBsr: 14000, amazonSalesEst: 210, amazonSellerCount: 7, amazonSoldByAmazon: false,
  },
  {
    aliId: "1007", title: "Katlanır Silikon Su Şişesi 600ml", aliCost: 3.8, aliShipping: 1,
    aliOrders: 5600, aliRating: 4.7, brand: "Generic", category: "sports",
    amazonBsr: 11000, amazonSalesEst: 260, amazonSellerCount: 8, amazonSoldByAmazon: false,
  },
  {
    aliId: "1008", title: "Manyetik Araç Telefon Tutucu Premium", aliCost: 4.5, aliShipping: 0.5,
    aliOrders: 7300, aliRating: 4.75, brand: "Generic", category: "electronics",
    amazonBsr: 9000, amazonSalesEst: 340, amazonSellerCount: 11, amazonSoldByAmazon: false,
  },
];
