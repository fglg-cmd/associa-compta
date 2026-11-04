import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Connexion" };

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
