import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { LoadingState } from "@/src/components/StateViews";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Starting Precon…" />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(app)" />;
}
