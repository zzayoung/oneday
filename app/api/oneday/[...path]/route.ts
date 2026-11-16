import { env } from 'cloudflare:workers';
import { handleOneDay } from '../../../../server/api.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) { return handleOneDay(request, env); }
export async function POST(request: Request) { return handleOneDay(request, env); }
export async function PATCH(request: Request) { return handleOneDay(request, env); }
export async function DELETE(request: Request) { return handleOneDay(request, env); }
