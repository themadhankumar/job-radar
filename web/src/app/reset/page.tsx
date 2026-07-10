import { Suspense } from "react";
import { ResetForm } from "@/components/reset-form";

// Suspense boundary required: ResetForm reads the token from useSearchParams()
export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
