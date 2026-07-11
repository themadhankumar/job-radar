"use client";
import { useRouter } from "next/navigation";
import { ProductTour } from "@/components/product-tour";

export function TourClient() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ProductTour doneLabel="Back to Settings" onDone={() => { router.push("/settings"); router.refresh(); }} />
    </div>
  );
}
