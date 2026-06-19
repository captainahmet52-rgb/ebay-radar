import { redirect } from "next/navigation";

// Radar & Depo artık ADMİN'e ait (eBay'deki gibi). Müşteri görmez → panele yönlendir.
export default function AmazonDepotRedirect() {
  redirect("/amazon");
}
