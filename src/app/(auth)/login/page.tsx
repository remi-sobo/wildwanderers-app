import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Wild Wanderers",
};

export default function LoginPage() {
  return <LoginForm />;
}
