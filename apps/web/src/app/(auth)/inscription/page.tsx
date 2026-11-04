import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Créer un compte" };

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
