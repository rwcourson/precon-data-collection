import { getWebPrincipal } from "@/lib/authorization/web-principal";

export const runtime = "nodejs";

export async function GET() {
  try {
    const principal = await getWebPrincipal();
    return Response.json({
      id: principal.user.id,
      name: principal.user.name,
      role: principal.user.role,
      region: principal.user.region,
      workspaceRegion: principal.workspace.region,
    });
  } catch {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
}
