"use client";

import Script from "next/script";

/**
 * Tawk.to canlı destek widget'ı (sağ alt köşede sohbet balonu).
 *
 * ID Coolify env'den okunur: `NEXT_PUBLIC_TAWK_ID = "propertyId/widgetId"`
 * (tawk.to panelinde Admin → Channels → Chat Widget'taki embed src'nin
 *  `https://embed.tawk.to/` sonrası kısmı).
 *
 * ID yoksa hiçbir şey render edilmez → kurulana kadar güvenle pasif kalır.
 * Tawk ID gizli değildir (sayfada public embed edilir), bu yüzden NEXT_PUBLIC uygundur.
 */
export function TawkWidget() {
  const tawkId = process.env.NEXT_PUBLIC_TAWK_ID;
  if (!tawkId) return null;

  return (
    // lazyOnload: sohbet balonu sayfanın kendi JS'iyle yarışmasın, tarayıcı
    // boşa düşünce yüklensin — ilk açılış hızı için kritik.
    <Script id="tawk-to" strategy="lazyOnload">
      {`
        var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
        (function(){
          var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
          s1.async=true;
          s1.src='https://embed.tawk.to/${tawkId}';
          s1.charset='UTF-8';
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
        })();
      `}
    </Script>
  );
}
