import { handleApi } from "@/lib/api/router";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function run(req: Request, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  return handleApi(req, path);
}

export const GET = run;
export const POST = run;
export const PUT = run;
export const PATCH = run;
export const DELETE = run;
