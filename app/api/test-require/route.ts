import { NextResponse } from 'next/server';
import { createRequire } from 'module';

export const dynamic = 'force-dynamic';

export async function GET() {
  const req = createRequire(import.meta.url);
  const results: Record<string, any> = {};

  const packages = ['pg', 'drizzle-orm', 'dotenv', 'exceljs', 'pdfkit', 'styled-jsx'];

  for (const pkg of packages) {
    try {
      const resolved = req.resolve(pkg);
      results[pkg] = { resolved, success: true };
    } catch (err: any) {
      results[pkg] = { success: false, error: err.message, code: err.code };
    }
  }

  return NextResponse.json({
    cwd: process.cwd(),
    nodeVersion: process.version,
    results,
  });
}
