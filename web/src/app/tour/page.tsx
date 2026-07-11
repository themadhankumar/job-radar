import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TourClient } from "./tour-client";

export default async function TourPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <TourClient />;
}
