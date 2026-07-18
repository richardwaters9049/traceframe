import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/auth/login-screen";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const skipIntro = (await cookies()).get("traceframe_skip_intro")?.value === "1";
  return <LoginScreen skipIntro={skipIntro} />;
}
